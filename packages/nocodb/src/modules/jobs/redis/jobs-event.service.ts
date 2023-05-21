import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import boxen from 'boxen';
import { OnEvent } from '@nestjs/event-emitter';
import { JobEvents, JOBS_QUEUE, JobStatus } from '../../../interface/Jobs';
import { JobsRedisService } from './jobs-redis.service';

@Processor(JOBS_QUEUE)
export class JobsEventService {
  constructor(private jobsRedisService: JobsRedisService) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.jobsRedisService.publish(`jobs-${job.id.toString()}`, {
      cmd: JobEvents.STATUS,
      id: job.id.toString(),
      status: JobStatus.ACTIVE,
    });
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
  }

  @OnQueueCompleted()
  onCompleted(job: Job, data: any) {
    this.jobsRedisService.publish(`jobs-${job.id.toString()}`, {
      cmd: JobEvents.STATUS,
      id: job.id.toString(),
      status: JobStatus.COMPLETED,
      data: {
        result: data,
      },
    });
  }

  @OnEvent(JobEvents.LOG)
  onLog(data: { id: string; data: { message: string } }) {
    this.jobsRedisService.publish(`jobs-${data.id}`, {
      cmd: JobEvents.LOG,
      id: data.id,
      data: data.data,
    });
  }
}
