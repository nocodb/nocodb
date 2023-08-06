import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import boxen from 'boxen';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { JobsRedisService } from './jobs-redis.service';
import { JobEvents, JOBS_QUEUE, JobStatus } from '~/interface/Jobs';

@Processor(JOBS_QUEUE)
export class JobsEventService {
  constructor(
    private jobsRedisService: JobsRedisService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.publish(`jobs-${job.id.toString()}`, {
        cmd: JobEvents.STATUS,
        id: job.id.toString(),
        status: JobStatus.ACTIVE,
      });
    } else {
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.ACTIVE,
      });
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(
      boxen(
        `---- !! JOB FAILED !! ----\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
        {
          padding: 1,
          borderStyle: 'double',
          borderColor: 'yellow',
        },
      ),
    );

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.publish(`jobs-${job.id.toString()}`, {
        cmd: JobEvents.STATUS,
        id: job.id.toString(),
        status: JobStatus.FAILED,
        data: {
          error: {
            message: error?.message,
          },
        },
      });
    } else {
      this.jobsRedisService.unsubscribe(`jobs-${job.id.toString()}`);
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.FAILED,
        data: {
          error: {
            message: error?.message,
          },
        },
      });
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job, data: any) {
    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.publish(`jobs-${job.id.toString()}`, {
        cmd: JobEvents.STATUS,
        id: job.id.toString(),
        status: JobStatus.COMPLETED,
        data: {
          result: data,
        },
      });
    } else {
      this.jobsRedisService.unsubscribe(`jobs-${job.id.toString()}`);
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.COMPLETED,
        data: {
          result: data,
        },
      });
    }
  }

  @OnEvent(JobEvents.LOG)
  onLog(data: { id: string; data: { message: string } }) {
    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.publish(`jobs-${data.id}`, {
        cmd: JobEvents.LOG,
        id: data.id,
        data: data.data,
      });
    }
  }
}
