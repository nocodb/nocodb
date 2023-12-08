import { Injectable } from '@nestjs/common';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JobStatus } from '~/interface/Jobs';

@Injectable()
export class JobsService {
  constructor(private readonly fallbackQueueService: QueueService) {}

  async add(name: string, data: any) {
    return this.fallbackQueueService.add(name, data);
  }

  async jobStatus(jobId: string) {
    return await (
      await this.fallbackQueueService.getJob(jobId)
    )?.status;
  }

  async jobList() {
    return await this.fallbackQueueService.getJobs([
      JobStatus.ACTIVE,
      JobStatus.WAITING,
      JobStatus.DELAYED,
      JobStatus.PAUSED,
    ]);
  }

  async getJobWithData(data: any) {
    const jobs = await this.fallbackQueueService.getJobs([
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

  async resumeQueue() {
    await this.fallbackQueueService.queue.start();
  }

  async pauseQueue() {
    await this.fallbackQueueService.queue.pause();
  }
}
