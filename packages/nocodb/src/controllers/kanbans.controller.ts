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
import { KanbansService } from '~/services/kanbans.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class KanbansController {
  constructor(private readonly kanbansService: KanbansService) {}

  @Get([
    '/api/v1/db/meta/kanbans/:kanbanViewId',
    '/api/v2/meta/kanbans/:kanbanViewId',
  ])
  @Acl('kanbanViewGet')
  async kanbanViewGet(
    @TenantContext() context: NcContext,
    @Param('kanbanViewId') kanbanViewId: string,
  ) {
    return await this.kanbansService.kanbanViewGet(context, {
      kanbanViewId,
    });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/kanbans',
    '/api/v2/meta/tables/:tableId/kanbans',
  ])
  @HttpCode(200)
  @Acl('kanbanViewCreate')
  async kanbanViewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.kanbansService.kanbanViewCreate(context, {
      tableId,
      kanban: body,
      user: req.user,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/kanbans/:kanbanViewId',
    '/api/v2/meta/kanbans/:kanbanViewId',
  ])
  @Acl('kanbanViewUpdate')
  async kanbanViewUpdate(
    @TenantContext() context: NcContext,
    @Param('kanbanViewId') kanbanViewId: string,
    @Body() body,

    @Req() req: NcRequest,
  ) {
    return await this.kanbansService.kanbanViewUpdate(context, {
      kanbanViewId,
      kanban: body,
      req,
    });
  }
}
