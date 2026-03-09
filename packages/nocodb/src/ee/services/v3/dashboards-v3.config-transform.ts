/**
 * Widget config transformation utilities for Dashboard V3 API.
 *
 * Bidirectional camelCase ↔ snake_case key conversion with explicit
 * per-level key rename maps (no recursive case transformation).
 */

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

// Value mappings: internal → API
const DATA_SOURCE_VALUES: Record<string, string> = {
  model: 'table',
};

const SORT_BY_VALUES: Record<string, string> = {
  xAxis: 'x_axis',
  yAxis: 'y_axis',
};

// Pre-computed inverse mappings (snake_case → camelCase)
const INV_CONFIG_KEYS = invertMapping(CONFIG_KEYS);
const INV_DATA_KEYS = invertMapping(DATA_KEYS);
const INV_CATEGORY_AXIS_KEYS = invertMapping(CATEGORY_AXIS_KEYS);
const INV_Y_AXIS_KEYS = invertMapping(Y_AXIS_KEYS);
const INV_APPEARANCE_KEYS = invertMapping(APPEARANCE_KEYS);
const INV_FORMATTING_KEYS = invertMapping(FORMATTING_KEYS);
const INV_FONT_KEYS = invertMapping(FONT_KEYS);
const INV_COLUMN_TO_FIELD_KEYS = invertMapping(COLUMN_TO_FIELD_KEYS);
const INV_DATA_SOURCE_VALUES = invertMapping(DATA_SOURCE_VALUES);
const INV_SORT_BY_VALUES = invertMapping(SORT_BY_VALUES);

/**
 * Convert widget config from internal camelCase to API snake_case.
 * Explicit per-level key renaming — no recursive case transformation.
 */
export function mapConfigToSnakeCase(
  config: Record<string, any>,
): Record<string, any> {
  if (!config) return config;

  const result = renameKeys(config, CONFIG_KEYS);

  // Map data_source value: internal → API (e.g. "model" → "table")
  if (result.data_source) {
    result.data_source =
      DATA_SOURCE_VALUES[result.data_source] ?? result.data_source;
  }

  if (result.data && typeof result.data === 'object') {
    const data = renameKeys(result.data, DATA_KEYS);

    if (data.category && typeof data.category === 'object') {
      data.category = renameKeys(data.category, CATEGORY_AXIS_KEYS);
      data.category = renameKeys(data.category, COLUMN_TO_FIELD_KEYS);
    }
    if (data.value && typeof data.value === 'object') {
      data.value = renameKeys(data.value, COLUMN_TO_FIELD_KEYS);
    }
    if (data.x_axis && typeof data.x_axis === 'object') {
      data.x_axis = renameKeys(data.x_axis, CATEGORY_AXIS_KEYS);
      data.x_axis = renameKeys(data.x_axis, COLUMN_TO_FIELD_KEYS);
      if (data.x_axis.sort_by) {
        data.x_axis.sort_by =
          SORT_BY_VALUES[data.x_axis.sort_by] ?? data.x_axis.sort_by;
      }
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

  // Metric widget: rename column_id → field_id in metric sub-object
  if (result.metric && typeof result.metric === 'object') {
    result.metric = renameKeys(result.metric, COLUMN_TO_FIELD_KEYS);
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

  return result;
}

/**
 * Convert widget config from API snake_case to internal camelCase.
 * Explicit per-level key renaming — no recursive case transformation.
 */
export function mapConfigToCamelCase(
  config: Record<string, any>,
): Record<string, any> {
  if (!config) return config;

  const result = renameKeys(config, INV_CONFIG_KEYS);

  // Map dataSource value: API → internal (e.g. "table" → "model")
  if (result.dataSource) {
    result.dataSource =
      INV_DATA_SOURCE_VALUES[result.dataSource] ?? result.dataSource;
  }

  if (result.data && typeof result.data === 'object') {
    const data = renameKeys(result.data, INV_DATA_KEYS);

    if (data.category && typeof data.category === 'object') {
      data.category = renameKeys(data.category, INV_CATEGORY_AXIS_KEYS);
      data.category = renameKeys(data.category, INV_COLUMN_TO_FIELD_KEYS);
    }
    if (data.value && typeof data.value === 'object') {
      data.value = renameKeys(data.value, INV_COLUMN_TO_FIELD_KEYS);
    }
    if (data.xAxis && typeof data.xAxis === 'object') {
      data.xAxis = renameKeys(data.xAxis, INV_CATEGORY_AXIS_KEYS);
      data.xAxis = renameKeys(data.xAxis, INV_COLUMN_TO_FIELD_KEYS);
      if (data.xAxis.sortBy) {
        data.xAxis.sortBy =
          INV_SORT_BY_VALUES[data.xAxis.sortBy] ?? data.xAxis.sortBy;
      }
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

  // Metric widget: rename field_id → column_id in metric sub-object
  if (result.metric && typeof result.metric === 'object') {
    result.metric = renameKeys(result.metric, INV_COLUMN_TO_FIELD_KEYS);
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

  return result;
}
