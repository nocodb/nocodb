import { ChartTypes, ChartWidgetConfig } from './charts';

export interface DashboardType {
  id?: string;
  title: string;
  description?: string;
  base_id: string;
  fk_workspace_id?: string;
  meta?: any;
  order?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  owned_by?: string;

  password?: string;
  fk_custom_url_id?: string;
  uuid?: string;
}

export enum WidgetTypes {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric',
  TEXT = 'text',
  IFRAME = 'iframe',
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

export enum WidgetDataSourceTypes {
  VIEW = 'view',
  MODEL = 'model',
  FILTER = 'filter',
}

export interface TableWidgetConfig {
  dataSource?: WidgetDataSourceTypes;
  columns?: string[];
}

export interface MetricWidgetConfig {
  dataSource?: WidgetDataSourceTypes;
  metric: {
    type: 'count' | 'summary';
    column_id?: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  };
  appearance: {
    type: 'default' | 'filled' | 'coloured';
    theme:
      | 'gray'
      | 'red'
      | 'green'
      | 'yellow'
      | 'pink'
      | 'blue'
      | 'orange'
      | 'maroon'
      | 'purple';
  };
}

export interface TextWidgetConfig {
  content: string;
  format: 'markdown' | 'html' | 'plain';
}

export interface IframeWidgetConfig {
  url: string;
  height?: number;
  allowFullscreen?: boolean;
  sandbox?: string[];
}

export type WidgetConfig =
  | ChartWidgetConfig
  | TableWidgetConfig
  | MetricWidgetConfig
  | TextWidgetConfig
  | IframeWidgetConfig;

export interface CommonWidgetType {
  id: string;
  title: string;
  description?: string;
  fk_dashboard_id: string;
  fk_model_id?: string;
  fk_view_id?: string;
  type: WidgetTypes;
  config?: WidgetConfig;
  meta?: any;
  order?: number;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  error?: boolean;
  created_at?: string;
  updated_at?: string;

  base_id: string;
  fk_workspace_id: string;
}

export interface ChartWidgetType<C extends ChartTypes = ChartTypes>
  extends CommonWidgetType {
  config: ChartWidgetConfig<C>;
}

export interface TableWidgetType extends CommonWidgetType {
  type: WidgetTypes.TABLE;
  config: TableWidgetConfig;
}

export interface MetricWidgetType extends CommonWidgetType {
  type: WidgetTypes.METRIC;
  config: MetricWidgetConfig;
}

export interface TextWidgetType extends CommonWidgetType {
  type: WidgetTypes.TEXT;
  config: TextWidgetConfig;
}

export interface IframeWidgetType extends CommonWidgetType {
  type: WidgetTypes.IFRAME;
  config: IframeWidgetConfig;
}

export type WidgetType<T extends WidgetTypes = WidgetTypes> =
  T extends WidgetTypes.CHART
    ? ChartWidgetType
    : T extends WidgetTypes.TABLE
    ? TableWidgetType
    : T extends WidgetTypes.METRIC
    ? MetricWidgetType
    : T extends WidgetTypes.TEXT
    ? TextWidgetType
    : T extends WidgetTypes.IFRAME
    ? IframeWidgetType
    : never;

export type Widget<
  T extends WidgetType = WidgetType,
  C extends ChartTypes = ChartTypes
> = T extends ChartWidgetType
  ? ChartWidgetType<C>
  : T extends TableWidgetType
  ? TableWidgetType
  : T extends MetricWidgetType
  ? MetricWidgetType
  : T extends TextWidgetType
  ? TextWidgetType
  : T extends IframeWidgetType
  ? IframeWidgetType
  : never;

export interface IWidget {
  id?: string;
  title: string;
  description?: string;
  fk_dashboard_id: string;

  // fk_model_id && fk_view_id
  fk_model_id?: string;
  fk_view_id?: string;

  type: WidgetTypes;
  config?: any;
  meta?: any;
  order?: number;
  error?: boolean;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  created_at?: string;
  updated_at?: string;

  base_id: string;
  fk_workspace_id: string;
}

export * from './charts';
export * from './widgetUtils';
