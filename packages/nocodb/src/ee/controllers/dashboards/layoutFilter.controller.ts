import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { FilterReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { LayoutFilterService } from '~/services/dashboards/layoutFilter.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class LayoutFilterController {
  constructor(private readonly dashboardFilterService: LayoutFilterService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId/widgets/:widgetId/filters',
  ])
  @Acl('widgetFilterList')
  async filterList(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
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
  @Acl('widgetFilterCreate')
  async filterCreate(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Body() dashboardFilterReq: FilterReqType,
    @Req() req: Request,
  ) {
    const result = await this.dashboardFilterService.filterCreate({
      layoutId,
      widgetId,
      dashboardFilterReq,
      req,
    });

    return result;
  }
}
