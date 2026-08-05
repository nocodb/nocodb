import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { nanoid } from 'nanoid';
import { Timer } from 'nocodb-sdk';
import type { JobData } from '~/interface/Jobs';
import {
  JOB_REQUEUE_LIMIT,
  jobRequeueDelay,
  JOBS_QUEUE,
  JobTypes,
  JobVersions,
  parseWorkerConcurrency,
} from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsMap } from '~/modules/jobs/jobs-map.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus } from '~/interface/Jobs';
import { TelemetryService } from '~/services/telemetry.service';
import {
  acquireLock,
  JOB_LOCK_HEARTBEAT_MS,
  JOB_LOCK_PREFIX,
  JOB_LOCK_TTL_SECONDS,
  releaseLock,
  renewLock,
} from '~/helpers/lockHelpers';

const NC_WORKER_CONCURRENCY = parseWorkerConcurrency(
  process.env.NC_WORKER_CONCURRENCY,
);

const LOCAL_CONCURRENCY_LIMIT = {
  [JobTypes.AtImport]: 2,
  [JobTypes.ThumbnailGenerator]: 1,
  [JobTypes.AttachmentUrlUpload]: 1,
};

export const LOCAL_JOB_COUNT_MAP = new Map<string, number>();

/**
 * Jobs that must never have more than one execution running at a time for a
 * given job id. Bull can re-deliver a "stalled" long-running job while the
 * original execution is still alive; for these jobs a concurrent second run
 * causes real damage (e.g. duplicateBase issues concurrent CREATE TABLE into the
 * same schema → `pg_class_relname_nsp_index` unique violation). Each execution
 * takes a heartbeat-renewed distributed lock keyed on the job id; the loser
 * requeues. Extend this set as other jobs need the same guarantee.
 */
const IDEMPOTENT_JOBS = new Set<string>([JobTypes.DuplicateBase]);

@Processor(JOBS_QUEUE)
export class JobsProcessor {
  private logger = new Logger(JobsProcessor.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly jobsEventService: JobsEventService,
    protected readonly jobsMap: JobsMap,
    protected readonly telemetryService: TelemetryService,
  ) {}

  @Process({
    concurrency: NC_WORKER_CONCURRENCY,
  })
  async process(job: Job<JobData>) {
    const { jobName } = job.data;

    if (!this.jobsMap.jobs[jobName]) {
      this.logger.error(`Job not found for ${jobName}`);
      await this.requeue(job);
      return;
    }

    const { this: processor, fn = 'job' } = this.jobsMap.jobs[jobName];

    if (!processor[fn]) {
      this.logger.error(`Job function not found for ${jobName}`);
      await this.requeue(job);
      return;
    }

    if (JobVersions[jobName] || job.data?._jobVersion) {
      if (JobVersions[jobName] !== job.data._jobVersion) {
        this.logger.error(`Job version mismatch for ${jobName}`);
        await this.requeue(job);
        return;
      }
    }

    const localLimit = LOCAL_CONCURRENCY_LIMIT[jobName];
    const localRunning = LOCAL_JOB_COUNT_MAP.get(jobName) ?? 0;

    if (localLimit !== undefined && localRunning >= localLimit) {
      await this.requeue(job);
      return;
    }

    // Idempotency guard: for allowlisted jobs, hold a heartbeat-renewed
    // distributed lock keyed on the job id so a stalled Bull re-delivery cannot
    // run a second execution concurrently with the original. If the lock is
    // already held by a live sibling, defer via the normal requeue backoff —
    // the sibling either finishes (and this retry no-ops on terminal state) or
    // dies (its lease lapses and this retry takes over).
    const guarded = IDEMPOTENT_JOBS.has(jobName);
    const lockKey = `${JOB_LOCK_PREFIX}${job.id}`;
    const lockId = nanoid();

    if (guarded) {
      const acquired = await acquireLock(
        lockKey,
        lockId,
        0,
        JOB_LOCK_TTL_SECONDS,
      );
      if (!acquired) {
        this.logger.warn(
          `Job '${job.id}' (${jobName}) is already running; requeueing to avoid concurrent execution`,
        );
        await this.requeue(job);
        return;
      }
    }

    let warningTime = 1;
    let incremented = false;
    let longProcessWarning: Timer | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    try {
      longProcessWarning = Timer.start(async (timer) => {
        this.logger.log(
          `Job '${job.id}' is taking ${
            warningTime++ * 10
          } minutes and stil processing`,
        );
        if (warningTime <= 2) {
          timer.start();
        }
      }, 10 * 60 * 1000);

      if (guarded) {
        // Periodic signalling: keep renewing the lease while this execution
        // runs so it never expires under us. unref() prevents the timer from
        // holding the event loop open during shutdown.
        heartbeat = setInterval(() => {
          renewLock(lockKey, lockId, JOB_LOCK_TTL_SECONDS).catch((e) =>
            this.logger.warn(
              `Failed to renew lock for job '${job.id}': ${e.message}`,
            ),
          );
        }, JOB_LOCK_HEARTBEAT_MS);
        heartbeat.unref?.();
      }

      if (localLimit !== undefined) {
        LOCAL_JOB_COUNT_MAP.set(jobName, localRunning + 1);
        incremented = true;
      }

      const result = await processor[fn](job);
      return result;
    } catch (e) {
      this.logger.error(`Error processing job ${jobName}`, e);
      throw e;
    } finally {
      if (incremented) {
        const current = LOCAL_JOB_COUNT_MAP.get(jobName) ?? 1;
        LOCAL_JOB_COUNT_MAP.set(jobName, Math.max(0, current - 1));
      }
      longProcessWarning?.stop();
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (guarded) {
        await releaseLock(lockKey, lockId);
      }
    }
  }

  async requeue(job: Job<JobData>) {
    // Remove the job from the queue otherwise ids will clash
    await job.releaseLock();
    await job.remove();

    const attempt = job.data?._jobAttempt ?? 1;

    if (attempt > JOB_REQUEUE_LIMIT) {
      const message = `Job ${job.data.jobName} dropped after ${JOB_REQUEUE_LIMIT} requeues`;
      const error = Object.assign(new Error(message), {
        data: { dropped: true, attempts: attempt - 1 },
      });
      this.logger.error(message);

      // Surface as FAILED so listeners + nc_jobs row reach a terminal state
      // (otherwise the row sits in WAITING and clients hang on REQUEUED).
      this.jobsEventService.onFailed(job, error as Error & { data: any });

      this.telemetryService
        .sendSystemEvent({
          event_type: 'worker_alert',
          alert_type: 'error',
          message: 'Job dropped after requeue budget exhausted',
          job_name: job.data.jobName,
          job_id: job.id?.toString?.(),
          attempts: attempt - 1,
        })
        .catch((err) => {
          this.logger.error(err.message, err.stack);
        });

      return;
    }

    await this.jobsEventService.onCompleted(job, JobStatus.REQUEUED);

    job.data._jobAttempt = attempt + 1;

    return this.jobsService.add(job.data.jobName, job.data, {
      jobId: job.id.toString(),
      delay: jobRequeueDelay(attempt),
    });
  }
}
