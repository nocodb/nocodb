import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Processor(JOBS_QUEUE)
export class HealthCheckProcessor {
  private logger = new Logger(HealthCheckProcessor.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  @Process(JobTypes.HealthCheck)
  async healthCheck() {
    const queue = this.jobsService.jobsQueue;

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
