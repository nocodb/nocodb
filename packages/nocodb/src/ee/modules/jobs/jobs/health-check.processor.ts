import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';

@Injectable()
export class HealthCheckProcessor {
  private logger = new Logger(HealthCheckProcessor.name);

  constructor(@Inject('JobsService') protected readonly jobsService) {}

  async job() {
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
