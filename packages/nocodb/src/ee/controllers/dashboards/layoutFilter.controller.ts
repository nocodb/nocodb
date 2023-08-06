import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FilterReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import {
  ExtractIdsMiddleware,
  UseAclMiddleware,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { LayoutFilterService } from '~/services/dashboards/layoutFilter.service';

@Controller()
@UseGuards(ExtractIdsMiddleware, GlobalGuard)
export class LayoutFilterController {
  constructor(private readonly dashboardFilterService: LayoutFilterService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId/widgets/:widgetId/filters',
  ])
  @UseAclMiddleware({
    permissionName: 'widgetFilterList',
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

  @Post([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId/widgets/:widgetId/filters',
  ])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'widgetFilterCreate',
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
