import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { LayoutReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { LayoutsService } from '~/services/dashboards/layouts.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class LayoutsController {
  constructor(private readonly layoutService: LayoutsService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @Acl('layoutGet')
  async layoutGet(@Param('layoutId') layoutId: string) {
    const layout = await this.layoutService.getLayout({
      layoutId,
    });

    return layout;
  }

  @Delete([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @Acl('layoutDelete')
  async layoutDelete(@Param('layoutId') layoutId: string, @Req() req: Request) {
    const result = await this.layoutService.layoutDelete({
      layoutId: layoutId,
      user: (req as any).user,
    });

    return result;
  }

  @Get(['/api/v1/dashboards/:dashboardId/layouts'])
  @Acl('layoutList')
  async layoutList(@Param('dashboardId') dashboardId: string) {
    return new PagedResponseImpl(
      await this.layoutService.getLayouts({
        dashboardId,
      }),
    );
  }

  @Post(['/api/v1/dashboards/:dashboardId/layouts'])
  @HttpCode(200)
  @Acl('layoutCreate')
  async layoutCreate(
    @Param('dashboardId') dashboardId: string,
    @Body() body: LayoutReqType,
  ) {
    const result = await this.layoutService.layoutCreate({
      dashboardId: dashboardId,
      layout: body,
    });

    return result;
  }

  @Patch([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @HttpCode(200)
  @Acl('layoutUpdate')
  async layoutUpdate(
    @Param('layoutId') layoutId: string,
    @Body() body: LayoutReqType,
  ) {
    const result = await this.layoutService.layoutUpdate({
      layoutId,
      layout: body,
    });

    return result;
  }
}
