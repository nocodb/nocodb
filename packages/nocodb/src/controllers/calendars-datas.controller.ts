import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { CalendarDatasService } from '~/services/calendar-datas.service';
import Acl from '~/utils/acl';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class CalendarDatasController {
  constructor(private readonly calendarDatasService: CalendarDatasService) {}

  @Get(['/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName'])
  @Acl('dataList')
  async dataList(@Req() req: Request, @Param('viewName') viewId: string) {
    return await this.calendarDatasService.getCalendarDataList({
      viewId: viewId,
      query: req.query,
    });
  }

  @Get([
    '/api/v1/db/calendar-data/:orgs/:baseName/:tableName/countByDate/',
    '/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName/countByDate/',
  ])
  @Acl('dataList')
  async calendarDataCount(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    const startTime = process.hrtime();

    const data = await this.calendarDatasService.getCalendarRecordCount({
      query: req.query,
      viewId: viewName,
    });

    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(data);
  }
}
