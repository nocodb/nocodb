import { Inject, Logger } from '@nestjs/common';
import { EventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Job } from 'bull';
import {
  type ExecuteWorkflowJobData,
  type ResumeWorkflowJobData,
} from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import Workflow from '~/models/Workflow';
import WorkflowExecution from '~/models/WorkflowExecution';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import NocoSocket from '~/socket/NocoSocket';
import { UsageStat } from '~/ee/models';
import { PlanLimitTypes } from '~/ee/helpers/paymentHelpers';
import { throttleWithLast } from '~/utils/functionUtils';

export class WorkflowProcessor {
  protected logger = new Logger(WorkflowProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {}

  async executeWorkflow(job: Job<ExecuteWorkflowJobData>) {
    const { context, workflowId, triggerNodeId, triggerInputs } = job.data;

    const workflow = await Workflow.get(context, workflowId);
    if (!workflow) {
      this.logger.error(`Workflow not found for id: ${workflowId}`);
      return;
    }

    if (!workflow.enabled) {
      this.logger.warn(
        `Workflow ${workflowId} is disabled, skipping execution`,
      );
      return;
    }

    await UsageStat.incrby(
      context.workspace_id,
      PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      1,
    );

    let executionRecord: WorkflowExecution | null = null;

    try {
      executionRecord = await WorkflowExecution.insert(context, workflowId, {
        workflow_data: {
          id: workflow.id,
          title: workflow.title,
          nodes: workflow.nodes,
          edges: workflow.edges,
        },
        finished: false,
        started_at: new Date().toISOString(),
        status: 'running',
      });

      this.broadcastExecutionEvent(
        context,
        workflowId,
        executionRecord,
        'create',
      );

      const result = await this.workflowExecutionService.executeWorkflow(
        context,
        workflow,
        triggerInputs,
        triggerNodeId,
        throttleWithLast(async (state) => {
          const execution = await WorkflowExecution.update(
            context,
            executionRecord.id,
            {
              execution_data: state,
            },
          );
          this.broadcastExecutionEvent(
            context,
            workflowId,
            execution,
            'update',
          );
        }, 1000),
      );

      if (result.status === 'skipped') {
        await WorkflowExecution.delete(context, executionRecord.id);
        this.broadcastExecutionEvent(
          context,
          workflowId,
          executionRecord,
          'delete',
        );

        await UsageStat.incrby(
          context.workspace_id,
          PlanLimitTypes.LIMIT_AUTOMATION_RUN,
          -1,
        );
        return;
      }

      // Handle waiting status (delay node)
      if (result.status === 'waiting' && result.resumeAt) {
        const delayMs = result.resumeAt - Date.now();
        const resumeAtISO = new Date(result.resumeAt).toISOString();

        this.logger.log(
          `Workflow ${workflowId} execution ${executionRecord.id} paused, will resume at ${resumeAtISO} (in ${delayMs}ms)`,
        );

        // Update execution with waiting status and resume_at
        const updatedExecution = await WorkflowExecution.update(
          context,
          executionRecord.id,
          {
            execution_data: result,
            finished: false,
            status: 'waiting',
            resume_at: resumeAtISO,
          },
        );

        this.broadcastExecutionEvent(
          context,
          workflowId,
          updatedExecution,
          'update',
        );
        return;
      }

      // Handle completed/error status
      const updatedExecution = await WorkflowExecution.update(
        context,
        executionRecord.id,
        {
          execution_data: result,
          finished: true,
          finished_at: new Date().toISOString(),
          status: result.status,
          resume_at: null,
        },
      );

      this.broadcastExecutionEvent(
        context,
        workflowId,
        updatedExecution,
        'update',
      );
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);

      if (executionRecord) {
        try {
          const updatedExecution = await WorkflowExecution.update(
            context,
            executionRecord.id,
            {
              finished: true,
              finished_at: new Date().toISOString(),
              status: 'error',
              execution_data: null,
              resume_at: null,
            },
          );

          this.broadcastExecutionEvent(
            context,
            workflowId,
            updatedExecution,
            'update',
          );
        } catch (updateError) {
          this.logger.error(`Failed to update execution log:`, updateError);
        }
      }

      throw error;
    }
  }

  async resumeWorkflow(job: Job<ResumeWorkflowJobData>) {
    const { context, executionId } = job.data;

    this.logger.log(
      `Processing resume-workflow job for execution: ${executionId}`,
    );

    try {
      let execution = await WorkflowExecution.get(context, executionId);

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found`);
        return;
      }

      if (execution.status !== 'waiting') {
        this.logger.warn(
          `Execution ${executionId} is not in waiting state (current: ${execution.status})`,
        );
        return;
      }

      // Use workflow_data as snapshot
      if (!execution.workflow_data) {
        this.logger.error(
          `Cannot resume: workflow snapshot missing for execution ${executionId}`,
        );
        await this.updateExecutionStatus(
          context,
          executionId,
          execution.fk_workflow_id,
          'error',
        );
        return;
      }

      const workflow = execution.workflow_data as any;

      const currentWorkflow = await Workflow.get(
        context,
        execution.fk_workflow_id,
      );

      if (currentWorkflow && !currentWorkflow.enabled) {
        this.logger.warn(
          `Workflow ${execution.fk_workflow_id} is disabled, cancelling execution ${executionId}`,
        );
        await this.updateExecutionStatus(
          context,
          executionId,
          execution.fk_workflow_id,
          'cancelled',
        );
        return;
      }

      // Prepare state for resumption
      const state = execution.execution_data;
      if (!state) {
        await this.updateExecutionStatus(
          context,
          executionId,
          execution.fk_workflow_id,
          'error',
        );
        throw new Error(`Execution state missing for ${executionId}`);
      }

      state.status = 'running';
      delete state.pausedAt;
      delete state.resumeAt;

      this.logger.log(`Resuming from node ${state.nextNodeId}`);

      execution = await WorkflowExecution.update(context, executionId, {
        status: 'running',
        execution_data: state,
      });

      // Broadcast resume event
      this.broadcastExecutionEvent(
        context,
        execution.fk_workflow_id,
        execution,
        'update',
      );

      let isDone = false;

      // Continue execution with snapshot and progress callback
      const result = await this.workflowExecutionService.executeWorkflow(
        context,
        workflow,
        state.triggerData,
        state.triggerNodeTitle,
        throttleWithLast(async (updatedState) => {
          if (isDone) return;

          const updatedExecution = await WorkflowExecution.update(
            context,
            executionId,
            {
              execution_data: updatedState,
              ...(updatedState.status === 'waiting' && updatedState.resumeAt
                ? { resume_at: new Date(updatedState.resumeAt).toISOString() }
                : {}),
            },
          );

          this.broadcastExecutionEvent(
            context,
            execution.fk_workflow_id,
            updatedExecution,
            'update',
          );
        }, 1000),
        state, // Resume from this state
        executionId, // Use same execution ID
      );

      isDone = true;

      // Update final state
      const finalExecution = await WorkflowExecution.update(
        context,
        executionId,
        {
          status: result.status,
          execution_data: result,
          finished: result.status !== 'waiting',
          finished_at:
            result.status !== 'waiting' ? new Date().toISOString() : null,
          resume_at: result.status !== 'waiting' ? null : execution.resume_at,
        },
      );

      this.broadcastExecutionEvent(
        context,
        execution.fk_workflow_id,
        finalExecution,
        'update',
      );

      this.logger.log(
        `Successfully resumed workflow execution: ${executionId} (status: ${result.status})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to resume workflow execution ${executionId}:`,
        error,
      );

      // Update execution status to error
      try {
        const errorExecution = await WorkflowExecution.update(
          context,
          executionId,
          {
            status: 'error',
            finished: true,
            finished_at: new Date().toISOString(),
          },
        );

        if (errorExecution) {
          this.broadcastExecutionEvent(
            context,
            errorExecution.fk_workflow_id,
            errorExecution,
            'update',
          );
        }
      } catch (updateError) {
        this.logger.error('Failed to update execution status:', updateError);
      }

      throw error; // Let Bull handle retry
    }
  }

  private async updateExecutionStatus(
    context: NcContext,
    executionId: string,
    workflowId: string,
    status: 'error' | 'cancelled',
  ) {
    const updatedExecution = await WorkflowExecution.update(
      context,
      executionId,
      {
        status,
        finished: true,
        finished_at: new Date().toISOString(),
        resume_at: null,
      },
    );

    this.broadcastExecutionEvent(
      context,
      workflowId,
      updatedExecution,
      'update',
    );
  }

  private broadcastExecutionEvent(
    context: NcContext,
    workflowId: string,
    execution: WorkflowExecution,
    action: 'create' | 'update' | 'delete',
  ) {
    NocoSocket.broadcastEvent(context, {
      event: EventType.WORKFLOW_EXECUTION_EVENT,
      payload: {
        id: execution.id,
        workflowId,
        action,
        payload: execution,
      },
      scopes: [workflowId],
    });
  }
}
