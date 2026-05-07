import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TimelineDatasService } from '~/ee/services/timeline-datas.service';

import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class TimelinesDatasController {
  constructor(private readonly timelineDatasService: TimelineDatasService) {}

  @Get(['/api/v1/db/timeline-data/:orgs/:baseName/:tableName/views/:viewName'])
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewName') viewId: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.timelineDatasService.getTimelineDataList(context, {
      viewId,
      query: req.query,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get([
    '/api/v1/db/public/timeline-view/:sharedViewUuid',
    '/api/v2/public/timeline-view/:sharedViewUuid',
  ])
  async getPublicTimelineDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.timelineDatasService.getPublicTimelineDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      from_date: fromDate,
      to_date: toDate,
    });
  }
}
