import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import { Job } from '~/models';
import { RootScopes } from '~/utils/globals';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(private readonly fallbackQueueService: QueueService) {}

  async onModuleInit() {
    await this.add(JobTypes.InitMigrationJobs, {});
  }

  async add(name: string, data: any) {
    const context = {
      workspace_id: RootScopes.ROOT,
      base_id: RootScopes.ROOT,
      ...(data?.context || {}),
    };

    const jobData = await Job.insert(context, {
      job: name,
      status: JobStatus.WAITING,
      fk_user_id: data?.user?.id,
    });

    data.jobName = name;

    this.fallbackQueueService.add(name, data, { jobId: jobData.id });

    return jobData;
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

  async resumeQueue() {
    await this.fallbackQueueService.queue.start();
  }

  async pauseQueue() {
    await this.fallbackQueueService.queue.pause();
  }
}
