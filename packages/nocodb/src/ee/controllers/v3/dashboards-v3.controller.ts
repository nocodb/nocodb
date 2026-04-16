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
import { NcContext, NcRequest, PlanFeatureTypes } from 'nocodb-sdk';
import type {
  DashboardV3DataResponseType,
  DashboardV3GetResponseType,
  DashboardV3ListResponseType,
  WidgetV3ListResponseType,
  WidgetV3Type,
} from '~/services/v3/dashboards-v3.types';
import {
  DashboardV3CreateRequestType,
  DashboardV3UpdateRequestType,
  WidgetV3CreateRequestType,
  WidgetV3UpdateRequestType,
} from '~/services/v3/dashboards-v3.types';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { DashboardsV3Service } from '~/services/v3/dashboards-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { License } from '~/decorators/license.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License(PlanFeatureTypes.FEATURE_API_DASHBOARD_V3)
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

  @Get(
    `${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets/:widgetId/data`,
  )
  @Acl('widgetDataGet', { scope: 'base' })
  async widgetData(
    @TenantContext() context: NcContext,
    @Param('widgetId') widgetId: string,
    @Request() req: NcRequest,
  ): Promise<unknown> {
    return await this.dashboardsV3Service.widgetData(context, widgetId, req);
  }

  // --- Mutation endpoints ---

  @Post(`${PREFIX_APIV3_METABASE}/dashboards`)
  @HttpCode(200)
  @Acl('dashboardCreate', { scope: 'base' })
  async dashboardCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: DashboardV3CreateRequestType,
    @Request() req: NcRequest,
  ): Promise<DashboardV3GetResponseType> {
    return await this.dashboardsV3Service.dashboardCreate(
      context,
      baseId,
      body,
      req,
    );
  }

  @Patch(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId`)
  @Acl('dashboardUpdate', { scope: 'base' })
  async dashboardUpdate(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
    @Body() body: DashboardV3UpdateRequestType,
    @Request() req: NcRequest,
  ): Promise<DashboardV3GetResponseType> {
    return await this.dashboardsV3Service.dashboardUpdate(
      context,
      dashboardId,
      body,
      req,
    );
  }

  @Delete(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId`)
  @Acl('dashboardDelete', { scope: 'base' })
  async dashboardDelete(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
    @Request() req: NcRequest,
  ): Promise<boolean> {
    return await this.dashboardsV3Service.dashboardDelete(
      context,
      dashboardId,
      req,
    );
  }

  @Post(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets`)
  @HttpCode(200)
  @Acl('widgetCreate', { scope: 'base' })
  async widgetCreate(
    @TenantContext() context: NcContext,
    @Param('dashboardId') dashboardId: string,
    @Body() body: WidgetV3CreateRequestType,
    @Request() req: NcRequest,
  ): Promise<WidgetV3Type> {
    return await this.dashboardsV3Service.widgetCreate(
      context,
      dashboardId,
      body,
      req,
    );
  }

  @Patch(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets/:widgetId`)
  @Acl('widgetUpdate', { scope: 'base' })
  async widgetUpdate(
    @TenantContext() context: NcContext,
    @Param('widgetId') widgetId: string,
    @Body() body: WidgetV3UpdateRequestType,
    @Request() req: NcRequest,
  ): Promise<WidgetV3Type> {
    return await this.dashboardsV3Service.widgetUpdate(
      context,
      widgetId,
      body,
      req,
    );
  }

  @Delete(`${PREFIX_APIV3_METABASE}/dashboards/:dashboardId/widgets/:widgetId`)
  @Acl('widgetDelete', { scope: 'base' })
  async widgetDelete(
    @TenantContext() context: NcContext,
    @Param('widgetId') widgetId: string,
    @Request() req: NcRequest,
  ): Promise<boolean> {
    return await this.dashboardsV3Service.widgetDelete(context, widgetId, req);
  }
}
