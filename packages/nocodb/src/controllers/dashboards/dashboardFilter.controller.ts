import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import { FilterReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import { UseAclMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { DashboardFilterService } from '../../services/dashboards/dashboardFilter.service';

@Controller()
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
