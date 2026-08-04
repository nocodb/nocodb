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
    fields: Array<{
      column_id: string;
      aggregation: typeof AllAggregations;
    }>;
    groupBy?: string;
  };
}

export interface BarChartAppearanceConfig {
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
