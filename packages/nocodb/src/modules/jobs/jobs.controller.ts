import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { customAlphabet } from 'nanoid';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Response } from 'express';
import { JobStatus } from '~/interface/Jobs';
import { JobEvents } from '~/interface/Jobs';
import { GlobalGuard } from '~/guards/global/global.guard';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { NcRequest } from '~/interface/config';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const POLLING_INTERVAL = 30000;

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class JobsController implements OnApplicationShutdown {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  private jobRooms = {};
  private localJobs = {};
  private closedJobs = [];

  @Post('/jobs/listen')
  @HttpCode(200)
  async listen(
    @Res() res: Response & { resId?: string },
    @Req() req: NcRequest,
    @Body() body: { _mid: number; data: { id: string } },
  ) {
    const { _mid = 0, data } = body;

    const jobId = data.id;

    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.resId = nanoidv2();

    let messages;

    if (this.localJobs[jobId]) {
      messages = this.localJobs[jobId].messages;
    } else {
      messages = (
        await NocoCache.get(
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

    if (this.closedJobs.includes(jobId)) {
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
                  // close the job after 1 second (to allow the update of messages)
                  setTimeout(() => {
                    this.closedJobs.push(jobId);
                  }, 1000);
                  // remove the job after polling interval * 2
                  setTimeout(() => {
                    this.closedJobs = this.closedJobs.filter(
                      (j) => j !== jobId,
                    );
                  }, POLLING_INTERVAL * 2);
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
    }, POLLING_INTERVAL);
  }

  @OnEvent(JobEvents.STATUS)
  async sendJobStatus(data: {
    id: string;
    status: JobStatus;
    data?: any;
  }): Promise<void> {
    let response;

    const jobId = data.id;

    // clean as it might be taken by another worker
    if (data.status === JobStatus.REQUEUED) {
      if (this.jobRooms[jobId]) {
        this.jobRooms[jobId].listeners.forEach((res) => {
          if (!res.headersSent) {
            res.send({
              status: 'refresh',
            });
          }
        });
      }

      delete this.jobRooms[jobId];
      delete this.localJobs[jobId];
      await NocoCache.del(`${CacheScope.JOBS_POLLING}:${jobId}:messages`);
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

      await NocoCache.set(`${CacheScope.JOBS_POLLING}:${jobId}:messages`, {
        messages: this.localJobs[jobId].messages,
      });
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

      await NocoCache.set(`${CacheScope.JOBS_POLLING}:${jobId}:messages`, {
        messages: this.localJobs[jobId].messages,
      });
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

    if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(data.status)) {
      this.closedJobs.push(jobId);
      setTimeout(() => {
        this.closedJobs = this.closedJobs.filter((j) => j !== jobId);
      }, POLLING_INTERVAL * 2);

      setTimeout(async () => {
        delete this.jobRooms[jobId];
        delete this.localJobs[jobId];
        await NocoCache.del(`${CacheScope.JOBS_POLLING}:${jobId}:messages`);
      }, POLLING_INTERVAL * 2);
    }
  }

  @OnEvent(JobEvents.LOG)
  async sendJobLog(data: {
    id: string;
    data: { message: string };
  }): Promise<void> {
    let response;

    const jobId = data.id;

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

      await NocoCache.set(`${CacheScope.JOBS_POLLING}:${jobId}:messages`, {
        messages: this.localJobs[jobId].messages,
      });
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

      await NocoCache.set(`${CacheScope.JOBS_POLLING}:${jobId}:messages`, {
        messages: this.localJobs[jobId].messages,
      });
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
  }

  async onApplicationShutdown() {
    /*
     * Close all long polling connections
     */
    for (const jobId in this.jobRooms) {
      this.jobRooms[jobId].listeners.forEach((res) => {
        if (!res.headersSent) {
          res.send({
            status: 'close',
          });
        }
      });
    }
  }
}
