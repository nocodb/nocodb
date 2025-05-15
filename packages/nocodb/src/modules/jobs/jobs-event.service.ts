import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Processor,
} from '@nestjs/bull';
import { Job as BullJob } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import type { JobTypes } from '~/interface/Jobs';
import {
  JobEvents,
  JOBS_QUEUE,
  JobStatus,
  SKIP_STORING_JOB_META,
} from '~/interface/Jobs';
import { Job } from '~/models';
import { RootScopes } from '~/utils/globals';
import { PubSubRedis } from '~/redis/pubsub-redis';

@Processor(JOBS_QUEUE)
export class JobsEventService {
  protected logger = new Logger(JobsEventService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  public awaitingResults = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    }
  >();

  @OnQueueActive()
  onActive(job: BullJob) {
    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.ACTIVE,
      });
      return;
    }

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
  onFailed(job: BullJob, error: Error & { data: any }) {
    PubSubRedis.publish(`worker:job:${job.id}`, {
      success: false,
      error,
    }).catch((error) => {
      this.logger.error(
        `Failed to publish job result to pubsub: ${error.message}`,
      );
    });

    this.logger.error(
      `---- !! JOB FAILED !! ----\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
    );

    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.FAILED,
        data: {
          error: {
            message: error?.message,
          },
          result: error?.data,
        },
      });
      return;
    }

    Job.update(
      {
        workspace_id: RootScopes.ROOT,
        base_id: RootScopes.ROOT,
      },
      job.id.toString(),
      {
        status: JobStatus.FAILED,
        result: error?.data,
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
            result: error?.data,
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
    PubSubRedis.publish(`worker:job:${job.id}`, {
      success: true,
      result: data,
    }).catch((error) => {
      this.logger.error(
        `Failed to publish job result to pubsub: ${error.message}`,
      );
    });

    // If job was requeued, don't update the status
    if (data === JobStatus.REQUEUED) {
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.REQUEUED,
      });
      return;
    }

    // Don't store job results for certain job types
    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.COMPLETED,
        data: {
          result: data,
        },
      });
      return;
    }

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
