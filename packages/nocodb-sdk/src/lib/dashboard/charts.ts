import { WidgetDataSourceTypes } from './';
import { type AllAggregations } from '~/lib';

export enum ChartTypes {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  DONUT = 'donut',
  SCATTER = 'scatter',
}

interface BaseChartConfig {
  chartType: ChartTypes;
  dataSource?: WidgetDataSourceTypes;
}

interface PieChartDataConfig {
  category: {
    column_id: string;
    orderBy?: 'default' | 'asc' | 'desc';
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
  colorSchema: 'default' | 'custom';
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
  smoothLines: boolean;
  plotDataPoints: boolean;
  showCountInLegend: boolean;
  showPercentageOnChart: boolean;
  legendPosition: 'top' | 'right' | 'bottom' | 'left' | 'none';
  colorSchema: 'default' | 'custom';
  customColorSchema: {
    color: string;
    label: string;
  }[];
}

export interface BarChartConfig extends BaseChartConfig {
  chartType: ChartTypes.BAR;
  dataSource?: WidgetDataSourceTypes;
  data: BarChartDataConfig;
  permissions: ChartPermissionConfig;
  appearance: BarChartAppearanceConfig;
}

export interface LineChartConfig extends BaseChartConfig {
  chartType: ChartTypes.LINE;
  dataSource?: WidgetDataSourceTypes;
}

export interface ScatterPlotConfig extends BaseChartConfig {
  chartType: ChartTypes.SCATTER;
  dataSource?: WidgetDataSourceTypes;
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
    : never;
