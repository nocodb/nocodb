import { Inject, Logger } from '@nestjs/common';
import { EventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Job } from 'bull';
import { type ExecuteWorkflowJobData } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import Workflow from '~/models/Workflow';
// TODO: Add OSS placeholders or move to EE cc @Anbarasu
import WorkflowExecution from '~/models/WorkflowExecution';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import NocoSocket from '~/socket/NocoSocket';
import { UsageStat } from '~/ee/models';
import { PlanLimitTypes } from '~/ee/helpers/paymentHelpers';
// import { Workspace } from '~/models';
import { throttleWithLast } from '~/utils/functionUtils';

export class ExecuteWorkflowProcessor {
  protected logger = new Logger(ExecuteWorkflowProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {}

  async job(job: Job<ExecuteWorkflowJobData>) {
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

      const updatedExecution = await WorkflowExecution.update(
        context,
        executionRecord.id,
        {
          execution_data: result,
          finished: true,
          finished_at: new Date().toISOString(),
          status: result.status,
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
