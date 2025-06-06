export interface ScheduledJobConfig {
  id: string;
  entityId: string;
  entityType: string;
  jobType: string;
  jobData: any;
  nextExecutionTime: Date;
  lastExecutionTime?: Date;
  cronExpression?: string;
  intervalMinutes?: number;
  timezone?: string;
  active?: boolean;
}

export interface EntityScheduler {
  getEntityType(): string;
  findDueJobs(
    currentTime: Date,
    endTime: Date,
    limit?: number,
    offset?: number,
  ): Promise<ScheduledJobConfig[]>;
  updateExecutionTime(jobs: ScheduledJobConfig[]): Promise<void>;
}

export class SchedulerOptions {
  /**
   * Polling interval in milliseconds
   * @default 60000 (1 minute)
   */
  pollingIntervalMs: number = 60000;

  /**
   * Number of jobs to process in a single batch
   * @default 100
   */
  batchSize: number = 100;
}
