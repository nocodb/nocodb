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

export interface DataSourceInternal {
  dataSourceType: DataSourceType.INTERNAL;
  projectId?: string;
  tableId?: string;
  viewId?: string;
}

export interface DataSourceExternal {
  dataSourceType: DataSourceType.EXTERNAL;
  endpointUrl?: string;
}

export interface DataSourceSQL {
  dataSourceType: DataSourceType.SQL;
  sqlStatement?: string;
}

export interface DataSourceStaticContent {
  dataSourceType: DataSourceType.STATIC_CONTENT;
}

export type DataSource =
  | DataSourceInternal
  | DataSourceExternal
  | DataSourceSQL
  | DataSourceStaticContent;

export interface DataConfigNumber {
  colId?: string;
  aggregateFunction?: AggregateFnType;
}

export interface DataConfigStaticText {
  text?: string;
}

export interface DataConfigAggregated2DChart {
  xAxisColId?: string;
  yAxisColId?: string;
  aggregateFunction?: AggregateFnType;
}
export type DataConfigBarChart = DataConfigAggregated2DChart;
export type DataConfigLineChart = DataConfigAggregated2DChart;
export type DataConfigPieChart = DataConfigAggregated2DChart;

export interface DataConfigScatterPlot {
  xAxisColId?: string;
  yAxisColId?: string;
}

export type DataConfig =
  | DataConfigNumber
  | DataConfigStaticText
  | DataConfigBarChart
  | DataConfigLineChart
  | DataConfigPieChart
  | DataConfigScatterPlot;

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

export interface AppearanceConfigBase {
  name: string;
  description?: string;
  screenDimensions: ScreenDimensions;
  screenPosition: ScreenPosition;
}

export interface AppearanceConfigStaticText extends AppearanceConfigBase {
  fontType?: FontType;
}

export type AppearanceConfig =
  | AppearanceConfigStaticText
  | AppearanceConfigBase;

export interface Widget {
  id: string;
  schema_version: string;
  data_config?: DataConfig;
  data_source?: DataSource;
  widget_type: WidgetTypeType;
  appearance_config: AppearanceConfig;
}

export interface StaticTextWidget extends Widget {
  appearance_config: AppearanceConfigStaticText;
  data_config: DataConfigStaticText;
  data_source: DataSourceStaticContent;
  widget_type: WidgetTypeType.StaticText;
}

export interface NumberWidget extends Widget {
  appearance_config: AppearanceConfigBase;
  data_config: DataConfigNumber;
  widget_type: WidgetTypeType.Number;
}

export interface ChartWidget extends Widget {
  appearance_config: AppearanceConfigBase;
  data_config: DataConfigAggregated2DChart;
  widget_type:
    | WidgetTypeType.LineChart
    | WidgetTypeType.BarChart
    | WidgetTypeType.PieChart
    | WidgetTypeType.ScatterPlot;
}

export const chartTypes = [
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
