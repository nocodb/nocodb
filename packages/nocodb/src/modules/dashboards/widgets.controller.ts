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
import { LayoutReqType, WidgetReqType, WidgetUpdateReqType } from 'nocodb-sdk';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import Widget from '../../models/Widget';
import { GlobalGuard } from '../../guards/global/global.guard';
import extractRolesObj from '../../utils/extractRolesObj';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { WidgetsService } from './widgets.service';
import { WidgetDataService } from './widgetData.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class WidgetsController {
  constructor(
    private readonly widgetsService: WidgetsService,
    private readonly widgetDataService: WidgetDataService,
  ) {}

  @Get(['/api/v1/layouts/:layoutId/widgets'])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutListlayoutList',
  // })
  async widgetsList(@Param('layoutId') layoutId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.widgetsService.getWidgets({
        layoutId,
        // roles: extractRolesObj(req.user.roles),
      }),
    );
  }

  @Get(['api/v1/layouts/:layoutId/widgets/:widgetId'])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutListlayoutList',
  // })
  async WidgetsList(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Request() req,
  ) {
    const widgetConfigData = await Widget.get(widgetId);

    const widgetData = await this.widgetDataService.getWidgetData({
      layoutId,
      widgetId,
      // roles: extractRolesObj(req.user.roles),
    });

    return {
      ...widgetConfigData,
      data: widgetData,
    };
  }

  @Post(['/api/v1/layouts/:layoutId/widgets'])
  @HttpCode(200)
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'tableCreate',
  // })
  async widgetCreate(
    @Param('layoutId') layoutId: string,
    @Body() body: WidgetReqType,
    @Request() req,
  ) {
    // TODO: ensure here that the assigned data source is in the list of linked DB projects for this Layout Project
    const result = await this.widgetsService.widgetCreate({
      layoutId,
      widgetReq: body,
      // user: req.user,
    });

    return result;
  }

  @Patch(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  async widgetUpdate(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: WidgetUpdateReqType,
    @Request() req,
  ) {
    // TODO: ensure here that the assigned data source is in the list of linked DB projects for this Layout Project
    const result = await this.widgetsService.widgetUpdate({
      widgetId,
      widgetUpdateReq: body,
      // user: req.user,
    });

    return result;
  }

  @Delete(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  async widgetDelete(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Request() req,
  ) {
    const result = await this.widgetsService.widgetDelete({
      widgetId,
      // user: req.user,
    });

    return result;
  }
}
