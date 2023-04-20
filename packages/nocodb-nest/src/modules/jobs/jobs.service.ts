import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

@Injectable()
export class JobsService {
  constructor(@InjectQueue('duplicate') private duplicateQueue: Queue) {}

  async jobStatus(jobType: string, jobId: string) {
    switch (jobType) {
      case 'duplicate':
      default:
        return await (await this.duplicateQueue.getJob(jobId)).getState();
    }
  }

  async jobList(jobType: string) {
    switch (jobType) {
      case 'duplicate':
      default:
        return await this.duplicateQueue.getJobs([
          'active',
          'waiting',
          'delayed',
        ]);
    }
  }
}
