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
}

export enum WidgetTypes {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric',
  TEXT = 'text',
  IFRAME = 'iframe',
}

export enum ChartTypes {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  DONUT = 'donut',
  SCATTER = 'scatter',
}
export enum WidgetSourceTypes {
  VIEW = 'view',
  MODEL = 'model',
  FILTER = 'filter',
}

export type WidgetDataSource =
  | {
      fk_model_id: string;
      type: WidgetSourceTypes.MODEL;
    }
  | {
      fk_view_id: string;
      fk_model_id?: string;
      type: WidgetSourceTypes.VIEW;
    }
  | {
      fk_model_id: string;
      type: WidgetSourceTypes.FILTER;
    };

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
export interface ChartWidgetConfig {
  chartType: ChartTypes;
  dataSource?: WidgetDataSource;
  xAxis?: {
    column_id: string;
    label?: string;
  };
  yAxis?: {
    column_id: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    label?: string;
  }[];
  groupBy?: string[];
  limit?: number;
}

export interface TableWidgetConfig {
  dataSource?: WidgetDataSource;
  columns?: string[];
}

export interface MetricWidgetConfig {
  dataSource?: WidgetDataSource;
  metric: {
    column_id?: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    label?: string;
  };
  filters?: any[];
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
  created_at?: string;
  updated_at?: string;
}

export interface ChartWidgetType extends CommonWidgetType {
  type: WidgetTypes.CHART;
  config: ChartWidgetConfig;
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

export type WidgetType =
  | ChartWidgetType
  | TableWidgetType
  | MetricWidgetType
  | TextWidgetType
  | IframeWidgetType;

export * from './validation';
