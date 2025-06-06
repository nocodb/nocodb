import { Injectable, Logger } from '@nestjs/common';
import type { ScheduledJobConfig } from '~/interface/Scheduler';
import { BaseEntityScheduler } from '~/modules/scheduler/base-entity-scheduler';
import { JobTypes } from '~/interface/Jobs';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

@Injectable()
export class WebhookScheduler extends BaseEntityScheduler {
  protected readonly logger = new Logger(WebhookScheduler.name);
  private readonly ENTITY_TYPE = 'webhook';

  constructor() {
    super();
  }

  getEntityType(): string {
    return this.ENTITY_TYPE;
  }

  /**
   * Find webhook jobs that are due for execution
   */
  async findDueJobs(
    currentTime: Date,
    endTime: Date,
    limit = 100,
    offset = 0,
  ): Promise<ScheduledJobConfig[]> {
    try {
      const webhooks = await Noco.ncMeta
        .knexConnection(MetaTable.HOOKS)
        .select('*')
        .where({
          event: 'cron',
          active: true,
          next_execution_at: {
            lt: endTime.toISOString(),
          },
        })
        .orderBy('next_execution_at', 'asc')
        .limit(limit)
        .offset(offset);

      return webhooks.map((webhook) => {
        const jobConfig: ScheduledJobConfig = {
          id: webhook.id,
          entityId: webhook.id,
          entityType: this.ENTITY_TYPE,
          jobType: JobTypes.HandleWebhook,
          jobData: {
            context: {
              workspace_id: webhook.fk_workspace_id,
              base_id: webhook.base_id,
            },
            user: {},
            hookId: webhook.id,
            modelId: webhook.fk_model_id,
            scheduledExecution: true,
          },
          timezone: webhook.timezone,
          nextExecutionTime: new Date(webhook.next_execution_at),
          lastExecutionTime: webhook.last_execution_at
            ? new Date(webhook.last_execution_at)
            : undefined,
          cronExpression: webhook.cron_expression,
          active: webhook.active,
        };

        return jobConfig;
      });
    } catch (error) {
      this.logger.error('Error finding due webhook jobs:', error);
      return [];
    }
  }

  /**
   * Update execution times for processed webhook jobs
   */
  async updateExecutionTime(jobs: ScheduledJobConfig[]): Promise<void> {
    if (!jobs.length) return;

    try {
      const batchSize = 20;
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);

        const updatePromises = batch.map((job) => {
          return Noco.ncMeta
            .knexConnection(MetaTable.HOOKS)
            .where({ id: job.id })
            .update({
              last_execution_at: job.lastExecutionTime.toISOString(),
              next_execution_at: job.nextExecutionTime.toISOString(),
            });
        });

        await Promise.all(updatePromises);
      }
    } catch (error) {
      this.logger.error('Error updating webhook execution times:', error);
      throw error;
    }
  }
}
