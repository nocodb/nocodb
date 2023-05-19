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
import { FilterReqType } from 'nocodb-sdk';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { GlobalGuard } from '../../guards/global/global.guard';
import extractRolesObj from '../../utils/extractRolesObj';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { DashboardFilterService } from '../../services/dashboards/dashboardFilter.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class DashboardFilterController {
  constructor(
    private readonly dashboardFilterService: DashboardFilterService,
  ) {}

  @Get(['/api/v1/layouts/:layoutId/widgets/:widgetId/filters'])
  @UseAclMiddleware({
    permissionName: 'filterList',
  })
  async filterList(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Request() req,
  ) {
    return new PagedResponseImpl(
      await this.dashboardFilterService.getFilters({
        widgetId,
      }),
    );
  }

  @Post(['/api/v1/layouts/:layoutId/widgets/:widgetId/filters'])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'filterCreate',
  })
  async filterCreate(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Body() dashboardFilterReq: FilterReqType,
    @Request() req,
  ) {
    const result = await this.dashboardFilterService.filterCreate({
      layoutId,
      widgetId,
      dashboardFilterReq,
      // user: req.user,
    });

    return result;
  }
}
