import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { JOBS_QUEUE, JobStatus } from '~/interface/Jobs';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectQueue(JOBS_QUEUE) protected readonly jobsQueue: Queue,
    protected readonly jobsRedisService: JobsRedisService,
  ) {}

  // pause primary instance queue
  async onModuleInit() {
    if (process.env.NC_WORKER_CONTAINER !== 'true') {
      await this.jobsQueue.pause(true);
      this.jobsRedisService.publish('workers', 'pause');
    } else {
      this.jobsRedisService.workerCallbacks['resumeLocal'] = async () => {
        await this.jobsQueue.resume(true);
      };
      this.jobsRedisService.workerCallbacks['pauseLocal'] = async () => {
        await this.jobsQueue.pause(true);
      };
      this.jobsRedisService.workerCallbacks['resume'] = async () => {
        await this.jobsQueue.resume();
      };
      this.jobsRedisService.workerCallbacks['pause'] = async () => {
        await this.jobsQueue.pause();
      };
    }
  }

  async add(name: string, data: any) {
    // resume primary instance queue if there is no worker
    const workerCount = await this.jobsRedisService.workerCount();
    const localWorkerPaused = await this.jobsQueue.isPaused(true);

    // if there is no worker and primary instance queue is paused, resume it
    // if there is any worker and primary instance queue is not paused, pause it
    if (workerCount === 0 && localWorkerPaused) {
      await this.jobsQueue.resume(true);
    } else if (workerCount > 0 && !localWorkerPaused) {
      await this.jobsQueue.pause(true);
    }

    const job = await this.jobsQueue.add(name, data);

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

  async getJobWithData(data: any) {
    const jobs = await this.jobsQueue.getJobs([
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
    await this.jobsQueue.resume();
  }

  async pauseQueue() {
    await this.jobsQueue.pause();
  }
}
