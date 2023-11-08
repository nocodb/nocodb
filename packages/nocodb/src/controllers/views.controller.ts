import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ViewUpdateReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ViewsService } from '~/services/views.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get([
    '/api/v1/db/meta/tables/:tableId/views',
    '/api/v2/meta/tables/:tableId/views',
  ])
  @Acl('viewList')
  async viewList(@Param('tableId') tableId: string, @Req() req: Request) {
    return new PagedResponseImpl(
      await this.viewsService.viewList({
        tableId,
        user: req.user,
      }),
    );
  }

  @Patch(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewUpdate')
  async viewUpdate(
    @Param('viewId') viewId: string,
    @Body() body: ViewUpdateReqType,
    @Req() req: Request,
  ) {
    const result = await this.viewsService.viewUpdate({
      viewId,
      view: body,
      user: req.user,
      req,
    });
    return result;
  }

  @Delete(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewDelete')
  async viewDelete(@Param('viewId') viewId: string, @Req() req: Request) {
    const result = await this.viewsService.viewDelete({
      viewId,
      user: req.user,
      req,
    });
    return result;
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/show-all',
    '/api/v2/meta/views/:viewId/show-all',
  ])
  @HttpCode(200)
  @Acl('showAllColumns')
  async showAllColumns(
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[],
  ) {
    return await this.viewsService.showAllColumns({
      viewId,
      ignoreIds,
    });
  }
  @Post([
    '/api/v1/db/meta/views/:viewId/hide-all',
    '/api/v2/meta/views/:viewId/hide-all',
  ])
  @HttpCode(200)
  @Acl('hideAllColumns')
  async hideAllColumns(
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[],
  ) {
    return await this.viewsService.hideAllColumns({
      viewId,
      ignoreIds,
    });
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @HttpCode(200)
  @Acl('shareView')
  async shareView(@Param('viewId') viewId: string, @Req() req: Request) {
    return await this.viewsService.shareView({ viewId, user: req.user, req });
  }

  @Get([
    '/api/v1/db/meta/tables/:tableId/share',
    '/api/v2/meta/tables/:tableId/share',
  ])
  @Acl('shareViewList')
  async shareViewList(@Param('tableId') tableId: string) {
    return new PagedResponseImpl(
      await this.viewsService.shareViewList({
        tableId,
      }),
    );
  }

  @Patch([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewUpdate')
  async shareViewUpdate(
    @Param('viewId') viewId: string,
    @Body() body: ViewUpdateReqType,
    @Req() req: Request,
  ) {
    return await this.viewsService.shareViewUpdate({
      viewId,
      sharedView: body,
      user: req.user,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewDelete')
  async shareViewDelete(@Param('viewId') viewId: string, @Req() req: Request) {
    return await this.viewsService.shareViewDelete({
      viewId,
      user: req.user,
      req,
    });
  }
}
