import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import type { JobOptions } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import {
  InstanceCommands,
  JOBS_QUEUE,
  JobStatus,
  JobTypes,
  JobVersions,
  SKIP_STORING_JOB_META,
} from '~/interface/Jobs';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { Job } from '~/models';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

@Injectable()
export class JobsService implements OnModuleInit {
  protected logger = new Logger(JobsService.name);

  constructor(@InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue) {}

  // pause primary instance queue
  async onModuleInit() {
    if (process.env.NC_WORKER_CONTAINER === 'false') {
      await this.jobsQueue.pause(true);
    }

    await this.toggleQueue();

    JobsRedis.workerCallbacks[InstanceCommands.RESUME_LOCAL] = async () => {
      this.logger.log('Resuming local queue');
      await this.jobsQueue.resume(true);
    };
    JobsRedis.workerCallbacks[InstanceCommands.PAUSE_LOCAL] = async () => {
      this.logger.log('Pausing local queue');
      await this.jobsQueue.pause(true);
    };

    await this.add(JobTypes.InitMigrationJobs, {});
  }

  async toggleQueue() {
    if (
      process.env.NC_WORKER_CONTAINER !== 'true' &&
      process.env.NC_WORKER_CONTAINER !== 'false'
    ) {
      // resume primary instance queue if there is no worker
      const workerCount = await JobsRedis.workerCount();
      const localWorkerPaused = await this.jobsQueue.isPaused(true);

      // if there is no worker and primary instance queue is paused, resume it
      // if there is any worker and primary instance queue is not paused, pause it
      if (workerCount === 0 && localWorkerPaused) {
        await this.jobsQueue.resume(true);
      } else if (workerCount > 0 && !localWorkerPaused) {
        await this.jobsQueue.pause(true);
      }
    }
  }

  async add(name: string, data: any, options?: JobOptions) {
    await this.toggleQueue();

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

    const job = await this.jobsQueue.add(data, {
      jobId: jobData.id,
      ...options,
    });

    return job;
  }

  async jobStatus(jobId: string) {
    const job = await this.jobsQueue.getJob(jobId);
    if (job) {
      return await job.getState();
    }
  }

  async jobList() {
    return await this.jobsQueue.getJobs([
      JobStatus.ACTIVE,
      JobStatus.WAITING,
      JobStatus.DELAYED,
      JobStatus.PAUSED,
    ]);
  }

  async setJobResult(jobId: string, result: any) {
    const job = await Job.get(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      jobId,
    );

    if (!job) {
      return;
    }

    try {
      if (typeof result === 'object') {
        result = JSON.stringify(result);
      }

      await Job.update(
        {
          workspace_id: RootScopes.ROOT,
          base_id: RootScopes.ROOT,
        },
        jobId,
        {
          result,
        },
      );
    } catch (e) {
      // ignore
    }
  }

  async resumeQueue() {
    this.logger.log('Resuming global queue');
    await this.jobsQueue.resume();
  }

  async pauseQueue() {
    this.logger.log('Pausing global queue');
    await this.jobsQueue.pause();
  }

  async emitWorkerCommand(command: InstanceCommands, ...args: any[]) {
    return JobsRedis.emitWorkerCommand(command, ...args);
  }

  async emitPrimaryCommand(command: InstanceCommands, ...args: any[]) {
    return JobsRedis.emitPrimaryCommand(command, ...args);
  }
}
