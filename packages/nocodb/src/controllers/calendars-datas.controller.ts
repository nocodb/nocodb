import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { CalendarDatasService } from '~/services/calendar-datas.service';
import { parseHrtimeToMilliSeconds } from '~/helpers';

import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class CalendarDatasController {
  constructor(private readonly calendarDatasService: CalendarDatasService) {}

  @Get(['/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName'])
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewName') viewId: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.calendarDatasService.getCalendarDataList(context, {
      viewId: viewId,
      query: req.query,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get([
    '/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName/countByDate/',
  ])
  @Acl('dataList')
  async calendarDataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    const startTime = process.hrtime();

    const data = await this.calendarDatasService.getCalendarRecordCount(
      context,
      {
        query: req.query,
        viewId: viewName,
        from_date: fromDate,
        to_date: toDate,
      },
    );

    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(data);
  }

  @Get([
    '/api/v1/db/public/calendar-view/:sharedViewUuid/countByDate',
    '/api/v2/public/calendar-view/:sharedViewUuid/countByDate',
  ])
  async countByDate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.calendarDatasService.getPublicCalendarRecordCount(
      context,
      {
        query: req.query,
        password: req.headers?.['xc-password'] as string,
        sharedViewUuid,
        from_date: fromDate,
        to_date: toDate,
      },
    );
  }

  @Get([
    '/api/v1/db/public/calendar-view/:sharedViewUuid',
    '/api/v2/public/calendar-view/:sharedViewUuid',
  ])
  async getPublicCalendarDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    return await this.calendarDatasService.getPublicCalendarDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      from_date: fromDate,
      to_date: toDate,
    });
  }
}
