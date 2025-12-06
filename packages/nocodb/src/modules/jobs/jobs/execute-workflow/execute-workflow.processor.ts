import { Inject, Logger } from '@nestjs/common';
import { EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import { type ExecuteWorkflowJobData } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import Workflow from '~/models/Workflow';
import WorkflowExecution from '~/models/WorkflowExecution';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import NocoSocket from '~/socket/NocoSocket';

export class ExecuteWorkflowProcessor {
  protected logger = new Logger(ExecuteWorkflowProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {}

  async job(job: Job<ExecuteWorkflowJobData>) {
    const { context, workflowId, triggerNodeId, triggerInputs } = job.data;

    let executionRecord: WorkflowExecution | null = null;

    try {
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

      executionRecord = await WorkflowExecution.insert(context, workflowId, {
        workflow_data: {
          id: workflow.id,
          title: workflow.title,
          nodes: workflow.nodes,
          edges: workflow.edges,
        },
        finished: false,
        started_at: new Date(),
        status: 'in_progress',
      });

      NocoSocket.broadcastEvent(context, {
        event: EventType.WORKFLOW_EXECUTION_EVENT,
        payload: {
          id: executionRecord.id,
          workflowId,
          action: 'create',
          payload: executionRecord,
        },
        scopes: [workflowId],
      });

      // Execute workflow
      const result = await this.workflowExecutionService.executeWorkflow(
        context,
        workflow,
        triggerInputs,
        triggerNodeId,
      );

      const updatedExecution = await WorkflowExecution.update(
        context,
        executionRecord.id,
        {
          execution_data: result,
          finished: true,
          finished_at: new Date(),
          status: result.status === 'completed' ? 'success' : result.status,
        },
      );

      NocoSocket.broadcastEvent(context, {
        event: EventType.WORKFLOW_EXECUTION_EVENT,
        payload: {
          id: executionRecord.id,
          workflowId,
          action: 'update',
          payload: updatedExecution,
        },
        scopes: [workflowId],
      });
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);

      if (executionRecord) {
        try {
          const updatedExecution = await WorkflowExecution.update(
            context,
            executionRecord.id,
            {
              finished: true,
              finished_at: new Date(),
              status: 'error',
              execution_data: null,
            },
          );

          NocoSocket.broadcastEvent(context, {
            event: EventType.WORKFLOW_EXECUTION_EVENT,
            payload: {
              id: executionRecord.id,
              workflowId,
              action: 'update',
              payload: updatedExecution,
            },
            scopes: [workflowId],
          });
        } catch (updateError) {
          this.logger.error(`Failed to update execution log:`, updateError);
        }
      }

      throw error;
    }
  }
}
