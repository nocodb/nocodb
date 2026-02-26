import { Injectable } from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  DashboardV3CreateRequestType,
  DashboardV3DataResponseType,
  DashboardV3GetResponseType,
  DashboardV3ListItemType,
  DashboardV3ListResponseType,
  DashboardV3UpdateRequestType,
  WidgetV3CreateRequestType,
  WidgetV3ListResponseType,
  WidgetV3Type,
  WidgetV3UpdateRequestType,
} from '~/services/v3/dashboards-v3.types';
import type { Dashboard, Widget } from '~/models';
import type { WidgetTypes } from 'nocodb-sdk';
import { DashboardsService } from '~/services/dashboards.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { validatePayload } from '~/helpers';

const dashboardBuilder = builderGenerator<Dashboard, DashboardV3GetResponseType>(
  {
    allowed: [
      'id',
      'title',
      'description',
      'base_id',
      'fk_workspace_id',
      'order',
      'meta',
      'created_at',
      'updated_at',
      'created_by',
      'owned_by',
    ],
    mappings: {
      fk_workspace_id: 'workspace_id',
    },
  },
);

const dashboardListItemBuilder = builderGenerator<
  Dashboard,
  DashboardV3ListItemType
>({
  allowed: [
    'id',
    'title',
    'description',
    'base_id',
    'fk_workspace_id',
    'order',
    'meta',
    'created_at',
    'updated_at',
    'created_by',
    'owned_by',
  ],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
});

const widgetBuilder = builderGenerator<Widget, WidgetV3Type>({
  allowed: [
    'id',
    'title',
    'description',
    'fk_dashboard_id',
    'type',
    'config',
    'meta',
    'order',
    'position',
    'fk_model_id',
    'fk_view_id',
    'error',
    'created_at',
    'updated_at',
  ],
  mappings: {
    fk_dashboard_id: 'dashboard_id',
    fk_model_id: 'model_id',
    fk_view_id: 'view_id',
  },
  booleanProps: ['error'],
});

@Injectable()
export class DashboardsV3Service {
  constructor(private readonly dashboardsService: DashboardsService) {}

  private async validateFeatureAccess(context: NcContext) {
    await checkForFeature(
      context,
      PlanFeatureTypes.FEATURE_API_DASHBOARD_V3,
    );
  }

  async dashboardList(
    context: NcContext,
    baseId: string,
  ): Promise<DashboardV3ListResponseType> {
    await this.validateFeatureAccess(context);

    const dashboards = await this.dashboardsService.dashboardList(
      context,
      baseId,
    );

    return {
      list: dashboardListItemBuilder().build(dashboards),
    };
  }

  async dashboardGet(
    context: NcContext,
    dashboardId: string,
    includeWidgets?: boolean,
  ): Promise<DashboardV3GetResponseType> {
    await this.validateFeatureAccess(context);

    const dashboard = await this.dashboardsService.dashboardGet(
      context,
      dashboardId,
    );

    const result = dashboardBuilder().build(dashboard);

    if (includeWidgets && dashboard.widgets) {
      result.widgets = widgetBuilder().build(dashboard.widgets);
    }

    return result;
  }

  async dashboardData(
    context: NcContext,
    dashboardId: string,
    req: NcRequest,
  ): Promise<DashboardV3DataResponseType> {
    await this.validateFeatureAccess(context);

    const widgets = await this.dashboardsService.widgetList(
      context,
      dashboardId,
    );

    const widgetsData: Record<string, unknown> = {};

    for (const widget of widgets) {
      widgetsData[widget.id] = await this.dashboardsService.widgetDataGet(
        context,
        widget.id,
        req,
      );
    }

    return { widgets: widgetsData };
  }

  async widgetList(
    context: NcContext,
    dashboardId: string,
  ): Promise<WidgetV3ListResponseType> {
    await this.validateFeatureAccess(context);

    const widgets = await this.dashboardsService.widgetList(
      context,
      dashboardId,
    );

    return {
      list: widgetBuilder().build(widgets),
    };
  }

  async widgetGet(
    context: NcContext,
    widgetId: string,
  ): Promise<WidgetV3Type> {
    await this.validateFeatureAccess(context);

    const widget = await this.dashboardsService.widgetGet(context, widgetId);

    return widgetBuilder().build(widget);
  }

  async widgetData(
    context: NcContext,
    widgetId: string,
    req: NcRequest,
  ): Promise<any> {
    await this.validateFeatureAccess(context);

    return await this.dashboardsService.widgetDataGet(context, widgetId, req);
  }

  // --- Mutation methods ---

  async dashboardCreate(
    context: NcContext,
    baseId: string,
    body: DashboardV3CreateRequestType,
    req: NcRequest,
  ): Promise<DashboardV3GetResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/DashboardCreateReq',
      body,
      true,
      context,
    );

    const dashboard = await this.dashboardsService.dashboardCreate(
      context,
      { ...body, base_id: baseId },
      req,
    );

    return dashboardBuilder().build(dashboard);
  }

  async dashboardUpdate(
    context: NcContext,
    dashboardId: string,
    body: DashboardV3UpdateRequestType,
    req: NcRequest,
  ): Promise<DashboardV3GetResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/DashboardUpdateReq',
      body,
      true,
      context,
    );

    const dashboard = await this.dashboardsService.dashboardUpdate(
      context,
      dashboardId,
      body,
      req,
    );

    return dashboardBuilder().build(dashboard);
  }

  async dashboardDelete(
    context: NcContext,
    dashboardId: string,
    req: NcRequest,
  ): Promise<boolean> {
    await this.validateFeatureAccess(context);

    return await this.dashboardsService.dashboardDelete(
      context,
      dashboardId,
      req,
    );
  }

  async widgetCreate(
    context: NcContext,
    dashboardId: string,
    body: WidgetV3CreateRequestType,
    req: NcRequest,
  ): Promise<WidgetV3Type> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WidgetCreateReq',
      body,
      true,
      context,
    );

    const mapped = this.mapWidgetRequestToInternal(body);

    const widget = await this.dashboardsService.widgetCreate(
      context,
      { ...mapped, fk_dashboard_id: dashboardId },
      req,
    );

    return widgetBuilder().build(widget);
  }

  async widgetUpdate(
    context: NcContext,
    widgetId: string,
    body: WidgetV3UpdateRequestType,
    req: NcRequest,
  ): Promise<WidgetV3Type> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WidgetUpdateReq',
      body,
      true,
      context,
    );

    const mapped = this.mapWidgetRequestToInternal(body);

    const widget = await this.dashboardsService.widgetUpdate(
      context,
      widgetId,
      mapped,
      req,
    );

    return widgetBuilder().build(widget);
  }

  async widgetDelete(
    context: NcContext,
    widgetId: string,
    req: NcRequest,
  ): Promise<boolean> {
    await this.validateFeatureAccess(context);

    return await this.dashboardsService.widgetDelete(context, widgetId, req);
  }

  private mapWidgetRequestToInternal(
    body: WidgetV3CreateRequestType | WidgetV3UpdateRequestType,
  ): Partial<Widget> {
    const { model_id, view_id, type, ...rest } = body as Record<
      string,
      unknown
    >;
    return {
      ...(rest as Partial<Widget>),
      ...(type !== undefined && { type: type as WidgetTypes }),
      ...(model_id !== undefined && { fk_model_id: model_id as string }),
      ...(view_id !== undefined && { fk_view_id: view_id as string }),
    };
  }
}
