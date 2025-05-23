import { z } from 'zod';
import { WidgetTypes } from './index';

// Widget position schema
export const WidgetPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().min(1),
  h: z.number().min(1),
});

// Chart widget config schema
export const ChartWidgetConfigSchema = z.object({
  chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area', 'scatter']),
  fk_view_id: z.string().optional(),
  fk_model_id: z.string().optional(),
  dataSource: z
    .object({
      type: z.enum(['view', 'model', 'custom']),
      source_id: z.string().optional(),
    })
    .optional(),
  xAxis: z
    .object({
      column_id: z.string(),
      label: z.string().optional(),
    })
    .optional(),
  yAxis: z
    .array(
      z.object({
        column_id: z.string(),
        aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional(),
        label: z.string().optional(),
      })
    )
    .optional(),
  filters: z.array(z.any()).optional(),
  groupBy: z.array(z.string()).optional(),
  limit: z.number().positive().optional(),
});

// Table widget config schema
export const TableWidgetConfigSchema = z.object({
  fk_view_id: z.string().optional(),
  fk_model_id: z.string().optional(),
  dataSource: z
    .object({
      type: z.enum(['view', 'model', 'custom']),
      source_id: z.string().optional(),
    })
    .optional(),
  columns: z.array(z.string()).optional(),
  filters: z.array(z.any()).optional(),
  sorts: z.array(z.any()).optional(),
  limit: z.number().positive().optional(),
  showPagination: z.boolean().optional(),
});

// Metric widget config schema
export const MetricWidgetConfigSchema = z.object({
  fk_view_id: z.string().optional(),
  fk_model_id: z.string().optional(),
  dataSource: z
    .object({
      type: z.enum(['view', 'model', 'custom']),
      source_id: z.string().optional(),
    })
    .optional(),
  metric: z.object({
    column_id: z.string().optional(),
    aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']),
    label: z.string().optional(),
  }),
  filters: z.array(z.any()).optional(),
  comparison: z
    .object({
      enabled: z.boolean(),
      period: z.enum(['previous_period', 'previous_year', 'custom']),
      customPeriod: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
    })
    .optional(),
});

// Text widget config schema
export const TextWidgetConfigSchema = z.object({
  content: z.string(),
  format: z.enum(['markdown', 'html', 'plain']),
});

// Iframe widget config schema
export const IframeWidgetConfigSchema = z.object({
  url: z.string().url(),
  height: z.number().positive().optional(),
  allowFullscreen: z.boolean().optional(),
  sandbox: z.array(z.string()).optional(),
});

// Widget config union schema
export const WidgetConfigSchema = z.union([
  ChartWidgetConfigSchema,
  TableWidgetConfigSchema,
  MetricWidgetConfigSchema,
  TextWidgetConfigSchema,
  IframeWidgetConfigSchema,
]);

// Widget schema
export const WidgetSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  fk_dashboard_id: z.string(),
  type: z.nativeEnum(WidgetTypes),
  config: WidgetConfigSchema.optional(),
  meta: z.any().optional(),
  order: z.number().optional(),
  position: WidgetPositionSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Dashboard schema
export const DashboardSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  fk_base_id: z.string(),
  fk_workspace_id: z.string().optional(),
  meta: z.any().optional(),
  order: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  owned_by: z.string().optional(),
});

// Widget creation schema (stricter for creation)
export const CreateWidgetSchema = WidgetSchema.required({
  title: true,
  fk_dashboard_id: true,
  type: true,
});

// Dashboard creation schema (stricter for creation)
export const CreateDashboardSchema = DashboardSchema.required({
  title: true,
  fk_base_id: true,
});

// Widget update schema (all fields optional except id)
export const UpdateWidgetSchema = WidgetSchema.partial().required({ id: true });

// Dashboard update schema (all fields optional except id)
export const UpdateDashboardSchema = DashboardSchema.partial().required({
  id: true,
});

// Validation helper functions
export function validateWidgetConfig(type: WidgetTypes, config: any): boolean {
  try {
    switch (type) {
      case WidgetTypes.CHART:
        ChartWidgetConfigSchema.parse(config);
        break;
      case WidgetTypes.TABLE:
        TableWidgetConfigSchema.parse(config);
        break;
      case WidgetTypes.METRIC:
        MetricWidgetConfigSchema.parse(config);
        break;
      case WidgetTypes.TEXT:
        TextWidgetConfigSchema.parse(config);
        break;
      case WidgetTypes.IFRAME:
        IframeWidgetConfigSchema.parse(config);
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateWidget(widget: any): boolean {
  try {
    WidgetSchema.parse(widget);
    if (widget.config && widget.type) {
      return validateWidgetConfig(widget.type, widget.config);
    }
    return true;
  } catch {
    return false;
  }
}

export function validateDashboard(dashboard: any): boolean {
  try {
    DashboardSchema.parse(dashboard);
    return true;
  } catch {
    return false;
  }
}
