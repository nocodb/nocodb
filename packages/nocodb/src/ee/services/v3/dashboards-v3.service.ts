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
import {
  ApiV3DataTransformationBuilder,
  builderGenerator,
} from '~/utils/api-v3-data-transformation.builder';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { validatePayload } from '~/helpers';

const TEXT_WIDGET_TYPE = 'text';

// --- Manual key mapping helpers ---

/**
 * Renames specific keys in a flat object (one level only, no recursion).
 * Keys not in the map pass through unchanged.
 */
function renameKeys(
  obj: Record<string, any>,
  keyMap: Record<string, string>,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[keyMap[key] ?? key] = value;
  }
  return result;
}

function invertMapping(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}

// Mapping tables: camelCase → snake_case (per nesting level)

const CONFIG_KEYS: Record<string, string> = {
  chartType: 'chart_type',
  dataSource: 'data_source',
  allowFullscreen: 'allow_fullscreen',
};

const DATA_KEYS: Record<string, string> = {
  xAxis: 'x_axis',
  yAxis: 'y_axis',
};

const CATEGORY_AXIS_KEYS: Record<string, string> = {
  orderBy: 'order_by',
  categoryLimit: 'category_limit',
  includeEmptyRecords: 'include_empty_records',
  includeOthers: 'include_others',
  sortBy: 'sort_by',
};

const Y_AXIS_KEYS: Record<string, string> = {
  startAtZero: 'start_at_zero',
  groupBy: 'group_by',
};

const APPEARANCE_KEYS: Record<string, string> = {
  showCountInLegend: 'show_count_in_legend',
  showPercentageOnChart: 'show_percentage_on_chart',
  showValueInChart: 'show_value_in_chart',
  legendPosition: 'legend_position',
  colorSchema: 'color_schema',
  customColorSchema: 'custom_color_schema',
  smoothLines: 'smooth_lines',
  plotDataPoints: 'plot_data_points',
  showValue: 'show_value',
};

const PERMISSIONS_KEYS: Record<string, string> = {
  allowUserToPrint: 'allow_user_to_print',
  allowUsersToViewRecords: 'allow_users_to_view_records',
};

const FORMATTING_KEYS: Record<string, string> = {
  horizontalAlign: 'horizontal_align',
  verticalAlign: 'vertical_align',
};

const FONT_KEYS: Record<string, string> = {
  lineHeight: 'line_height',
};

// column_id → field_id mapping for v3 API (x_axis, y_axis.fields[])
const COLUMN_TO_FIELD_KEYS: Record<string, string> = {
  column_id: 'field_id',
};

// Pre-computed inverse mappings (snake_case → camelCase)
const INV_CONFIG_KEYS = invertMapping(CONFIG_KEYS);
const INV_DATA_KEYS = invertMapping(DATA_KEYS);
const INV_CATEGORY_AXIS_KEYS = invertMapping(CATEGORY_AXIS_KEYS);
const INV_Y_AXIS_KEYS = invertMapping(Y_AXIS_KEYS);
const INV_APPEARANCE_KEYS = invertMapping(APPEARANCE_KEYS);
const INV_PERMISSIONS_KEYS = invertMapping(PERMISSIONS_KEYS);
const INV_FORMATTING_KEYS = invertMapping(FORMATTING_KEYS);
const INV_FONT_KEYS = invertMapping(FONT_KEYS);
const INV_COLUMN_TO_FIELD_KEYS = invertMapping(COLUMN_TO_FIELD_KEYS);

/**
 * Convert widget config from internal camelCase to API snake_case.
 * Explicit per-level key renaming — no recursive case transformation.
 */
function mapConfigToSnakeCase(
  config: Record<string, any>,
): Record<string, any> {
  if (!config) return config;

  const result = renameKeys(config, CONFIG_KEYS);

  if (result.data && typeof result.data === 'object') {
    const data = renameKeys(result.data, DATA_KEYS);

    if (data.category && typeof data.category === 'object') {
      data.category = renameKeys(data.category, CATEGORY_AXIS_KEYS);
    }
    if (data.x_axis && typeof data.x_axis === 'object') {
      data.x_axis = renameKeys(data.x_axis, CATEGORY_AXIS_KEYS);
      data.x_axis = renameKeys(data.x_axis, COLUMN_TO_FIELD_KEYS);
    }
    if (data.y_axis && typeof data.y_axis === 'object') {
      data.y_axis = renameKeys(data.y_axis, Y_AXIS_KEYS);
      if (Array.isArray(data.y_axis.fields)) {
        data.y_axis.fields = data.y_axis.fields.map((f: Record<string, any>) =>
          renameKeys(f, COLUMN_TO_FIELD_KEYS),
        );
      }
    }

    result.data = data;
  }

  if (result.appearance && typeof result.appearance === 'object') {
    const appearance = renameKeys(result.appearance, APPEARANCE_KEYS);

    if (appearance.formatting && typeof appearance.formatting === 'object') {
      appearance.formatting = renameKeys(
        appearance.formatting,
        FORMATTING_KEYS,
      );
    }
    if (appearance.font && typeof appearance.font === 'object') {
      appearance.font = renameKeys(appearance.font, FONT_KEYS);
    }

    result.appearance = appearance;
  }

  if (result.permissions && typeof result.permissions === 'object') {
    result.permissions = renameKeys(result.permissions, PERMISSIONS_KEYS);
  }

  return result;
}

/**
 * Convert widget config from API snake_case to internal camelCase.
 * Explicit per-level key renaming — no recursive case transformation.
 */
function mapConfigToCamelCase(
  config: Record<string, any>,
): Record<string, any> {
  if (!config) return config;

  const result = renameKeys(config, INV_CONFIG_KEYS);

  if (result.data && typeof result.data === 'object') {
    const data = renameKeys(result.data, INV_DATA_KEYS);

    if (data.category && typeof data.category === 'object') {
      data.category = renameKeys(data.category, INV_CATEGORY_AXIS_KEYS);
    }
    if (data.xAxis && typeof data.xAxis === 'object') {
      data.xAxis = renameKeys(data.xAxis, INV_CATEGORY_AXIS_KEYS);
      data.xAxis = renameKeys(data.xAxis, INV_COLUMN_TO_FIELD_KEYS);
    }
    if (data.yAxis && typeof data.yAxis === 'object') {
      data.yAxis = renameKeys(data.yAxis, INV_Y_AXIS_KEYS);
      if (Array.isArray(data.yAxis.fields)) {
        data.yAxis.fields = data.yAxis.fields.map((f: Record<string, any>) =>
          renameKeys(f, INV_COLUMN_TO_FIELD_KEYS),
        );
      }
    }

    result.data = data;
  }

  if (result.appearance && typeof result.appearance === 'object') {
    const appearance = renameKeys(result.appearance, INV_APPEARANCE_KEYS);

    if (appearance.formatting && typeof appearance.formatting === 'object') {
      appearance.formatting = renameKeys(
        appearance.formatting,
        INV_FORMATTING_KEYS,
      );
    }
    if (appearance.font && typeof appearance.font === 'object') {
      appearance.font = renameKeys(appearance.font, INV_FONT_KEYS);
    }

    result.appearance = appearance;
  }

  if (result.permissions && typeof result.permissions === 'object') {
    result.permissions = renameKeys(result.permissions, INV_PERMISSIONS_KEYS);
  }

  return result;
}

const dashboardBuilder = builderGenerator<
  Dashboard,
  DashboardV3GetResponseType
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
    meta: 'options',
  },
});

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
    meta: 'options',
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
    config: 'options',
    fk_model_id: 'model_id',
    fk_view_id: 'view_id',
  },
  booleanProps: ['error'],
  transformFn: (data) => {
    let result = data;

    // Text widget: move formatting into appearance
    if (result.type === TEXT_WIDGET_TYPE && result.options) {
      const { formatting, appearance, ...restOptions } =
        result.options as Record<string, any>;

      if (formatting) {
        result = {
          ...result,
          options: {
            ...restOptions,
            appearance: {
              ...(appearance || {}),
              formatting,
            },
          },
        };
      }
    }

    // Convert camelCase config keys to snake_case for API response
    if (result.options && typeof result.options === 'object') {
      result = {
        ...result,
        options: mapConfigToSnakeCase(result.options as Record<string, any>),
      };
    }

    return result;
  },
});

/**
 * Reverse transform for text widget options from v3 API request:
 * Extracts `appearance.formatting` back to a sibling `formatting` key
 */
const widgetOptionsRequestBuilder = () =>
  new ApiV3DataTransformationBuilder()
    // First: convert snake_case request keys to internal camelCase
    .customTransform((options: Record<string, unknown>) => {
      return mapConfigToCamelCase(options as Record<string, any>);
    })
    // Second: text widget — extract formatting from appearance
    .customTransform((options: Record<string, unknown>) => {
      const appearance = options?.appearance as Record<string, any> | undefined;

      if (!appearance?.formatting) return options;

      const { formatting, ...restAppearance } = appearance;

      return {
        ...options,
        formatting,
        ...(Object.keys(restAppearance).length > 0
          ? { appearance: restAppearance }
          : { appearance: undefined }),
      };
    });

@Injectable()
export class DashboardsV3Service {
  constructor(private readonly dashboardsService: DashboardsService) {}

  private async validateFeatureAccess(context: NcContext) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_DASHBOARD_V3);
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
      list: dashboardListItemBuilder().build(dashboards) as any,
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
      result.widgets = widgetBuilder().build(dashboard.widgets) as any;
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
      list: widgetBuilder().build(widgets) as unknown as WidgetV3Type[],
    };
  }

  async widgetGet(context: NcContext, widgetId: string): Promise<WidgetV3Type> {
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

    const { options, ...rest } = body;

    const dashboard = await this.dashboardsService.dashboardCreate(
      context,
      {
        ...rest,
        ...(options !== undefined && { meta: options }),
        base_id: baseId,
      },
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

    const { options: updateOptions, ...updateRest } = body;

    const dashboard = await this.dashboardsService.dashboardUpdate(
      context,
      dashboardId,
      {
        ...updateRest,
        ...(updateOptions !== undefined && { meta: updateOptions }),
      },
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
    const { model_id, view_id, type, options, ...rest } = body as Record<
      string,
      unknown
    >;
    return {
      ...(rest as Partial<Widget>),
      ...(type !== undefined && { type: type as WidgetTypes }),
      ...(options !== undefined && {
        config: widgetOptionsRequestBuilder().build(
          options as Record<string, unknown>,
        ),
      }),
      ...(model_id !== undefined && { fk_model_id: model_id as string }),
      ...(view_id !== undefined && { fk_view_id: view_id as string }),
    };
  }
}
