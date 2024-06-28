import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JobStatus } from '~/interface/Jobs';
import { Job } from '~/models';
import { RootScopes } from '~/utils/globals';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(private readonly fallbackQueueService: QueueService) {}

  async onModuleInit() {}

  async add(name: string, data: any) {
    const context = {
      workspace_id: RootScopes.ROOT,
      base_id: RootScopes.ROOT,
      ...(data?.context || {}),
    };

    const { id } = await Job.insert(context, {
      job: name,
      status: JobStatus.WAITING,
      fk_user_id: data?.user?.id,
    });

    return this.fallbackQueueService.add(name, data, { jobId: id });
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
