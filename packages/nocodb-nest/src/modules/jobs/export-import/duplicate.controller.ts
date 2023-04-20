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

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class DuplicateController {
  constructor(
    @InjectQueue('duplicate') private readonly duplicateQueue: Queue,
  ) {}

  @Post('/api/v1/db/meta/duplicate/:projectId/:baseId')
  @HttpCode(200)
  @Acl('duplicateBase')
  async duplicateBase(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('baseId') baseId?: string,
  ) {
    await this.duplicateQueue.add('duplicate', {
      projectId,
      baseId,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });
  }
}
