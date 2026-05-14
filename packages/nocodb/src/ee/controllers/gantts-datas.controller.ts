import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GanttDatasService } from '~/ee/services/gantt-datas.service';

import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class GanttsDatasController {
  constructor(private readonly ganttDatasService: GanttDatasService) {}

  @Get(['/api/v1/db/gantt-data/:orgs/:baseName/:tableName/views/:viewName'])
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewName') viewId: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.ganttDatasService.getGanttDataList(context, {
      viewId,
      query: req.query,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get([
    '/api/v1/db/public/gantt-view/:sharedViewUuid',
    '/api/v2/public/gantt-view/:sharedViewUuid',
  ])
  async getPublicGanttDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.ganttDatasService.getPublicGanttDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      from_date: fromDate,
      to_date: toDate,
    });
  }
}
