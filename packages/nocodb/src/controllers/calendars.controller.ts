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
import { Request } from 'express';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { CalendarsService } from '~/services/calendars.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get([
    '/api/v1/db/meta/calendars/:calendarViewId',
    '/api/v2/meta/calendars/:calendarViewId',
  ])
  // #TODO Enable ACL Later
  // @Acl('calendarViewGet')
  async calendarViewGet(@Param('calendarViewId') calendarViewId: string) {
    return await this.calendarsService.calendarViewGet({
      calendarViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/calendars',
    '/api/v2/meta/tables/:tableId/calendars',
  ])
  @HttpCode(200)
  // #TODO Enable ACL Later
  // @Acl('calendarViewCreate')
  async calendarViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: Request,
  ) {
    return await this.calendarsService.calendarViewCreate({
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
  // #TODO Enable ACL Later
  // @Acl('calendarViewUpdate')
  async calendarViewUpdate(
    @Param('calendarViewId') calendarViewId: string,
    @Body() body,
    @Req() req: Request,
  ) {
    return await this.calendarsService.calendarViewUpdate({
      calendarViewId,
      calendar: body,
      req,
    });
  }
}
