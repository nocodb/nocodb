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
 * One plotted series of an xy chart — the query path emits one per entry, in
 * order, so a series resolves to its entry by POSITION. Heterogeneous: the
 * axis-level members mean nothing on a left-hand entry.
 */
export interface XYChartYAxisField {
  column_id: string;
  /** Aggregation key, e.g. 'count' / 'sum' / 'avg'. */
  aggregation: string;
  /** Which axis this series plots against. Absent = left. */
  axis?: 'left' | 'right';
  /** Per-series mark, so a right-hand line can ride over bars. Absent = the widget's `chartType`. */
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
    /** Category-axis caption. Absent = no caption. */
    legend_title?: string;
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
// Y-axis field helpers — shared so the pane and the renderer read `fields` the
// same way. Absent keys fall back to the pre-secondary-axis behaviour.
// ────────────────────────────────────────────────────────────────────────────

/** A series entry plots against the right-hand axis. */
export function isRightYAxisField(field: XYChartYAxisField): boolean {
  return field.axis === 'right';
}

/**
 * The right-hand entry the builder EDITS — hidden or not. Renderers want
 * `findPlottedRightYAxisField`; a hidden entry here has no axis to plot on.
 */
export function findRightYAxisField(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField | undefined {
  return (fields ?? []).find(isRightYAxisField);
}

/** The entry driving the secondary axis. Only one exists, so further right entries share it. */
export function findPlottedRightYAxisField(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField | undefined {
  return (fields ?? []).find(
    (field) => isRightYAxisField(field) && isXYChartFieldPlotted(field)
  );
}

/** Entries plotting against the left-hand axis — the default for untagged ones. */
export function leftYAxisFields(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField[] {
  return (fields ?? []).filter((field) => !isRightYAxisField(field));
}

/** `show` is meaningful only on a right-hand entry — left ones have no toggle. */
export function isXYChartFieldPlotted(field: XYChartYAxisField): boolean {
  return !isRightYAxisField(field) || field.show !== false;
}

/** The right-hand axis is configured AND switched on. */
export function hasVisibleRightYAxis(
  fields: XYChartYAxisField[] | undefined
): boolean {
  return !!findPlottedRightYAxisField(fields);
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
