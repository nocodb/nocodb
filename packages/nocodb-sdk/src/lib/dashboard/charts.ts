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
 * One plotted series of an xy chart. The query path emits one series per entry,
 * in order, so a series resolves to its entry by POSITION.
 *
 * The shape is heterogeneous: the axis-level members below mean nothing on a
 * left-hand entry.
 */
export interface XYChartYAxisField {
  column_id: string;
  /** Aggregation key, e.g. 'count' / 'sum' / 'avg'. */
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
// Y-axis field helpers — shared so the properties pane and the renderer read a
// `fields` array the same way. Each rule falls back to the pre-secondary-axis
// behaviour for keys an older widget will not carry.
// ────────────────────────────────────────────────────────────────────────────

/** A series entry plots against the right-hand axis. */
export function isRightYAxisField(field: XYChartYAxisField): boolean {
  return field.axis === 'right';
}

/**
 * The right-hand entry the builder edits — first one found, hidden or not, so
 * toggling the axis off keeps its configuration editable.
 *
 * For rendering use `findPlottedRightYAxisField`: this one may return a hidden
 * entry, and a renderer that built no axis for it would strand its series.
 */
export function findRightYAxisField(
  fields: XYChartYAxisField[] | undefined
): XYChartYAxisField | undefined {
  return (fields ?? []).find(isRightYAxisField);
}

/**
 * The right-hand entry that drives the secondary axis — the first one actually
 * plotted. Only one secondary axis exists, so any further plotted right entries
 * share it.
 */
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
