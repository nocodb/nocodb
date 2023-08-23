import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LayoutReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import {
  Acl,
  ExtractIdsMiddleware,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { LayoutsService } from '~/services/dashboards/layouts.service';

@Controller()
@UseGuards(ExtractIdsMiddleware, GlobalGuard)
export class LayoutsController {
  constructor(private readonly layoutService: LayoutsService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @Acl('layoutGet')
  async layoutGet(@Param('layoutId') layoutId: string, @Request() _req) {
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
  async layoutDelete(@Param('layoutId') layoutId: string, @Request() req) {
    const result = await this.layoutService.layoutDelete({
      layoutId: layoutId,
      user: (req as any).user,
    });

    return result;
  }

  @Get(['/api/v1/dashboards/:dashboardId/layouts'])
  @Acl('layoutList')
  async layoutList(@Param('dashboardId') dashboardId: string, @Request() _req) {
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
    @Request() _req,
  ) {
    const result = await this.layoutService.layoutUpdate({
      layoutId,
      layout: body,
    });

    return result;
  }
}
