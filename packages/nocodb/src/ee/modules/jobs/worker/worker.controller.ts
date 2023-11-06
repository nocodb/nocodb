import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ModuleRef } from '@nestjs/core';
import type { OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';
import { UtilsService } from '~/services/utils.service';
import { InstanceTypes, WorkerCommands } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class WorkerController implements OnModuleInit {
  jobsRedisService: JobsRedisService;

  constructor(
    protected readonly utilsService: UtilsService,
    @Inject('JobsService') private readonly jobsService,
    private moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    if (process.env.NC_REDIS_JOB_URL) {
      this.jobsRedisService = this.moduleRef.get(JobsRedisService);
    }
  }

  @Get('/api/v1/health')
  async appHealth() {
    return await this.utilsService.appHealth();
  }

  // reference: https://github.com/OptimalBits/bull/blob/develop/REFERENCE.md#queueresume
  @Post('/internal/workers/resume')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async resumeWorkers(@Body() body: { global?: boolean }) {
    if (body.global === true) {
      await this.jobsService.resumeQueue();
    } else {
      await this.jobsRedisService.publish(
        InstanceTypes.WORKER,
        WorkerCommands.RESUME_LOCAL,
      );
    }
  }

  // reference: https://github.com/OptimalBits/bull/blob/develop/REFERENCE.md#queuepause
  @Post('/internal/workers/pause')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async pauseWorkers(@Body() body: { global?: boolean }) {
    if (body.global === true) {
      await this.jobsService.pauseQueue();
    } else {
      await this.jobsRedisService.publish(
        InstanceTypes.WORKER,
        WorkerCommands.PAUSE_LOCAL,
      );
    }
  }

  @Get('/internal/workers/status')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async workerStatus() {
    const queue = this.jobsService.jobsQueue as Queue;
    const status = (await queue.isPaused(true)) ? 'paused' : 'active';
    const hasRunningJobs = await new Promise((resolve) => {
      queue.whenCurrentJobsFinished().then(() => {
        resolve(false);
      });
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });

    return {
      status,
      hasRunningJobs,
    };
  }

  @Get('/internal/workers/metrics')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async workerMetrics() {
    const queue = this.jobsService.jobsQueue as Queue;
    return {
      queueStatus: (await queue.isPaused()) ? 'paused' : 'active',
      jobCounts: await queue.getJobCounts(),
      timestamp: Date.now(),
    };
  }
}
