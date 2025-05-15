import { Inject, Injectable, Logger } from '@nestjs/common';
import type { JobOptions } from 'bull';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Injectable()
export class NocoJobsService {
  protected logger = new Logger(NocoJobsService.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  get jobsQueue() {
    return this.jobsService.jobsQueue;
  }

  async add(name: string, data: any, options?: JobOptions) {
    return this.jobsService.add(name, data, options);
  }

  async getJob(jobId: string) {
    return this.jobsQueue.getJob(jobId);
  }

  async getJobStatus(jobId: string) {
    return this.jobsService.jobStatus(jobId);
  }

  async getJobList() {
    return this.jobsService.jobList();
  }

  async pauseQueue() {
    return this.jobsService.pauseQueue();
  }

  async resumeQueue() {
    return this.jobsService.resumeQueue();
  }

  async toggleQueue() {
    return this.jobsService.toggleQueue();
  }
}
