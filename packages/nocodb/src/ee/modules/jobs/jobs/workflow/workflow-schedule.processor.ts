import { Inject, Injectable, Logger } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import {
  DependencyTableType,
  NOCO_SERVICE_USERS,
  ServiceUserType,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { Base } from '~/models';

@Injectable()
export class WorkflowScheduleProcessor {
  private logger = new Logger(WorkflowScheduleProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async job() {
    this.logger.log('WorkflowScheduleProcessor job started');
    await this.scheduleCronTrigger();
    this.logger.debug('WorkflowScheduleProcessor job completed');
  }

  async scheduleCronTrigger() {
    const ncMeta = Noco.ncMeta;

    const dueTriggers = await ncMeta
      .knexConnection(MetaTable.DEPENDENCY_TRACKER)
      .where('source_type', DependencyTableType.Workflow)
      .where('dependent_type', DependencyTableType.Workflow)
      .where('queryable_field_2', '<=', new Date()) // nextSyncAt <= now
      .limit(10); // Process 10 at a time

    this.logger.debug(`Found ${dueTriggers.length} due cron triggers`);

    for (const trigger of dueTriggers) {
      try {
        const context = {
          workspace_id: trigger.fk_workspace_id,
          base_id: trigger.base_id,
        };

        const base = await Base.get(context, trigger.base_id);
        if (!base || !!base?.deleted || !!base?.is_snapshot) {
          this.logger.debug(
            `Skipping trigger for deleted/snapshot base ${trigger.base_id}`,
          );
          continue;
        }

        const meta = trigger.meta ? JSON.parse(trigger.meta) : {};
        const { nodeId, activationState } = meta;

        if (!nodeId || !activationState?.cronExpression) {
          this.logger.warn(
            `Invalid cron trigger data for workflow ${trigger.source_id}`,
          );
          continue;
        }

        const scheduledTime = trigger.queryable_field_2;
        if (activationState?.heartbeat) {
          // some trigger need heartbeat
          await this.jobsService.add(JobTypes.HeartbeatWorkflow, {
            context,
            workflowId: trigger.source_id,
          });
        } else {
          const job = await this.jobsService.add(JobTypes.ExecuteWorkflow, {
            context,
            workflowId: trigger.source_id,
            triggerNodeId: nodeId,
            triggerInputs: {
              timestamp: new Date().toISOString(),
              scheduledTime,
            },
            req: {
              user: NOCO_SERVICE_USERS[ServiceUserType.SYNC_USER],
            } as any,
          });

          this.logger.debug(
            `Queued cron workflow ${trigger.source_id} with job ${job.id}`,
          );
        }

        const interval = CronExpressionParser.parse(
          activationState.cronExpression,
          {
            tz: activationState.timezone,
            currentDate: new Date(),
          },
        );

        const nextSyncAt = interval.next().toDate();

        await ncMeta
          .knexConnection(MetaTable.DEPENDENCY_TRACKER)
          .where('id', trigger.id)
          .update({
            queryable_field_2: nextSyncAt,
            updated_at: new Date(),
          });

        this.logger.debug(
          `Updated next execution time for workflow ${
            trigger.source_id
          } to ${nextSyncAt.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process cron trigger for workflow ${trigger.source_id}:`,
          error,
        );
        // Continue with other triggers
      }
    }
  }
}
