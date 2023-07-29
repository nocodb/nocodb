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
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { GlobalGuard } from '../../guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { LayoutsService } from '~/services/dashboards/layouts.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class LayoutsController {
  constructor(private readonly layoutService: LayoutsService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @UseAclMiddleware({
    permissionName: 'layoutGet',
  })
  async layoutGet(@Param('layoutId') layoutId: string, @Request() req) {
    const layout = await this.layoutService.getLayout({
      layoutId,
    });

    return layout;
  }

  @Delete([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  @UseAclMiddleware({
    permissionName: 'layoutDelete',
  })
  async layoutDelete(@Param('layoutId') layoutId: string, @Request() req) {
    const result = await this.layoutService.layoutDelete({
      layoutId: layoutId,
      user: (req as any).user,
    });

    return result;
  }

  @Get(['/api/v1/dashboards/:dashboardId/layouts'])
  @UseAclMiddleware({
    permissionName: 'layoutList',
  })
  async layoutList(@Param('dashboardId') dashboardId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.layoutService.getLayouts({
        dashboardId,
      }),
    );
  }

  @Post(['/api/v1/dashboards/:dashboardId/layouts'])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'layoutCreate',
  })
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
  @UseAclMiddleware({
    permissionName: 'layoutUpdate',
  })
  async layoutUpdate(
    @Param('layoutId') layoutId: string,
    @Body() body: LayoutReqType,
    @Request() req,
  ) {
    const result = await this.layoutService.layoutUpdate({
      layoutId,
      layout: body,
    });

    return result;
  }
}
