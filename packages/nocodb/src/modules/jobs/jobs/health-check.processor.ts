import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';

@Processor(JOBS_QUEUE)
export class HealthCheckProcessor {
  private logger = new Logger(HealthCheckProcessor.name);

  constructor(@Inject('JobsService') protected readonly jobsService) {}

  @Process(JobTypes.HealthCheck)
  async healthCheck() {
    const queue = this.jobsService.jobsQueue as Queue;

    if (queue) {
      queue
        .getJobCounts()
        .then((stats) => {
          // log stats periodically
          this.logger.log({ stats });
        })
        .catch((err) => {
          this.logger.error(err);
        });
    }
  }
}
