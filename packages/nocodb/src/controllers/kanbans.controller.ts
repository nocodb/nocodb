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
import { KanbansService } from '~/services/kanbans.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class KanbansController {
  constructor(private readonly kanbansService: KanbansService) {}

  @Get([
    '/api/v1/db/meta/kanbans/:kanbanViewId',
    '/api/v2/meta/kanbans/:kanbanViewId',
  ])
  @Acl('kanbanViewGet')
  async kanbanViewGet(@Param('kanbanViewId') kanbanViewId: string) {
    return await this.kanbansService.kanbanViewGet({
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
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: Request,
  ) {
    return await this.kanbansService.kanbanViewCreate({
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
    @Param('kanbanViewId') kanbanViewId: string,
    @Body() body,

    @Req() req: Request,
  ) {
    return await this.kanbansService.kanbanViewUpdate({
      kanbanViewId,
      kanban: body,
      req,
    });
  }
}
