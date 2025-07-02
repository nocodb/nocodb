import { WidgetDataSource, WidgetTypes } from '~/lib';

export enum ChartTypes {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  DONUT = 'donut',
  SCATTER = 'scatter',
}

export const WidgetChartLabelMap = {
  [ChartTypes.BAR]: 'Bar Chart',
  [ChartTypes.LINE]: 'Line Chart',
  [ChartTypes.PIE]: 'Pie Chart',
  [ChartTypes.DONUT]: 'Donut Chart',
  [ChartTypes.SCATTER]: 'Scatter Plot',
  [WidgetTypes.TABLE]: 'Table',
  [WidgetTypes.METRIC]: 'Metric',
  [WidgetTypes.TEXT]: 'Text',
  [WidgetTypes.IFRAME]: 'IFrame',
};

interface BaseChartConfig {
  chartType: ChartTypes;
  dataSource?: WidgetDataSource;
}

interface PieChartDataConfig {
  category: {
    column_id: string;
    orderBy?: 'default' | 'asc' | 'desc';
    includeEmptyRecords?: boolean;
  };
  value:
    | {
        type: 'field';
        aggregation: 'distinct' | 'count';
      }
    | {
        type: 'summary';
        column_id: string;
        aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
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

interface PieChatPermissionConfig {
  allowUserToPrint: boolean;
  allowUsersToViewRecords: boolean;
}

export interface PieChartConfig extends BaseChartConfig {
  chartType: ChartTypes.PIE;
  dataSource?: WidgetDataSource;
  data: PieChartDataConfig;
  appearance: PieChartAppearanceConfig;
  permissions: PieChatPermissionConfig;
}

export interface DonutChartConfig extends BaseChartConfig {
  chartType: ChartTypes.DONUT;
  dataSource?: WidgetDataSource;
  data: PieChartDataConfig;
  appearance: PieChartAppearance;
  permissions: PieChatPermissionConfig;
}

export interface BarChartConfig extends BaseChartConfig {
  chartType: ChartTypes.BAR;
  dataSource?: WidgetDataSource;
}

export interface LineChartConfig extends BaseChartConfig {
  chartType: ChartTypes.LINE;
  dataSource?: WidgetDataSource;
}

export interface ScatterPlotConfig extends BaseChartConfig {
  chartType: ChartTypes.SCATTER;
  dataSource?: WidgetDataSource;
}

export type ChartWidgetConfig =
  | BarChartConfig
  | LineChartConfig
  | PieChartConfig
  | DonutChartConfig
  | ScatterPlotConfig;
