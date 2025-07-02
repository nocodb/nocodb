import { ChartWidgetConfig } from './chart';

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

export enum WidgetSourceTypes {
  VIEW = 'view',
  MODEL = 'model',
  FILTER = 'filter',
}

export type WidgetDataSource =
  | {
      fk_model_id: string;
      type: WidgetDataSourceTypes.MODEL;
    }
  | {
      fk_view_id: string;
      fk_model_id?: string;
      type: WidgetDataSourceTypes.VIEW;
    }
  | {
      fk_model_id: string;
      type: WidgetDataSourceTypes.FILTER;
    };

export interface TableWidgetConfig {
  dataSource?: WidgetDataSource;
  columns?: string[];
}

export interface MetricWidgetConfig {
  dataSource?: WidgetDataSource;
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

export interface IWidget {
  id?: string;
  title: string;
  description?: string;
  fk_dashboard_id: string;
  type: WidgetTypes;
  config?: any;
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

export * from './validation';
export * from './chart';
