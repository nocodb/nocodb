import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import type { JobData } from '~/interface/Jobs';
import { JOB_REQUEUE_LIMIT, JOBS_QUEUE, JobVersions } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsMap } from '~/modules/jobs/jobs-map.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus } from '~/interface/Jobs';

const NC_WORKER_CONCURRENCY = process.env.NC_WORKER_CONCURRENCY ?? 10;

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

    try {
      return await processor[fn](job);
    } catch (e) {
      this.logger.error(`Error processing job ${jobName}`, e);
      throw e;
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
