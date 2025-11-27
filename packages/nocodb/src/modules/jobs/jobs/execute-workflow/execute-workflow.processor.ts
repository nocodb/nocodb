import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { type ExecuteWorkflowJobData } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import Workflow from '~/models/Workflow';
import WorkflowExecution from '~/models/WorkflowExecution';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';

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

      this.logger.log(
        `Started execution ${executionRecord.id} for workflow ${workflowId}`,
      );

      // Execute workflow
      const result = await this.workflowExecutionService.executeWorkflow(
        context,
        workflow,
        triggerInputs,
        triggerNodeId,
      );

      await WorkflowExecution.update(context, executionRecord.id, {
        execution_data: result,
        finished: true,
        finished_at: new Date(),
        status: result.status === 'completed' ? 'success' : result.status,
      });

      this.logger.log(
        `Completed execution ${executionRecord.id} with status: ${result.status}`,
      );
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);

      if (executionRecord) {
        try {
          await WorkflowExecution.update(context, executionRecord.id, {
            finished: true,
            finished_at: new Date(),
            status: 'error',
            execution_data: null,
          });
        } catch (updateError) {
          this.logger.error(`Failed to update execution log:`, updateError);
        }
      }

      throw error;
    }
  }
}
