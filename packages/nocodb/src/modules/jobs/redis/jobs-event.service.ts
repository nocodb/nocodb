import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Processor,
} from '@nestjs/bull';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { JobEvents, JOBS_QUEUE, JobStatus } from '~/interface/Jobs';

@Processor(JOBS_QUEUE)
export class JobsEventService {
  protected logger = new Logger(JobsEventService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.eventEmitter.emit(JobEvents.STATUS, {
      id: job.id.toString(),
      status: JobStatus.ACTIVE,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `---- !! JOB FAILED !! ----\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
    );

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

  @OnQueueCompleted()
  onCompleted(job: Job, data: any) {
    this.eventEmitter.emit(JobEvents.STATUS, {
      id: job.id.toString(),
      status: JobStatus.COMPLETED,
      data: {
        result: data,
      },
    });
  }
}
