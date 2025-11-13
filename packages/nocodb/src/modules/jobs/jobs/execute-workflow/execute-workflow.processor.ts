import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { type ExecuteWorkflowJobData } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import Workflow from '~/ee/models/Workflow';
import { WorkflowExecutionService } from '~/ee/services/workflow-execution.service';

export class ExecuteWorkflowProcessor {
  protected logger = new Logger(ExecuteWorkflowProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {}

  async job(job: Job<ExecuteWorkflowJobData>) {
    const { context, workflowId, triggerNodeId, triggerInputs } = job.data;

    try {
      // Get the workflow
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

      // Execute the workflow with trigger inputs
      await this.workflowExecutionService.executeWorkflow(
        context,
        workflow,
        triggerInputs,
        triggerNodeId,
      );
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);
      throw error;
    }
  }
}
