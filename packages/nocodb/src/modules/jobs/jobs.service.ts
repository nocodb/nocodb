import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { JOBS_QUEUE, JobStatus } from '../../interface/Jobs';
import { QueueService } from './fallback-queue.service';

@Injectable()
export class JobsService {
  public activeQueue;
  constructor(
    @InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue,
    private readonly fallbackQueueService: QueueService,
  ) {
    this.activeQueue = this.fallbackQueueService;
    /* process.env.NC_REDIS_URL
        ? this.jobsQueue
        : this.fallbackQueueService;
    */
  }

  async jobStatus(jobId: string) {
    return await (await this.activeQueue.getJob(jobId)).getState();
  }

  async jobList(jobType: string) {
    return (
      await this.activeQueue.getJobs([
        JobStatus.ACTIVE,
        JobStatus.WAITING,
        JobStatus.DELAYED,
        JobStatus.PAUSED,
      ])
    ).filter((j) => j.name === jobType);
  }

  async getJobWithData(data: any) {
    const jobs = await this.activeQueue.getJobs([
      // 'completed',
      JobStatus.WAITING,
      JobStatus.ACTIVE,
      JobStatus.DELAYED,
      // 'failed',
      JobStatus.PAUSED,
    ]);

    const job = jobs.find((j) => {
      for (const key in data) {
        if (j.data[key]) {
          if (j.data[key] !== data[key]) return false;
        } else {
          return false;
        }
      }
      return true;
    });

    return job;
  }
}
