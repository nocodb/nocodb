import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobEvents, JOBS_QUEUE, JobStatus } from '../../../interface/Jobs';
import { JobsRedisService } from './jobs-redis.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue,
    private jobsRedisService: JobsRedisService,
    private eventEmitter: EventEmitter2,
  ) {
    if (!process.env['NC_WORKER_CONTAINER']) {
      this.jobsQueue.pause(true);
    }
  }

  async add(name: string, data: any) {
    const job = await this.jobsQueue.add(name, data);
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
