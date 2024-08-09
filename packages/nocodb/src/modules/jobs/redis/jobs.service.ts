import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import {
  InstanceCommands,
  JOBS_QUEUE,
  JobStatus,
  MigrationJobTypes,
} from '~/interface/Jobs';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { Job } from '~/models';
import { RootScopes } from '~/utils/globals';

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

    await this.add(MigrationJobTypes.InitMigrationJobs, {});
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

  async add(name: string, data: any) {
    await this.toggleQueue();

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

    await this.jobsQueue.add(name, data, {
      jobId: jobData.id,
      removeOnComplete: true,
    });

    return jobData;
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
