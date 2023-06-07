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

// BUTTON START
export enum ButtonActionType {
  OPEN_EXTERNAL_URL = 'open_external_url',
  DELETE_RECORD = 'delete_record',
  UPDATE_RECORD = 'update_record',
  OPEN_LAYOUT = 'open_layout',
  // ...
}

export interface ButtonActionBase {
  actionType: ButtonActionType;
}
export interface ButtonActionExternalUrl extends ButtonActionBase {
  url: string;
}
export type ButtonAction = ButtonActionExternalUrl;

export interface DataConfigButton extends ButtonAction {
  actionType: ButtonActionType;
  buttonText: string;
}
export interface DataConfigButtonExternalUrl
  extends DataConfigButton,
    ButtonActionExternalUrl {
  actionType: ButtonActionType.OPEN_EXTERNAL_URL;
}

export interface DataConfigNumber {
  recordCountOrFieldSummary?: 'record_count' | 'field_summary';
  selectRecordsMode?: 'all_records' | 'specific_records';
  colId?: string;
  aggregateFunction?: AggregateFnType;
  name?: string;
  description?: string;
}

export interface StaticTextFunctionBase {
  type: 'url'; // | ... More Functions to come?;
}
export interface StatictTextFunctionUrl extends StaticTextFunctionBase {
  type: 'url';
  url: string;
}

export type StaticTextFunction = StatictTextFunctionUrl;

export interface DataConfigStaticText {
  text?: string;
  hasFunction?: boolean;
  staticTextFunction?: StaticTextFunction;
}

export interface DataConfigStaticText {
  text?: string;
  hasFunction?: boolean;
  staticTextFunction?: StaticTextFunction;
}

export interface DataConfigAggregated2DChart {
  xAxisColId?: string;
  xAxisOrderBy?: 'x_val' | 'y_val';
  xAxisOrderDirection?: 'asc' | 'desc';
  xAxisIncludeEmptyRecords?: boolean;
  recordCountOrFieldSummary?: 'record_count' | 'field_summary';
  yAxisRecordCountMode?: 'count' | 'distinct';
  yAxisColId?: string;
  aggregateFunction?: AggregateFnType;
  yAxisGroupByColId?: string;
  yAxisStartAtZero?: boolean;
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
  | DataConfigScatterPlot
  | DataConfigButton;

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
  screenDimensions: ScreenDimensions;
  screenPosition: ScreenPosition;
}

export interface AppearanceConfigStaticText extends AppearanceConfigBase {
  fontType?: FontType;
}

export interface AppearanceConfigNumber extends AppearanceConfigBase {
  fillColor?: string;
  textColor?: string;
  borderColor?: string;
  iconColor?: string;
}

export type AppearanceConfig =
  | AppearanceConfigStaticText
  | AppearanceConfigNumber;

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

export interface ButtonWidget extends Widget {
  appearance_config: AppearanceConfigBase;
  data_config: DataConfigButton;
  widget_type: WidgetTypeType.Button;
}

export interface NumberWidget extends Widget {
  appearance_config: AppearanceConfigNumber;
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
  layoutId: string;
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
