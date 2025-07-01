import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Queue } from 'bull';
import { UtilsService } from '~/services/utils.service';
import { InstanceCommands, InstanceTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';

@Controller()
export class WorkerController {
  constructor(
    protected readonly utilsService: UtilsService,
    @Inject('JobsService') private readonly jobsService,
  ) {}

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
      await JobsRedis.publish(
        InstanceTypes.WORKER,
        InstanceCommands.RESUME_LOCAL,
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
      await JobsRedis.publish(
        InstanceTypes.WORKER,
        InstanceCommands.PAUSE_LOCAL,
      );
    }
  }

  @Post('/internal/workers/assign-worker-group')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async assignWorkerGroup(@Body() body: { workerGroupId: string }) {
    await JobsRedis.emitWorkerCommand(
      InstanceCommands.ASSIGN_WORKER_GROUP,
      body.workerGroupId,
    );
  }

  @Post('/internal/workers/stop-other-worker-groups')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async stopOtherWorkerGroups(@Body() body: { workerGroupId: string }) {
    await JobsRedis.emitWorkerCommand(
      InstanceCommands.STOP_OTHER_WORKER_GROUPS,
      body.workerGroupId,
    );
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
