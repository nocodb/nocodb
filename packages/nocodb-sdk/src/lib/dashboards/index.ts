import { WidgetTypeType } from '../Api';

export enum AggregateFnType {
  Avg = 'avg',
  Max = 'max',
  Min = 'min',
  Count = 'count',
  Sum = 'sum',
}

export enum DataSourceType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  SQL = 'sql',
  STATIC_CONTENT = 'static_content',
}

export interface InternalDataSource {
  dataSourceType: DataSourceType.INTERNAL;
  projectId?: string;
  tableId?: string;
  viewId?: string;
}

export interface ExternalDataSource {
  dataSourceType: DataSourceType.EXTERNAL;
  endpointUrl?: string;
}

export interface SQLDataSource {
  dataSourceType: DataSourceType.SQL;
  sqlStatement?: string;
}

export interface StaticContentDataSource {
  dataSourceType: DataSourceType.STATIC_CONTENT;
}

export type DataSource =
  | InternalDataSource
  | ExternalDataSource
  | SQLDataSource
  | StaticContentDataSource;

export interface NumberDataConfig {
  colId?: string;
  aggregateFunction?: AggregateFnType;
}

export interface StaticTextDataConfig {
  text?: string;
}

export interface Aggregated2DChartDataConfig {
  xAxisColId?: string;
  yAxisColId?: string;
  aggregateFunction?: AggregateFnType;
}
export type BarChartDataConfig = Aggregated2DChartDataConfig;
export type LineChartDataConfig = Aggregated2DChartDataConfig;
export type PieChartDataConfig = Aggregated2DChartDataConfig;

export interface ScatterPlotDataConfig {
  xAxisColId?: string;
  yAxisColId?: string;
}

export type DataConfig =
  | NumberDataConfig
  | StaticTextDataConfig
  | BarChartDataConfig
  | LineChartDataConfig
  | PieChartDataConfig
  | ScatterPlotDataConfig;

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface ScreenDimensions {
  height: number;
  width: number;
}

export enum FontType {
  HEADING1 = 'heading1',
  HEADING2 = 'heading2',
  HEADING3 = 'heading3',
  SUB_HEADING_1 = 'subHeading1',
  SUB_HEADING_2 = 'subHeading2',
  BODY = 'body',
  CAPTION = 'caption',
}

export interface BaseAppearanceConfig {
  name: string;
  description?: string;
  screenDimensions: ScreenDimensions;
  screenPosition: ScreenPosition;
}

export interface StaticTextAppearanceConfig extends BaseAppearanceConfig {
  fontType?: FontType;
}

export type AppearanceConfig =
  | StaticTextAppearanceConfig
  | BaseAppearanceConfig;

export interface Widget {
  id: string;
  schema_version: string;
  data_config?: DataConfig;
  data_source?: DataSource;
  widget_type: WidgetTypeType;
  appearance_config: AppearanceConfig;
}

export interface StaticTextWidget extends Widget {
  appearance_config: StaticTextAppearanceConfig;
  data_config: StaticTextDataConfig;
  data_source: StaticContentDataSource;
  widget_type: WidgetTypeType.StaticText;
}

export interface NumberWidget extends Widget {
  appearance_config: BaseAppearanceConfig;
  data_config: NumberDataConfig;
  widget_type: WidgetTypeType.Number;
}

export interface ChartWidget extends Widget {
  appearance_config: BaseAppearanceConfig;
  data_config: Aggregated2DChartDataConfig;
  widget_type:
    | WidgetTypeType.LineChart
    | WidgetTypeType.BarChart
    | WidgetTypeType.PieChart
    | WidgetTypeType.ScatterPlot;
}

export const chartVisualisationTypes = [
  WidgetTypeType.LineChart,
  WidgetTypeType.BarChart,
  WidgetTypeType.PieChart,
  WidgetTypeType.ScatterPlot,
];

export interface WidgetDataResult {
  dashboardId: string;
  widgetId: string;
}

export interface NumberWidgetDataResult extends WidgetDataResult {
  columnName: string;
  aggregateFunction: AggregateFnType;
  value: number;
}

export interface ChartWidgetDataResult extends WidgetDataResult {
  xColumnName: string;
  yColumnName: string;
  aggregateFunction: AggregateFnType;
  values: number[];
}
