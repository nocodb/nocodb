import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Timer } from 'nocodb-sdk';
import type { JobData } from '~/interface/Jobs';
import {
  JOB_REQUEUE_LIMIT,
  jobRequeueDelay,
  JOBS_QUEUE,
  JobTypes,
  JobVersions,
  parseWorkerConcurrency,
} from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsMap } from '~/modules/jobs/jobs-map.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus } from '~/interface/Jobs';

const NC_WORKER_CONCURRENCY = parseWorkerConcurrency(
  process.env.NC_WORKER_CONCURRENCY,
);

const LOCAL_CONCURRENCY_LIMIT = {
  [JobTypes.AtImport]: 2,
  [JobTypes.ThumbnailGenerator]: 1,
  [JobTypes.AttachmentUrlUpload]: 1,
};

export const LOCAL_JOB_COUNT_MAP = new Map<string, number>();

@Processor(JOBS_QUEUE)
export class JobsProcessor {
  private logger = new Logger(JobsProcessor.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly jobsEventService: JobsEventService,
    protected readonly jobsMap: JobsMap,
  ) {}

  @Process({
    concurrency: NC_WORKER_CONCURRENCY,
  })
  async process(job: Job<JobData>) {
    const { jobName } = job.data;

    if (!this.jobsMap.jobs[jobName]) {
      this.logger.error(`Job not found for ${jobName}`);
      await this.requeue(job);
      return;
    }

    const { this: processor, fn = 'job' } = this.jobsMap.jobs[jobName];

    if (!processor[fn]) {
      this.logger.error(`Job function not found for ${jobName}`);
      await this.requeue(job);
      return;
    }

    if (JobVersions[jobName] || job.data?._jobVersion) {
      if (JobVersions[jobName] !== job.data._jobVersion) {
        this.logger.error(`Job version mismatch for ${jobName}`);
        await this.requeue(job);
        return;
      }
    }

    const localLimit = LOCAL_CONCURRENCY_LIMIT[jobName];
    const localRunning = LOCAL_JOB_COUNT_MAP.get(jobName) ?? 0;

    if (localLimit !== undefined && localRunning >= localLimit) {
      await this.requeue(job);
      return;
    }

    let warningTime = 1;
    let incremented = false;
    let longProcessWarning: Timer | undefined;

    try {
      longProcessWarning = Timer.start(async (timer) => {
        this.logger.log(
          `Job '${job.id}' is taking ${
            warningTime++ * 10
          } minutes and stil processing`,
        );
        if (warningTime <= 2) {
          timer.start();
        }
      }, 10 * 60 * 1000);

      if (localLimit !== undefined) {
        LOCAL_JOB_COUNT_MAP.set(jobName, localRunning + 1);
        incremented = true;
      }

      const result = await processor[fn](job);
      return result;
    } catch (e) {
      this.logger.error(`Error processing job ${jobName}`, e);
      throw e;
    } finally {
      if (incremented) {
        const current = LOCAL_JOB_COUNT_MAP.get(jobName) ?? 1;
        LOCAL_JOB_COUNT_MAP.set(jobName, Math.max(0, current - 1));
      }
      longProcessWarning?.stop();
    }
  }

  async requeue(job: Job<JobData>) {
    // Remove the job from the queue otherwise ids will clash
    await job.releaseLock();
    await job.remove();

    await this.jobsEventService.onCompleted(job, JobStatus.REQUEUED);

    const attempt = job.data?._jobAttempt ?? 1;

    if (attempt > JOB_REQUEUE_LIMIT) {
      this.logger.error(
        `Job ${job.data.jobName} dropped after ${JOB_REQUEUE_LIMIT} requeues`,
      );
      return;
    }

    job.data._jobAttempt = attempt + 1;

    return this.jobsService.add(job.data.jobName, job.data, {
      jobId: job.id.toString(),
      delay: jobRequeueDelay(attempt),
    });
  }
}
