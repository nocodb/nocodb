import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { QueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import {
  JobStatus,
  JobTypes,
  JobVersions,
  SKIP_STORING_JOB_META,
} from '~/interface/Jobs';
import { Job } from '~/models';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(private readonly fallbackQueueService: QueueService) {}

  async onModuleInit() {
    await this.add(JobTypes.InitMigrationJobs, {});
  }

  async add(
    name: string,
    data: any,
    options?: {
      jobId?: string;
      delay?: number; // delay in ms
    },
  ) {
    const context = {
      workspace_id: RootScopes.ROOT,
      base_id: RootScopes.ROOT,
      ...(data?.context || {}),
    };

    let jobData;

    if (options?.jobId) {
      const existingJob = await Job.get(context, options.jobId);
      if (existingJob) {
        jobData = existingJob;

        if (existingJob.status !== JobStatus.WAITING) {
          await Job.update(context, existingJob.id, {
            status: JobStatus.WAITING,
          });
        }
      } else {
        if (SKIP_STORING_JOB_META.includes(name as JobTypes)) {
          jobData = {
            id: options.jobId,
          };
        } else {
          jobData = await Job.insert(context, {
            id: `${options.jobId}`,
            job: name,
            status: JobStatus.WAITING,
            fk_user_id: data?.user?.id,
          });
        }
      }
    }

    if (!jobData) {
      if (SKIP_STORING_JOB_META.includes(name as JobTypes)) {
        jobData = {
          id: await Noco.ncMeta.genNanoid(MetaTable.JOBS),
        };
      } else {
        jobData = await Job.insert(context, {
          job: name,
          status: JobStatus.WAITING,
          fk_user_id: data?.user?.id,
        });
      }
    }

    if (!data) {
      data = {};
    }

    data.jobName = name;

    if (JobVersions?.[name]) {
      data._jobVersion = JobVersions[name];
    }

    this.fallbackQueueService.add(name, data, {
      jobId: jobData.id,
      ...options,
    });

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
