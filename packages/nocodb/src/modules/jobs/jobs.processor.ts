import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import type { JobData } from '~/interface/Jobs';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsMap } from '~/modules/jobs/jobs-map.service';

const NC_WORKER_CONCURRENCY = process.env.NC_WORKER_CONCURRENCY ?? 5;

@Processor(JOBS_QUEUE)
export class JobsProcessor {
  private logger = new Logger(JobsProcessor.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly jobsMap: JobsMap,
  ) {}

  @Process({
    concurrency: +NC_WORKER_CONCURRENCY,
  })
  async process(job: Job<JobData>) {
    const { jobName } = job.data;

    if (!this.jobsMap.jobs[jobName]) {
      this.logger.error(`Job not found for ${jobName}`);
      return;
    }

    const { this: processor, fn = 'job' } = this.jobsMap.jobs[jobName];

    if (!processor[fn]) {
      this.logger.error(`Job function not found for ${jobName}`);
      return;
    }

    try {
      return await processor[fn](job);
    } catch (e) {
      this.logger.error(`Error processing job ${jobName}`, e);
      throw e;
    }
  }
}
