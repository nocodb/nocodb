import { Inject, Injectable } from '@nestjs/common';
import CronExpressionParser from 'cron-parser';
import { Workflow } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class WorkflowPollingService {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  async executePolling() {
    // get all workflows that have polling enabled
    const workflowWithPollings = await Workflow.getNextPollingWorkflows();
    for (const workflow of workflowWithPollings) {
      if (workflow.wf_is_polling_heartbeat) {
        // some trigger need heartbeat
        await this.jobsService.add(JobTypes.HeartbeatWorkflow, {
          context,
          workflowId: workflow.id,
        });
      } else {
        // queue job to execute workflow
        await this.jobsService.add(JobTypes.ExecuteWorkflow, {
          context,
          workflowId: workflow.id,
        });
      }
      // get nextPollingAt using cron expression
      const nextPollingAt = Math.floor(
        CronExpressionParser.parse(workflow.wf_polling_cron).next().getTime() /
          1000,
      );

      // update next polling time
      await Workflow.update(
        {
          base_id: workflow.base_id,
          workspace_id: workflow.fk_workspace_id,
        },
        workflow.id,
        {
          wf_next_polling_at: executionTime + workflow.wf_polling_interval,
        },
      );
    }
  }
}
