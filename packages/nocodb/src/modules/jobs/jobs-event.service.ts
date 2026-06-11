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
    const emitActive = () =>
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.ACTIVE,
      });

    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      emitActive();
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
      .catch((error) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to active: ${error.message}`,
        );
      })
      .finally(() => emitActive());
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

    const emitFailed = () =>
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

    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      emitFailed();
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
      .catch((updateError) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to failed: ${updateError.message}`,
        );
      })
      .finally(() => emitFailed());
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

    const emitCompleted = () =>
      this.eventEmitter.emit(JobEvents.STATUS, {
        id: job.id.toString(),
        status: JobStatus.COMPLETED,
        data: {
          result: data,
        },
      });

    if (SKIP_STORING_JOB_META.includes(job.data.jobName as JobTypes)) {
      emitCompleted();
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
      .catch((error) => {
        this.logger.error(
          `Failed to update job (${job.id}) status to completed: ${error.message}`,
        );
      })
      .finally(() => emitCompleted());
  }
}
