import { Logger } from '@nestjs/common';
import type {
  EntityScheduler,
  ScheduledJobConfig,
} from '~/interface/Scheduler';
import type dayjs from '~/utils/dayjs';

/**
 * Base class for entity schedulers that implements common functionality
 */
export abstract class BaseEntityScheduler implements EntityScheduler {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Get the entity type this scheduler handles
   */
  abstract getEntityType(): string;

  /**
   * Find jobs that are due to be executed
   */
  abstract findDueJobs(
    currentTime: dayjs.Dayjs,
    limit?: number,
    offset?: number,
  ): Promise<ScheduledJobConfig[]>;

  /**
   * Update execution times for jobs after they have been processed
   */
  abstract updateExecutionTime(jobs: ScheduledJobConfig[]): Promise<void>;
}
