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
import { ViewCreateReqType, TimelineUpdateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TimelinesService } from '~/services/timelines.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  @Get([
    '/api/v1/db/meta/timelines/:timelineViewId',
    '/api/v2/meta/timelines/:timelineViewId',
  ])
  @Acl('timelineViewGet')
  async timelineViewGet(
    @TenantContext() context: NcContext,
    @Param('timelineViewId') timelineViewId: string,
  ) {
    return await this.timelinesService.timelineViewGet(context, {
      timelineViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/timelines',
    '/api/v2/meta/tables/:tableId/timelines',
  ])
  @HttpCode(200)
  @Acl('timelineViewCreate')
  async timelineViewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.timelinesService.timelineViewCreate(context, {
      tableId,
      timeline: body,
      user: req.user,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/timelines/:timelineViewId',
    '/api/v2/meta/timelines/:timelineViewId',
  ])
  @Acl('timelineViewUpdate')
  async timelineViewUpdate(
    @TenantContext() context: NcContext,
    @Param('timelineViewId') timelineViewId: string,
    @Body() body: TimelineUpdateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.timelinesService.timelineViewUpdate(context, {
      timelineViewId,
      timeline: body,
      req,
    });
  }
}
