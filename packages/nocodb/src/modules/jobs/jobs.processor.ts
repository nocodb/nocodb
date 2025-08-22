import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Timer } from 'nocodb-sdk';
import type { JobData } from '~/interface/Jobs';
import {
  JOB_REQUEUE_LIMIT,
  JOBS_QUEUE,
  JobTypes,
  JobVersions,
} from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsMap } from '~/modules/jobs/jobs-map.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus } from '~/interface/Jobs';

const NC_WORKER_CONCURRENCY = process.env.NC_WORKER_CONCURRENCY ?? 10;

const LOCAL_CONCURRENCY_LIMIT = {
  [JobTypes.AtImport]: 2,
  [JobTypes.ThumbnailGenerator]: 1,
  [JobTypes.AttachmentUrlUpload]: 1,
};

const LOCAL_JOB_COUNT_MAP = new Map<string, number>();

@Processor(JOBS_QUEUE)
export class JobsProcessor {
  private logger = new Logger(JobsProcessor.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly jobsEventService: JobsEventService,
    protected readonly jobsMap: JobsMap,
  ) {}

  @Process({
    concurrency: +NC_WORKER_CONCURRENCY,
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

    const localRunning = LOCAL_JOB_COUNT_MAP.get(jobName)!;

    if (localRunning && localRunning >= LOCAL_CONCURRENCY_LIMIT[jobName]) {
      job.data._jobDelay = 0;
      job.data._jobAttempt = 1;

      await this.requeue(job);
      return;
    }

    if (localRunning) {
      LOCAL_JOB_COUNT_MAP.set(jobName, localRunning + 1);
    } else {
      LOCAL_JOB_COUNT_MAP.set(jobName, 1);
    }

    let warningTime = 1;
    const longProcessWarning = Timer.start(async (timer) => {
      this.logger.log(
        `Job '${job.id}' is taking ${
          warningTime++ * 10
        } minutes and stil processing`,
      );
      if (warningTime <= 2) {
        timer.start();
      }
    }, 10 * 60 * 1000);
    try {
      const result = await processor[fn](job);
      return result;
    } catch (e) {
      this.logger.error(`Error processing job ${jobName}`, e);
      throw e;
    } finally {
      const localRunning = LOCAL_JOB_COUNT_MAP.get(jobName)!;

      LOCAL_JOB_COUNT_MAP.set(jobName, localRunning - 1);
      longProcessWarning.stop();
    }
  }

  async requeue(job: Job<JobData>) {
    // Remove the job from the queue otherwise ids will clash
    await job.releaseLock();
    await job.remove();

    await this.jobsEventService.onCompleted(job, JobStatus.REQUEUED);

    const _jobDelay = job.data?._jobDelay ?? 0;
    const _jobAttempt = job.data?._jobAttempt ?? 1;

    if (_jobAttempt > JOB_REQUEUE_LIMIT) {
      this.logger.error(`Job ${job.data.jobName} failed after 10 attempts`);
      return;
    }

    job.data._jobDelay = _jobDelay + 5000;
    job.data._jobAttempt = _jobAttempt + 1;

    return this.jobsService.add(job.data.jobName, job.data, {
      jobId: job.id.toString(),
      delay: job.data._jobDelay,
    });
  }
}
