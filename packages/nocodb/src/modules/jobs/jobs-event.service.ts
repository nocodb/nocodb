import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Processor,
} from '@nestjs/bull';
import { Job as BullJob } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { JobEvents, JOBS_QUEUE, JobStatus } from '~/interface/Jobs';
import { Job } from '~/models';
import { RootScopes } from '~/utils/globals';

@Processor(JOBS_QUEUE)
export class JobsEventService {
  protected logger = new Logger(JobsEventService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  @OnQueueActive()
  onActive(job: BullJob) {
    Job.update(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      job.id.toString(),
      {
        status: JobStatus.ACTIVE,
      },
    )
      .then(() => {
        this.eventEmitter.emit(JobEvents.STATUS, {
          id: job.id.toString(),
          status: JobStatus.ACTIVE,
        });
      })
      .catch((error) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to active: ${error.message}`,
        );
      });
  }

  @OnQueueFailed()
  onFailed(job: BullJob, error: Error) {
    this.logger.error(
      `---- !! JOB FAILED !! ----\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
    );

    Job.update(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      job.id.toString(),
      {
        status: JobStatus.FAILED,
      },
    )
      .then(() => {
        const newLocal = this;
        newLocal.eventEmitter.emit(JobEvents.STATUS, {
          id: job.id.toString(),
          status: JobStatus.FAILED,
          data: {
            error: {
              message: error?.message,
            },
          },
        });
      })
      .catch((error) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to failed: ${error.message}`,
        );
      });
  }

  @OnQueueCompleted()
  onCompleted(job: BullJob, data: any) {
    Job.update(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      job.id.toString(),
      {
        status: JobStatus.COMPLETED,
        result: data,
      },
    )
      .then(() => {
        this.eventEmitter.emit(JobEvents.STATUS, {
          id: job.id.toString(),
          status: JobStatus.COMPLETED,
          data: {
            result: data,
          },
        });
      })
      .catch((error) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to completed: ${error.message}`,
        );
      });
  }
}
