import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { customAlphabet } from 'nanoid';
import type { OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
import { JobEvents, JobStatus, UNPOLLED_JOB_TYPES } from '~/interface/Jobs';
import { GlobalGuard } from '~/guards/global/global.guard';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, RootScopes } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import Job from '~/models/Job';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { NcRequest } from '~/interface/config';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const POLLING_INTERVAL = 30000;
// How long a finished job stays answerable to late polls.
const CLOSED_JOB_RETENTION = POLLING_INTERVAL * 2;

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class JobsController implements OnModuleDestroy {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  onModuleDestroy() {
    clearInterval(this.sweepTimer);
    Object.keys(this.jobRooms).forEach((jobId) => {
      const room = this.jobRooms[jobId];
      room.listeners.forEach((res: Response & { resId?: string }) => {
        if (!res.headersSent) {
          res.send({ status: 'refresh' });
        }
      });
    });
  }

  private readonly logger = new Logger(JobsController.name);

  private jobRooms = {};
  private localJobs = {};
  // jobId → when it starts answering `close`, and when its state is dropped
  private closedJobs = new Map<string, { from: number; until: number }>();

  private sweepTimer = setInterval(
    () => this.sweepClosedJobs(),
    POLLING_INTERVAL,
  ).unref();

  private markClosed(jobId: string, delay = 0) {
    const now = Date.now();
    // the worker and the Redis relay can both close it in one process
    const prev = this.closedJobs.get(jobId);
    this.closedJobs.set(jobId, {
      from: Math.min(prev?.from ?? Infinity, now + delay),
      until: prev?.until ?? now + CLOSED_JOB_RETENTION,
    });
  }

  private sweepClosedJobs() {
    const now = Date.now();
    for (const [jobId, { until }] of this.closedJobs) {
      if (until > now) continue;
      this.closedJobs.delete(jobId);
      delete this.jobRooms[jobId];
      if (this.localJobs[jobId]) {
        delete this.localJobs[jobId];
        NocoCache.del(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
        ).catch(() => {});
      }
    }
  }

  /**
   * `GlobalGuard` falls back to a guest user instead of rejecting, so this route
   * is reachable with no credentials — and job messages carry presigned export
   * download URLs. Bind the poll to the job's owner, and 404 rather than 403 so
   * a job's existence isn't confirmed either.
   *
   * A public-share export job is created by an anonymous caller and so has no
   * owner to match; its unguessable id is the only capability that caller holds,
   * so ownerless jobs stay readable.
   */
  private async assertJobReadable(jobId: string, req: NcRequest) {
    const job = await Job.get(
      { workspace_id: RootScopes.ROOT, base_id: RootScopes.ROOT },
      jobId,
    );

    if (job?.fk_user_id && job.fk_user_id !== req.user?.id) {
      NcError.get().genericNotFound('Job', jobId);
    }
  }

  @Post('/jobs/listen')
  @HttpCode(200)
  async listen(
    @Res() res: Response & { resId?: string },
    @Req() req: NcRequest,
    @Body() body: { _mid: number; data: { id: string } },
  ) {
    const { _mid = 0, data } = body;

    const jobId = data.id;

    await this.assertJobReadable(jobId, req);

    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.resId = nanoidv2();

    let messages;

    if (this.localJobs[jobId]) {
      messages = this.localJobs[jobId].messages;
    } else {
      messages = (
        await NocoCache.get(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
          CacheGetType.TYPE_OBJECT,
        )
      )?.messages;
    }

    const newMessages: any[] = [];

    if (messages) {
      messages.forEach((m) => {
        if (m._mid > _mid) {
          newMessages.push(m);
        }
      });
    }

    if (newMessages.length > 0) {
      res.send(newMessages);
      return;
    }

    if ((this.closedJobs.get(jobId)?.from ?? Infinity) <= Date.now()) {
      res.send({
        status: 'close',
      });
      return;
    }

    if (this.jobRooms[jobId]) {
      this.jobRooms[jobId].listeners.push(res);
    } else {
      this.jobRooms[jobId] = {
        listeners: [res],
      };
      // subscribe to job events
      if (JobsRedis.available) {
        const unsubscribeCallback = await JobsRedis.subscribe(
          jobId,
          async (data) => {
            if (this.jobRooms[jobId]) {
              this.jobRooms[jobId].listeners.forEach((res) => {
                if (!res.headersSent) {
                  res.send({
                    status: 'refresh',
                  });
                }
              });
            }

            const cmd = data.cmd;
            delete data.cmd;
            switch (cmd) {
              case JobEvents.STATUS:
                if (
                  [JobStatus.COMPLETED, JobStatus.FAILED].includes(data.status)
                ) {
                  await unsubscribeCallback();
                  delete this.jobRooms[jobId];
                  // close after 1s so the final messages land first
                  this.markClosed(jobId, 1000);
                }
                break;
            }
          },
        );
      }
    }

    res.on('close', () => {
      if (jobId && this.jobRooms[jobId]?.listeners) {
        this.jobRooms[jobId].listeners = this.jobRooms[jobId].listeners.filter(
          (r) => r.resId !== (res as any).resId,
        );
      }
    });

    setTimeout(() => {
      if (!res.headersSent) {
        res.send({
          status: 'refresh',
        });
      }
    }, POLLING_INTERVAL).unref();
  }

  @OnEvent(JobEvents.STATUS)
  async sendJobStatus({
    jobName,
    ...data
  }: {
    id: string;
    jobName?: string;
    status: JobStatus;
    data?: any;
  }): Promise<void> {
    if (UNPOLLED_JOB_TYPES.has(jobName)) return;

    let response;

    const jobId = data.id;

    const isRequeued = data.status === JobStatus.REQUEUED;
    const isTerminal = [JobStatus.COMPLETED, JobStatus.FAILED].includes(
      data.status,
    );

    try {
      // clean as it might be taken by another worker
      if (isRequeued) {
        if (this.jobRooms[jobId]) {
          this.jobRooms[jobId].listeners.forEach((res) => {
            if (!res.headersSent) {
              res.send({
                status: 'refresh',
              });
            }
          });
        }
        // per-job state is freed in the finally block below
        return;
      }

      if (this.localJobs[jobId]) {
        response = {
          status: 'update',
          data,
          _mid: ++this.localJobs[jobId]._mid,
        };
        this.localJobs[jobId].messages.push(response);

        // limit to 20 messages
        if (this.localJobs[jobId].messages.length > 20) {
          this.localJobs[jobId].messages.shift();
        }

        await NocoCache.set(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
          {
            messages: this.localJobs[jobId].messages,
          },
        );
      } else {
        response = {
          status: 'update',
          data,
          _mid: 1,
        };

        this.localJobs[jobId] = {
          messages: [response],
          _mid: 1,
        };

        await NocoCache.set(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
          {
            messages: this.localJobs[jobId].messages,
          },
        );
      }

      if (this.jobRooms[jobId]) {
        this.jobRooms[jobId].listeners.forEach((res) => {
          if (!res.headersSent) {
            res.send(response);
          }
        });
      }

      if (JobsRedis.available) {
        await JobsRedis.publish(jobId, {
          cmd: JobEvents.STATUS,
          ...data,
        });
      }
    } catch (e) {
      // This is a fire-and-forget @OnEvent handler: a thrown/rejected error
      // becomes an unhandledRejection (which crashes the process) AND skips the
      // per-job state cleanup below — orphaning localJobs/jobRooms entries on
      // every failure. Under high job-failure churn that is a slow heap leak
      // (esp. on worker containers). Swallow + log; the finally still frees it.
      this.logger.error(
        `Failed to relay status for job ${jobId}: ${(e as Error).message}`,
        (e as Error).stack,
      );
    } finally {
      // Always free per-job in-memory state on a terminal/requeued status, even
      // if an awaited cache/publish above threw. A missing Redis round-trip must
      // never leave localJobs/jobRooms entries (and their retained message
      // payloads) resident forever.
      if (isRequeued) {
        delete this.jobRooms[jobId];
        delete this.localJobs[jobId];
        await NocoCache.del(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
        ).catch(() => {});
      } else if (isTerminal) {
        // jobRooms, localJobs and the cached messages go with it in the sweep
        this.markClosed(jobId);
      }
    }
  }

  @OnEvent(JobEvents.LOG)
  async sendJobLog({
    jobName,
    ...data
  }: {
    id: string;
    jobName?: string;
    data: { message: string };
  }): Promise<void> {
    // no terminal status reaches markClosed for these, so localJobs would never be swept
    if (UNPOLLED_JOB_TYPES.has(jobName)) return;

    let response;

    const jobId = data.id;

    // Fire-and-forget @OnEvent handler — a rejected cache/publish here would
    // become an unhandledRejection (process crash). Swallow + log instead.
    try {
      if (this.localJobs[jobId]) {
        response = {
          status: 'update',
          data,
          _mid: ++this.localJobs[jobId]._mid,
        };

        this.localJobs[jobId].messages.push(response);

        // limit to 20 messages
        if (this.localJobs[jobId].messages.length > 20) {
          this.localJobs[jobId].messages.shift();
        }

        await NocoCache.set(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
          {
            messages: this.localJobs[jobId].messages,
          },
        );
      } else {
        response = {
          status: 'update',
          data,
          _mid: 1,
        };

        this.localJobs[jobId] = {
          messages: [response],
          _mid: 1,
        };

        await NocoCache.set(
          'root',
          `${CacheScope.JOBS_POLLING}:${jobId}:messages`,
          {
            messages: this.localJobs[jobId].messages,
          },
        );
      }

      if (this.jobRooms[jobId]) {
        this.jobRooms[jobId].listeners.forEach((res) => {
          if (!res.headersSent) {
            res.send(response);
          }
        });
      }

      if (JobsRedis.available) {
        await JobsRedis.publish(jobId, {
          cmd: JobEvents.LOG,
          ...data,
        });
      }
    } catch (e) {
      this.logger.error(
        `Failed to relay log for job ${jobId}: ${(e as Error).message}`,
        (e as Error).stack,
      );
    }
  }
}
