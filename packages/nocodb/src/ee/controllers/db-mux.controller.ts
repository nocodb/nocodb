import {
  Body,
  Controller,
  Get,
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

@Controller()
export class DbMuxController {
  constructor(@Inject('JobsService') protected readonly jobsService) {}

  @Get('/internal/db-mux')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async listMux() {
    return DbMux.list();
  }

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

    return await dbMux.update(body);
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
