import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  EntityScheduler,
  ScheduledJobConfig,
} from '~/interface/Scheduler';
import dayjs from '~/utils/dayjs';
import { SchedulerOptions } from '~/interface/Scheduler';
import { PubSubRedis } from '~/redis/pubsub-redis';

const SCHEDULER_LOCK = 'scheduler:lock';
const SCHEDULER_LOCK_TTL = 70;

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly entitySchedulers = new Map<string, EntityScheduler>();
  private isShuttingDown = false;
  private readonly options: SchedulerOptions = new SchedulerOptions();
  private hasLock = false;
  private readonly instanceId = randomUUID();
  private renewalIntervalId: NodeJS.Timeout;

  constructor(@Inject('JobsService') private readonly jobsService) {}

  async onModuleInit() {
    await this.acquireLock();

    // Set up periodic lock renewal
    this.renewalIntervalId = setInterval(() => {
      this.renewLock().catch((err) => {
        this.logger.error('Failed to renew scheduler lock:', err);
      });
    }, 30000);
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Scheduler Service');
    this.isShuttingDown = true;

    // Release lock if we have it
    if (this.hasLock) {
      await this.releaseLock();
    }

    if (this.renewalIntervalId) {
      clearInterval(this.renewalIntervalId);
    }
  }

  /**
   * Try to acquire the distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    if (!PubSubRedis.available) {
      this.logger.warn(
        'Redis not available: Scheduler running in standalone mode',
      );
      this.hasLock = true;
      return true;
    }

    if (!PubSubRedis.initialized) {
      await PubSubRedis.init();
    }

    try {
      // Use Redis SET with options for atomic lock acquisition
      const result = await PubSubRedis.redisClient.set(
        SCHEDULER_LOCK,
        this.instanceId,
        'EX',
        SCHEDULER_LOCK_TTL,
        'NX',
      );

      this.hasLock = result === 'OK';

      if (this.hasLock) {
        this.logger.log(
          `Acquired scheduler lock with instance ID: ${this.instanceId}`,
        );
      }

      return this.hasLock;
    } catch (error) {
      this.logger.error('Error acquiring scheduler lock:', error);
      return false;
    }
  }

  /**
   * Renew the lock if we already have it
   */
  private async renewLock(): Promise<boolean> {
    // Only renew if we still own the lock
    if (!this.hasLock || !PubSubRedis.available) {
      return false;
    }

    try {
      const currentLockOwner = await PubSubRedis.redisClient.get(
        SCHEDULER_LOCK,
      );

      if (currentLockOwner !== this.instanceId) {
        this.hasLock = false;
        return false;
      }

      // Extend the lock TTL
      await PubSubRedis.redisClient.expire(SCHEDULER_LOCK, SCHEDULER_LOCK_TTL);
      return true;
    } catch (error) {
      this.logger.error('Error renewing scheduler lock:', error);
      this.hasLock = false;
      return false;
    }
  }

  /**
   * Release the lock if we have it
   */
  private async releaseLock(): Promise<boolean> {
    // Only release lock if we still own the lock

    if (!this.hasLock || !PubSubRedis.available) {
      return false;
    }

    try {
      const currentLockOwner = await PubSubRedis.redisClient.get(
        SCHEDULER_LOCK,
      );

      if (currentLockOwner !== this.instanceId) {
        this.hasLock = false;
        return false;
      }

      await PubSubRedis.redisClient.del(SCHEDULER_LOCK);
      this.hasLock = false;
      this.logger.log(
        `Released scheduler lock for instance ID: ${this.instanceId}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Error releasing scheduler lock:', error);
      return false;
    }
  }

  /**
   * Register an entity scheduler
   */
  registerEntityScheduler(scheduler: EntityScheduler) {
    const entityType = scheduler.getEntityType();
    this.entitySchedulers.set(entityType, scheduler);
    this.logger.log(`Registered entity scheduler for: ${entityType}`);
  }

  @Cron(CronExpression.EVERY_5_SECONDS, { name: 'scheduledJobProcessor' })
  async processDueJobs() {
    if (this.isShuttingDown) return;

    // Skip processing if we don't have the lock
    if (!this.hasLock) {
      return;
    }

    try {
      const currentTime = dayjs().utc();

      this.logger.debug(
        `Processing jobs due before ${currentTime.toISOString()}`,
      );

      // Process each entity scheduler separately
      for (const [entityType, scheduler] of this.entitySchedulers.entries()) {
        if (this.isShuttingDown) break;

        try {
          await this.processEntitySchedulerJobs(
            scheduler,
            currentTime,
          );
        } catch (error) {
          this.logger.error(
            `Error processing entity scheduler ${entityType}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing due jobs:', error);
    }
  }

  /**
   * Process jobs for a specific entity scheduler
   */
  private async processEntitySchedulerJobs(
    scheduler: EntityScheduler,
    currentTime: dayjs.Dayjs,
  ) {
    const entityType = scheduler.getEntityType();
    let processedCount = 0;
    const batchSize = this.options.batchSize;

    // Process jobs in batches
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.isShuttingDown) break;

      const dueJobs = await scheduler.findDueJobs(
        currentTime,
        batchSize,
        0,
      );

      if (!dueJobs.length) break;

      this.logger.debug(
        `Processing batch of ${dueJobs.length} ${entityType} jobs`,
      );

      const jobsWithNextExecution = dueJobs.map((job) => ({
        ...job,
        lastExecutionTime: dayjs().utc(),
        nextExecutionTime: this.calculateNextExecutionTime(job),
      }));

      try {
        await scheduler.updateExecutionTime(jobsWithNextExecution);
      } catch (error) {
        this.logger.error(
          `Failed to update execution times for ${entityType} jobs:`,
          error,
        );
        // Skip processing these jobs if we couldn't update their execution times
        continue;
      }

      // Queue jobs
      for (const job of dueJobs) {
        this.jobsService
          .add(job.jobType, {
            ...job.jobData,
            _scheduledJobId: job.id,
            _entityId: job.entityId,
            _entityType: job.entityType,
            _isScheduledExecution: true,
            _scheduledAt: dayjs().utc().toISOString(),
            _originalExecutionTime: job.nextExecutionTime,
          })
          .catch((error) => {
            this.logger.error(`Failed to queue job ${job.id}:`, error);
          });
      }

      processedCount += dueJobs.length;

      // If we got fewer jobs than the batch size, we're done
      if (dueJobs.length < batchSize) break;

      // Delay between batches
      await this.delay(100);
    }

    return processedCount;
  }

  /**
   * Calculate next execution time based on cron or interval
   */
  private calculateNextExecutionTime(job: ScheduledJobConfig): dayjs.Dayjs {
    const now = dayjs().utc();
    const timezone = job.timezone || 'UTC';

    if (job.cronExpression) {
      try {
        const cron = CronExpressionParser.parse(job.cronExpression, {
          currentDate: now.toDate(),
          tz: timezone,
        });

        return dayjs(cron.next().toDate()).tz(timezone);
      } catch (error) {
        this.logger.error(
          `Invalid cron expression for job ${job.id}: ${job.cronExpression}`,
          error,
        );
        return now.add(job.intervalMinutes || 60, 'minute');
      }
    }

    if (job.intervalMinutes) {
      return now.add(job.intervalMinutes, 'minute');
    }

    // Default to 1 hour
    return now.add(60, 'minute');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
