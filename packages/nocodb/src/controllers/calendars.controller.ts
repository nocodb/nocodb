import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { CalendarsService } from '~/services/calendars.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get([
    '/api/v1/db/meta/calendars/:calendarViewId',
    '/api/v2/meta/calendars/:calendarViewId',
  ])
  @Acl('calendarViewGet')
  async calendarViewGet(
    @TenantContext() context: NcContext,
    @Param('calendarViewId') calendarViewId: string,
  ) {
    return await this.calendarsService.calendarViewGet(context, {
      calendarViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/calendars',
    '/api/v2/meta/tables/:tableId/calendars',
  ])
  @HttpCode(200)
  @Acl('calendarViewCreate')
  async calendarViewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.calendarsService.calendarViewCreate(context, {
      tableId,
      calendar: body,
      user: req.user,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/calendars/:calendarViewId',
    '/api/v2/meta/calendars/:calendarViewId',
  ])
  @Acl('calendarViewUpdate')
  async calendarViewUpdate(
    @TenantContext() context: NcContext,
    @Param('calendarViewId') calendarViewId: string,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    return await this.calendarsService.calendarViewUpdate(context, {
      calendarViewId,
      calendar: body,
      req,
    });
  }
}
