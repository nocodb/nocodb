import { WidgetDataSourceTypes } from './';
import { type AllAggregations } from '~/lib/aggregationHelper';

export enum ChartTypes {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  DONUT = 'donut',
  SCATTER = 'scatter',
  TREEMAP = 'treemap',
}

interface BaseChartConfig {
  chartType: ChartTypes;
  dataSource?: WidgetDataSourceTypes;
}

interface PieChartDataConfig {
  category: {
    column_id: string;
    orderBy?: 'default' | 'asc' | 'desc';
    categoryLimit?: number;
    includeEmptyRecords?: boolean;
    includeOthers?: boolean;
  };
  value:
    | {
        type: 'count';
      }
    | {
        type: 'summary';
        column_id: string;
        aggregation: typeof AllAggregations;
      };
}

interface PieChartAppearanceConfig {
  size: 'small' | 'medium' | 'large';
  showCountInLegend: boolean;
  showPercentageOnChart: boolean;
  legendPosition: 'top' | 'right' | 'bottom' | 'left' | 'none';
  colorSchema:
    | 'default'
    | 'classic'
    | 'vibrant'
    | 'pastel'
    | 'earth'
    | 'monoBlue'
    | 'custom';
  customColorSchema: {
    color: string;
    label: string;
  }[];
}

interface ChartPermissionConfig {
  allowUserToPrint: boolean;
  allowUsersToViewRecords: boolean;
}

export interface PieChartConfig extends BaseChartConfig {
  chartType: ChartTypes.PIE;
  dataSource?: WidgetDataSourceTypes;
  data: PieChartDataConfig;
  appearance: PieChartAppearanceConfig;
  permissions: ChartPermissionConfig;
}

export interface DonutChartConfig extends BaseChartConfig {
  chartType: ChartTypes.DONUT;
  dataSource?: WidgetDataSourceTypes;
  data: PieChartDataConfig;
  appearance: PieChartAppearanceConfig;
  permissions: ChartPermissionConfig;
}

/**
 * One plotted series of an xy chart.
 *
 * The query path turns each entry into exactly one series, in order
 * (`xy-chart.common.handler.ts` → `yAxisColumns.map`), so a renderer resolves a
 * series' axis, mark and colour by POSITION against this array.
 *
 * A secondary (right-hand) axis is modelled as an entry tagged
 * `axis: 'right'` rather than a config block of its own — that keeps it inside
 * the existing query path, which already aggregates one column per entry across
 * all five dialect handlers. The cost is that this shape is heterogeneous: the
 * axis-level members below mean nothing on a left-hand entry.
 */
export interface XYChartYAxisField {
  column_id: string;
  /**
   * Aggregation key, e.g. 'count' / 'sum' / 'avg'.
   *
   * Typed as a string rather than `typeof AllAggregations` (which the inline
   * shape this was extracted from used): that annotation names the type of the
   * lookup OBJECT, so no aggregation value is actually assignable to it, and
   * every consumer had to cast around it.
   */
  aggregation: string;
  /** Which axis this series plots against. Absent = left. */
  axis?: 'left' | 'right';
  /**
   * Mark type for THIS series, letting a right-hand series read as a line over
   * left-hand bars. Absent = follow the widget's own `chartType`.
   */
  series_type?: ChartTypes.BAR | ChartTypes.LINE | ChartTypes.SCATTER;
  /** Explicit series colour. Absent = take the appearance palette. */
  color?: string;
  // ── Right-hand entries only ──────────────────────────────────────────────
  /** Axis caption. Absent = the renderer's derived name ("Average: ID"). */
  label?: string;
  /** Anchor this axis at zero rather than at the data minimum. */
  start_at_zero?: boolean;
  /** Builder toggled the axis off — keeps its config while hiding the series. */
  show?: boolean;
}

export interface BarChartDataConfig {
  xAxis: {
    column_id: string;
    sortBy: 'xAxis' | 'yAxis';
    orderBy?: 'default' | 'asc' | 'desc';
    includeEmptyRecords?: boolean;
    includeOthers?: boolean;
    categoryLimit?: number;
  };
  yAxis: {
    startAtZero: boolean;
    fields: XYChartYAxisField[];
    groupBy?: string;
    /** Left-axis caption. Absent = no caption (not a derived fallback). */
    label?: string;
  };
}

export interface BarChartAppearanceConfig {
  size: 'small' | 'medium' | 'large';
  /** Bar direction. Absent = vertical. */
  orientation?: 'vertical' | 'horizontal';
  showCountInLegend: boolean;
  showValueInChart: boolean;
  legendPosition: 'top' | 'right' | 'bottom' | 'left' | 'none';
  colorSchema:
    | 'default'
    | 'classic'
    | 'vibrant'
    | 'pastel'
    | 'earth'
    | 'monoBlue'
    | 'custom';
}

export interface BarChartConfig extends BaseChartConfig {
  chartType: ChartTypes.BAR;
  dataSource?: WidgetDataSourceTypes;
  data: BarChartDataConfig;
  permissions: ChartPermissionConfig;
  appearance: BarChartAppearanceConfig;
}

export interface LineChartAppearanceConfig {
  size: 'small' | 'medium' | 'large';
  smoothLines: boolean;
  plotDataPoints: boolean;
  showCountInLegend: boolean;
  showValueInChart: boolean;
  legendPosition: 'top' | 'right' | 'bottom' | 'left' | 'none';
  colorSchema:
    | 'default'
    | 'classic'
    | 'vibrant'
    | 'pastel'
    | 'earth'
    | 'monoBlue'
    | 'custom';
}

export interface LineChartConfig extends BaseChartConfig {
  chartType: ChartTypes.LINE;
  data: BarChartDataConfig;
  permissions: ChartPermissionConfig;
  dataSource?: WidgetDataSourceTypes;
  appearance: LineChartAppearanceConfig;
}

export interface ScatterPlotAppearanceConfig {
  size: 'small' | 'medium' | 'large';
  showCountInLegend: boolean;
  showValueInChart: boolean;
  legendPosition: 'top' | 'right' | 'bottom' | 'left' | 'none';
  colorSchema:
    | 'default'
    | 'classic'
    | 'vibrant'
    | 'pastel'
    | 'earth'
    | 'monoBlue'
    | 'custom';
}

export interface ScatterPlotConfig extends BaseChartConfig {
  chartType: ChartTypes.SCATTER;
  dataSource?: WidgetDataSourceTypes;
  data: BarChartDataConfig;
  permissions: ChartPermissionConfig;
  appearance: ScatterPlotAppearanceConfig;
}

/**
 * Flat treemap — tile per category, area ∝ value. Same data shape as the
 * circular charts (category + count/summary value), so it shares their
 * query pipeline; tiles wear a single-hue ramp, so no legend/percentage knobs.
 */
export interface TreemapChartAppearanceConfig {
  size: 'small' | 'medium' | 'large';
  showValueInChart: boolean;
  colorSchema:
    | 'default'
    | 'classic'
    | 'vibrant'
    | 'pastel'
    | 'earth'
    | 'monoBlue'
    | 'custom';
}

export interface TreemapChartConfig extends BaseChartConfig {
  chartType: ChartTypes.TREEMAP;
  dataSource?: WidgetDataSourceTypes;
  data: PieChartDataConfig;
  permissions: ChartPermissionConfig;
  appearance: TreemapChartAppearanceConfig;
}

export type ChartWidgetConfig<T extends ChartTypes = ChartTypes> =
  T extends ChartTypes.PIE
    ? PieChartConfig
    : T extends ChartTypes.DONUT
    ? DonutChartConfig
    : T extends ChartTypes.BAR
    ? BarChartConfig
    : T extends ChartTypes.LINE
    ? LineChartConfig
    : T extends ChartTypes.SCATTER
    ? ScatterPlotConfig
    : T extends ChartTypes.TREEMAP
    ? TreemapChartConfig
    : never;

// ────────────────────────────────────────────────────────────────────────────
// Y-axis field helpers
//
// Shared so the properties pane and the renderer read a `fields` array the same
// way. Every rule here is a fallback for a key an older widget will not carry:
// before secondary axes existed every entry was an untagged left-hand series,
// and those must keep rendering exactly as they did.
// ────────────────────────────────────────────────────────────────────────────

/** A series entry plots against the right-hand axis. */
export function isRightYAxisField(field: XYChartYAxisField): boolean {
  return field.axis === 'right';
}

/**
 * The single right-hand entry, if the builder has configured one.
 *
 * Only one is supported; a config carrying several takes the first so the
 * extras cannot silently double-plot.
 */
export function findRightYAxisField(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField | undefined {
  return (fields ?? []).find(isRightYAxisField);
}

/** Entries plotting against the left-hand axis — the default for untagged ones. */
export function leftYAxisFields(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField[] {
  return (fields ?? []).filter((field) => !isRightYAxisField(field));
}

/**
 * Whether a series entry should be plotted at all.
 *
 * `show` is meaningful only on the right-hand entry, where toggling the axis off
 * must keep its configuration rather than discard it. Left-hand entries have no
 * such toggle, so an absent `show` always means visible.
 */
export function isXYChartFieldPlotted(field: XYChartYAxisField): boolean {
  return !isRightYAxisField(field) || field.show !== false;
}

/** The right-hand axis is configured AND switched on. */
export function hasVisibleRightYAxis(
  fields: XYChartYAxisField[] | undefined
): boolean {
  const right = findRightYAxisField(fields);

  return !!right && isXYChartFieldPlotted(right);
}

/**
 * Mark type for one series. Left-hand entries always follow the widget's own
 * `chartType`; only a right-hand entry may differ, which is what lets a line
 * ride over bars.
 */
export function xyChartSeriesType(
  field: XYChartYAxisField,
  chartType: ChartTypes
): ChartTypes {
  if (!isRightYAxisField(field) || !field.series_type) return chartType;

  return field.series_type;
}
