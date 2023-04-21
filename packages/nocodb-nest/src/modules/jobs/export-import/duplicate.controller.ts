import { InjectQueue } from '@nestjs/bull';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Queue } from 'bull';
import { GlobalGuard } from 'src/guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from 'src/middlewares/extract-project-id/extract-project-id.middleware';
import { QueueService } from '../fallback-queue.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class DuplicateController {
  activeQueue;
  constructor(
    @InjectQueue('jobs') private readonly jobsQueue: Queue,
    private readonly fallbackQueueService: QueueService,
  ) {
    this.activeQueue = process.env.NC_REDIS_URL
      ? this.jobsQueue
      : this.fallbackQueueService;
  }

  @Post('/api/v1/db/meta/duplicate/:projectId/:baseId?')
  @HttpCode(200)
  @Acl('duplicateBase')
  async duplicateBase(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('baseId') baseId?: string,
  ) {
    const job = await this.activeQueue.add('duplicate', {
      projectId,
      baseId,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });
    return { id: job.id, name: job.name };
  }
}
