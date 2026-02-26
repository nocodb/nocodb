import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  DashboardV3DataResponseType,
  DashboardV3GetResponseType,
  DashboardV3ListResponseType,
  WidgetV3ListResponseType,
  WidgetV3Type,
} from '~/services/v3/dashboards-v3.types';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DashboardsV3Service } from '~/services/v3/dashboards-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DashboardsV3Controller {
  constructor(private readonly dashboardsV3Service: DashboardsV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/dashboards`)
  @Acl('dashboardList', { scope: 'base' })
  async dashboardList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ): Promise<DashboardV3ListResponseType> {
    return await this.dashboardsV3Service.dashboardList(context, baseId);
  }

  @Get(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId`)
  @Acl('dashboardGet', { scope: 'base' })
  async dashboardGet(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
    @Query('include') include: string | string[],
  ): Promise<DashboardV3GetResponseType> {
    const includeArr = Array.isArray(include) ? include : [include];

    return await this.dashboardsV3Service.dashboardGet(
      context,
      dashboardId,
      includeArr.includes('widgets'),
    );
  }

  @Get(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/data`)
  @Acl('widgetDataGet', { scope: 'base' })
  async dashboardData(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
    @Request() req: NcRequest,
  ): Promise<DashboardV3DataResponseType> {
    return await this.dashboardsV3Service.dashboardData(
      context,
      dashboardId,
      req,
    );
  }

  @Get(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets`)
  @Acl('widgetList', { scope: 'base' })
  async widgetList(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
  ): Promise<WidgetV3ListResponseType> {
    return await this.dashboardsV3Service.widgetList(context, dashboardId);
  }

  @Get(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets/:widgetId`)
  @Acl('widgetGet', { scope: 'base' })
  async widgetGet(
    @TenantContext() context: NcContext,
    @Param('widgetId') widgetId: string,
  ): Promise<WidgetV3Type> {
    return await this.dashboardsV3Service.widgetGet(context, widgetId);
  }

  @Get(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets/:widgetId/data`)
  @Acl('widgetDataGet', { scope: 'base' })
  async widgetData(
    @TenantContext() context: NcContext,
    @Param('widgetId') widgetId: string,
    @Request() req: NcRequest,
  ): Promise<any> {
    return await this.dashboardsV3Service.widgetData(context, widgetId, req);
  }
}
