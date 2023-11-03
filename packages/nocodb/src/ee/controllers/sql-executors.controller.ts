import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { SqlExecutorStatus } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { SqlExecutor } from '~/models';

@Controller()
export class SqlExecutorsController {
  constructor() {}

  @Patch('/api/v1/sql-executors/:sqlExecutorId/status')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async updateStatus(
    @Req() req,
    @Body()
    body: {
      status: SqlExecutorStatus;
    },
    @Param('sqlExecutorId') sqlExecutorId: string,
  ) {
    if (!body.status) NcError.badRequest('Missing status in body');

    const sqlExecutor = await SqlExecutor.get(sqlExecutorId);

    if (!sqlExecutor) NcError.notFound('SqlExecutor not found');

    return await sqlExecutor.update(body);
  }
}
