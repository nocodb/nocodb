import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOCO_SERVICE_USERS, ServiceUserType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class WorkflowResumeProcessor {
  private logger = new Logger(WorkflowResumeProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async job() {
    this.logger.log('WorkflowResumeProcessor job started');

    const ncMeta = Noco.ncMeta;

    try {
      // Query for workflow executions that are waiting and due for resumption
      const dueExecutions = await ncMeta
        .knexConnection(MetaTable.AUTOMATION_EXECUTIONS)
        .where('status', 'waiting')
        .where('resume_at', '<=', new Date())
        .limit(100); // Process 100 at a time

      this.logger.log(`Found ${dueExecutions.length} executions to resume`);

      for (const execution of dueExecutions) {
        try {
          const context = {
            workspace_id: execution.fk_workspace_id,
            base_id: execution.base_id,
          };

          // Add a ResumeWorkflow job for this execution
          const job = await this.jobsService.add(JobTypes.ResumeWorkflow, {
            context,
            executionId: execution.id,
            user: NOCO_SERVICE_USERS[ServiceUserType.WORKFLOW_USER],
          });

          this.logger.debug(
            `Queued resume job ${job.id} for execution ${execution.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to queue resume job for execution ${execution.id}:`,
            error,
          );
          // Continue with other executions
        }
      }

      this.logger.log('WorkflowResumeProcessor job completed');
    } catch (error) {
      this.logger.error('WorkflowResumeProcessor job failed:', error);
      throw error;
    }
  }
}
