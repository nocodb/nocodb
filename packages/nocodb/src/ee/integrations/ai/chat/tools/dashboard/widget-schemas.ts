import { z } from 'zod';

const aggregationEnum = z.enum(['sum', 'avg', 'count', 'min', 'max']);

const legendPositionEnum = z.enum(['top', 'right', 'bottom', 'left', 'none']);

const chartSizeEnum = z.enum(['small', 'medium', 'large']);

const categoryValueSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('count'),
  }),
  z.object({
    type: z.literal('summary'),
    column_id: z.string().describe('Column ID to aggregate.'),
    aggregation: aggregationEnum,
  }),
]);

const pieCategorySchema = z.object({
  column_id: z.string().describe('Column ID used for the category axis.'),
  orderBy: z.enum(['default', 'asc', 'desc']).optional(),
  categoryLimit: z.number().optional(),
  includeEmptyRecords: z.boolean().optional(),
  includeOthers: z.boolean().optional(),
});

const pieAppearanceSchema = z.object({
  size: chartSizeEnum.optional(),
  showCountInLegend: z.boolean().optional(),
  showPercentageOnChart: z.boolean().optional(),
  legendPosition: legendPositionEnum.optional(),
  colorSchema: z.enum(['default', 'custom']).optional(),
  customColorSchema: z
    .array(z.object({ color: z.string(), label: z.string() }))
    .optional(),
});

const barXAxisSchema = z.object({
  column_id: z.string().describe('Column ID for the X axis.'),
  sortBy: z.enum(['xAxis', 'yAxis']).optional(),
  orderBy: z.enum(['default', 'asc', 'desc']).optional(),
  includeEmptyRecords: z.boolean().optional(),
  includeOthers: z.boolean().optional(),
  categoryLimit: z.number().optional(),
});

const barYAxisSchema = z.object({
  startAtZero: z.boolean().optional(),
  fields: z
    .array(
      z.object({
        column_id: z.string().describe('Column ID for a Y axis value.'),
        aggregation: aggregationEnum,
      }),
    )
    .describe('One or more value fields with aggregation.'),
  groupBy: z.string().optional().describe('Optional column ID for grouping.'),
});

const barAppearanceSchema = z.object({
  size: chartSizeEnum.optional(),
  showCountInLegend: z.boolean().optional(),
  showValueInChart: z.boolean().optional(),
  legendPosition: legendPositionEnum.optional(),
  colorSchema: z.enum(['default', 'custom']).optional(),
});

const lineAppearanceSchema = barAppearanceSchema.extend({
  smoothLines: z.boolean().optional(),
  plotDataPoints: z.boolean().optional(),
});

export const pieChartConfigSchema = z
  .object({
    chartType: z.literal('pie'),
    dataSource: z.enum(['view', 'model', 'filter']).optional(),
    data: z.object({
      category: pieCategorySchema,
      value: categoryValueSchema,
    }),
    appearance: pieAppearanceSchema.optional(),
  })
  .describe('Pie chart config.');

export const donutChartConfigSchema = z
  .object({
    chartType: z.literal('donut'),
    dataSource: z.enum(['view', 'model', 'filter']).optional(),
    data: z.object({
      category: pieCategorySchema,
      value: categoryValueSchema,
    }),
    appearance: pieAppearanceSchema.optional(),
  })
  .describe('Donut chart config.');

export const barChartConfigSchema = z
  .object({
    chartType: z.literal('bar'),
    dataSource: z.enum(['view', 'model', 'filter']).optional(),
    data: z.object({
      xAxis: barXAxisSchema,
      yAxis: barYAxisSchema,
    }),
    appearance: barAppearanceSchema.optional(),
  })
  .describe('Bar chart config.');

export const lineChartConfigSchema = z
  .object({
    chartType: z.literal('line'),
    dataSource: z.enum(['view', 'model', 'filter']).optional(),
    data: z.object({
      xAxis: barXAxisSchema,
      yAxis: barYAxisSchema,
    }),
    appearance: lineAppearanceSchema.optional(),
  })
  .describe('Line chart config.');

export const chartConfigSchema = z
  .discriminatedUnion('chartType', [
    pieChartConfigSchema,
    donutChartConfigSchema,
    barChartConfigSchema,
    lineChartConfigSchema,
  ])
  .describe(
    'Chart widget configuration. Discriminated by chartType: "bar", "line", "pie", "donut".',
  );

export const metricConfigSchema = z
  .object({
    dataSource: z.enum(['view', 'model', 'filter']).optional(),
    metric: z.object({
      type: z
        .enum(['count', 'summary'])
        .describe(
          '"count" for record count, "summary" for column aggregation.',
        ),
      column_id: z
        .string()
        .optional()
        .describe('Column ID to aggregate. Required when type is "summary".'),
      aggregation: aggregationEnum.describe(
        'Aggregation function. For "count" type, use "count".',
      ),
    }),
    appearance: z
      .object({
        type: z.enum(['default', 'filled', 'coloured']).optional(),
        theme: z
          .enum([
            'gray',
            'red',
            'green',
            'yellow',
            'pink',
            'blue',
            'orange',
            'maroon',
            'purple',
          ])
          .optional(),
      })
      .optional(),
  })
  .describe('Metric widget configuration — displays a single KPI number.');

const textMarkdownConfigSchema = z.object({
  type: z.literal('markdown'),
  content: z.string().describe('Markdown content.'),
  formatting: z
    .object({
      horizontalAlign: z.enum(['flex-start', 'center', 'flex-end']).optional(),
      verticalAlign: z.enum(['flex-start', 'center', 'flex-end']).optional(),
    })
    .optional(),
});

const textPlainConfigSchema = z.object({
  type: z.literal('text'),
  content: z.string().describe('Plain text content.'),
  formatting: z
    .object({
      horizontalAlign: z.enum(['flex-start', 'center', 'flex-end']).optional(),
      verticalAlign: z.enum(['flex-start', 'center', 'flex-end']).optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
    })
    .optional(),
  appearance: z
    .object({
      font: z
        .object({
          family: z.string().optional(),
          weight: z.number().optional(),
          size: z.number().optional(),
          lineHeight: z.number().optional(),
        })
        .optional(),
      color: z.string().optional(),
    })
    .optional(),
});

export const textConfigSchema = z
  .discriminatedUnion('type', [textMarkdownConfigSchema, textPlainConfigSchema])
  .describe(
    'Text widget configuration. Discriminated by type: "markdown" or "text".',
  );

export const iframeConfigSchema = z
  .object({
    url: z.string().describe('URL to embed in the iframe.'),
    allowFullscreen: z.boolean().optional(),
  })
  .describe('Iframe widget configuration — embeds an external URL.');

/**
 * Union of all widget config schemas — used as the typed `config` parameter
 * in create_widget / update_widget tool schemas.
 */
export const widgetConfigSchema = z.union([
  chartConfigSchema,
  metricConfigSchema,
  textConfigSchema,
  iframeConfigSchema,
]);

export const WIDGET_CONFIG_DESCRIPTIONS = `
Widget config varies by type:

DATA SOURCE (chart & metric widgets):
  config.dataSource OPTIONAL: "model" (default — all records), "view" (records from a view), "filter" (specific records with filter conditions).
  When "model": uses all records from the table (fk_model_id).
  When "view": uses records from a specific view (set fk_view_id on the widget).
  When "filter": uses records matching filter conditions. After creating the widget, use add_widget_filter to add conditions.

CHART (type="chart"):
  config.chartType REQUIRED: "bar"|"line"|"pie"|"donut"
  For pie/donut:
    config.data.category.column_id (REQUIRED) — column for slices
      Unsupported: System columns, Attachment, QrCode, Barcode, Button, JSON
    config.data.value — { type: "count" } or { type: "summary", column_id, aggregation }
  For bar/line:
    config.data.xAxis.column_id (REQUIRED) — column for X axis
      Unsupported: System columns, Attachment, QrCode, Barcode, Button, JSON, Links/LTAR
    config.data.yAxis.fields (REQUIRED) — [{ column_id, aggregation }]
      Unsupported: System columns, Attachment, QrCode, Barcode, Button, JSON, Links/LTAR, Lookup
  Optional: config.appearance (size, legendPosition, etc.), config.permissions

METRIC (type="metric"):
  config.metric.type REQUIRED: "count" or "summary"
  config.metric.aggregation REQUIRED: "sum"|"avg"|"count"|"min"|"max"
  config.metric.column_id — required when type is "summary"
    Unsupported: System columns, Attachment, QrCode, Barcode, Button, Lookup
  Optional: config.appearance.type ("default"|"filled"|"coloured"), config.appearance.theme

TEXT (type="text"):
  config.type REQUIRED: "markdown" or "text"
  config.content REQUIRED: the text/markdown string
  Optional: config.formatting (alignment), config.appearance (font, color — text type only)

IFRAME (type="iframe"):
  config.url REQUIRED: the URL to embed
  Optional: config.allowFullscreen

WIDGET FILTERS (when config.dataSource="filter"):
  After creating/updating a widget with dataSource="filter", use these tools to manage filter conditions:
  - add_widget_filter: add a filter condition (field, operator, value)
  - list_widget_filters: list existing filters on a widget
  - remove_widget_filter: remove a filter by ID

SIZE CONSTRAINTS (4-column grid):
  metric: minW=1 minH=2 maxW=4 maxH=2 (default 1×2)
  chart:  minW=2 minH=5 maxW=2 maxH=6 (default 2×5)
  text:   minW=2 minH=1 maxW=4 (default 2×1)
  iframe: minW=2 minH=5 maxW=4 maxH=12 (default 2×4)
  Always provide position. Check existing widgets to avoid overlaps.
`.trim();

/**
 * Validate widget config against the appropriate schema for the widget type.
 * Returns the parsed config or throws a ZodError.
 */
export function validateWidgetConfig(
  widgetType: string,
  config: unknown,
): unknown {
  switch (widgetType) {
    case 'chart':
      return chartConfigSchema.parse(config);
    case 'metric':
      return metricConfigSchema.parse(config);
    case 'text':
      return textConfigSchema.parse(config);
    case 'iframe':
      return iframeConfigSchema.parse(config);
    default:
      return config;
  }
}
