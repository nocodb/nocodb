import {
  Body,
  Controller,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { SqlExecutorStatus } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { SqlExecutor } from '~/models';
import { InstanceCommands } from '~/interface/Jobs';

@Controller()
export class SqlExecutorsController {
  constructor(@Inject('JobsService') protected readonly jobsService) {}

  @Patch('/internal/sql-executors/:sqlExecutorId')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async updateStatus(
    @Req() req,
    @Body()
    body: {
      domain?: string;
      status?: SqlExecutorStatus;
      capacity?: number;
      priority?: number;
    },
    @Param('sqlExecutorId') sqlExecutorId: string,
  ) {
    const sqlExecutor = await SqlExecutor.get(sqlExecutorId);

    if (!sqlExecutor) NcError.notFound('SqlExecutor not found');

    const { se, sources } = await sqlExecutor.update(body);

    if (sources) {
      await this.jobsService.emitWorkerCommand(
        InstanceCommands.RELEASE,
        sources.map((s) => s.id).join(','),
      );
      await this.jobsService.emitPrimaryCommand(
        InstanceCommands.RELEASE,
        sources.map((s) => s.id).join(','),
      );
    }

    return se;
  }

  @Patch('/internal/sql-executors')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async bulkUpdate(
    @Req() req,
    @Body()
    body: {
      capacity?: number;
    },
  ) {
    return await SqlExecutor.bulkUpdate(body);
  }
}
