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
import type { DbMuxStatus } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { DbMux } from '~/models';
import { InstanceCommands } from '~/interface/Jobs';

@Controller()
export class DbMuxController {
  constructor(@Inject('JobsService') protected readonly jobsService) {}

  @Patch('/internal/db-mux/:dbMuxId')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async updateStatus(
    @Req() req,
    @Body()
    body: {
      domain?: string;
      status?: DbMuxStatus;
      capacity?: number;
      priority?: number;
    },
    @Param('dbMuxId') dbMuxId: string,
  ) {
    const dbMux = await DbMux.get(dbMuxId);

    if (!dbMux) NcError.notFound('DbMux not found');

    const { se, sources } = await dbMux.update(body);

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

  @Patch('/internal/db-mux')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async bulkUpdate(
    @Req() req,
    @Body()
    body: {
      capacity?: number;
    },
  ) {
    return await DbMux.bulkUpdate(body);
  }
}
