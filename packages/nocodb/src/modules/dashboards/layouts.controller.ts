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
  Request,
  UseGuards,
} from '@nestjs/common';
import { LayoutReqType } from 'nocodb-sdk';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { GlobalGuard } from '../../guards/global/global.guard';
import extractRolesObj from '../../utils/extractRolesObj';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { LayoutsService } from './layouts.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class LayoutsController {
  constructor(private readonly layoutService: LayoutsService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutGet',
  // })
  async layoutGet(@Param('layoutId') layoutId: string, @Request() req) {
    const layout = await this.layoutService.getLayout({
      layoutId,
      // user: req.user,
    });

    return layout;
  }

  @Get(['/api/v1/dashboards/:dashboardId/layouts'])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutListlayoutList',
  // })
  async layoutList(@Param('dashboardId') dashboardId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.layoutService.getLayouts({
        dashboardId,
        // roles: extractRolesObj(req.user.roles),
      }),
    );
  }

  @Post(['/api/v1/dashboards/:dashboardId/layouts'])
  @HttpCode(200)
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'tableCreate',
  // })
  async layoutCreate(
    @Param('dashboardId') dashboardId: string,
    @Body() body: LayoutReqType,
    @Request() req,
  ) {
    const result = await this.layoutService.layoutCreate({
      dashboardId: dashboardId,
      layout: body,
      // user: req.user,
    });

    return result;
  }
}
