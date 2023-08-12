import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobsRedisService } from './jobs-redis.service';
import type { OnModuleInit } from '@nestjs/common';
import { JobEvents, JOBS_QUEUE, JobStatus } from '~/interface/Jobs';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue,
    private jobsRedisService: JobsRedisService,
    private eventEmitter: EventEmitter2,
  ) {}

  // pause primary instance queue
  async onModuleInit() {
    if (process.env.NC_WORKER_CONTAINER !== 'true') {
      await this.jobsQueue.pause(true);
    }
  }

  async add(name: string, data: any) {
    // resume primary instance queue if there is no worker
    const workerCount = (await this.jobsQueue.getWorkers()).length;
    const localWorkerPaused = await this.jobsQueue.isPaused(true);

    // if there is no worker and primary instance queue is paused, resume it
    // if there is any worker and primary instance queue is not paused, pause it
    if (workerCount < 1 && localWorkerPaused) {
      await this.jobsQueue.resume(true);
    } else if (workerCount > 0 && !localWorkerPaused) {
      await this.jobsQueue.pause(true);
    }

    const job = await this.jobsQueue.add(name, data);

    // subscribe to job events
    this.jobsRedisService.subscribe(`jobs-${job.id.toString()}`, (data) => {
      const cmd = data.cmd;
      delete data.cmd;
      switch (cmd) {
        case JobEvents.STATUS:
          this.eventEmitter.emit(JobEvents.STATUS, data);
          if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(data.status)) {
            this.jobsRedisService.unsubscribe(`jobs-${data.id.toString()}`);
          }
          break;
        case JobEvents.LOG:
          this.eventEmitter.emit(JobEvents.LOG, data);
          break;
      }
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
}
