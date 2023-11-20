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
import { Request } from 'express';
import { OnEvent } from '@nestjs/event-emitter';
import { customAlphabet } from 'nanoid';
import { ModuleRef } from '@nestjs/core';
import { JobsRedisService } from './redis/jobs-redis.service';
import type { Response } from 'express';
import type { OnModuleInit } from '@nestjs/common';
import { JobStatus } from '~/interface/Jobs';
import { JobEvents } from '~/interface/Jobs';
import { GlobalGuard } from '~/guards/global/global.guard';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const POLLING_INTERVAL = 30000;

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class JobsController implements OnModuleInit {
  jobsRedisService: JobsRedisService;

  constructor(
    @Inject('JobsService') private readonly jobsService,
    private moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    if (process.env.NC_REDIS_JOB_URL) {
      this.jobsRedisService = this.moduleRef.get(JobsRedisService);
    }
  }

  private jobRooms = {};
  private localJobs = {};
  private closedJobs = [];

  @Post('/jobs/listen')
  @HttpCode(200)
  async listen(
    @Res() res: Response & { resId?: string },
    @Req() req: Request,
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
          `${CacheScope.JOBS}:${jobId}:messages`,
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
      if (this.jobsRedisService) {
        this.jobsRedisService.subscribe(jobId, (data) => {
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
                this.jobsRedisService.unsubscribe(jobId);
                delete this.jobRooms[jobId];
                this.closedJobs.push(jobId);
                setTimeout(() => {
                  this.closedJobs = this.closedJobs.filter((j) => j !== jobId);
                }, POLLING_INTERVAL * 2);
              }
              break;
          }
        });
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

  @Post('/jobs/status')
  async status(@Body() data: { id: string } | any) {
    let res: {
      id?: string;
      status?: JobStatus;
    } | null = null;
    if (Object.keys(data).every((k) => ['id'].includes(k)) && data?.id) {
      const rooms = (await this.jobsService.jobList()).map(
        (j) => `jobs-${j.id}`,
      );
      const room = rooms.find((r) => r === `jobs-${data.id}`);
      if (room) {
        res.id = data.id;
      }
    } else {
      const job = await this.jobsService.getJobWithData(data);
      if (job) {
        res = {};
        res.id = job.id;
        res.status = await this.jobsService.jobStatus(data.id);
      }
    }

    return res;
  }

  @OnEvent(JobEvents.STATUS)
  sendJobStatus(data: { id: string; status: JobStatus; data?: any }): void {
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

      NocoCache.set(`${CacheScope.JOBS}:${jobId}:messages`, {
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

      NocoCache.set(`${CacheScope.JOBS}:${jobId}:messages`, {
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

    if (this.jobsRedisService) {
      this.jobsRedisService.publish(jobId, {
        cmd: JobEvents.STATUS,
        ...data,
      });
    }

    if ([JobStatus.COMPLETED, JobStatus.FAILED].includes(data.status)) {
      this.closedJobs.push(jobId);
      setTimeout(() => {
        this.closedJobs = this.closedJobs.filter((j) => j !== jobId);
      }, POLLING_INTERVAL * 2);

      setTimeout(() => {
        delete this.jobRooms[jobId];
        delete this.localJobs[jobId];
        NocoCache.del(`${CacheScope.JOBS}:${jobId}:messages`);
      }, POLLING_INTERVAL * 2);
    }
  }

  @OnEvent(JobEvents.LOG)
  sendJobLog(data: { id: string; data: { message: string } }): void {
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

      NocoCache.set(`${CacheScope.JOBS}:${jobId}:messages`, {
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

      NocoCache.set(`${CacheScope.JOBS}:${jobId}:messages`, {
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

    if (this.jobsRedisService) {
      this.jobsRedisService.publish(jobId, {
        cmd: JobEvents.LOG,
        ...data,
      });
    }
  }
}
