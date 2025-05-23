export interface DashboardType {
  id?: string;
  title: string;
  description?: string;
  fk_base_id: string;
  fk_workspace_id?: string;
  meta?: any;
  order?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  owned_by?: string;
}

export interface WidgetType {
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

export enum WidgetTypes {
  CHART = 'chart',
  TABLE = 'table',
  METRIC = 'metric',
  TEXT = 'text',
  IFRAME = 'iframe',
}

export interface ChartWidgetConfig {
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter';
  fk_view_id?: string;
  fk_model_id?: string;
  dataSource?: {
    type: 'view' | 'model' | 'custom';
    source_id?: string;
  };
  xAxis?: {
    column_id: string;
    label?: string;
  };
  yAxis?: {
    column_id: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    label?: string;
  }[];
  filters?: any[];
  groupBy?: string[];
  limit?: number;
}

export interface TableWidgetConfig {
  fk_view_id?: string;
  fk_model_id?: string;
  dataSource?: {
    type: 'view' | 'model' | 'custom';
    source_id?: string;
  };
  columns?: string[];
  filters?: any[];
  sorts?: any[];
  limit?: number;
  showPagination?: boolean;
}

export interface MetricWidgetConfig {
  fk_view_id?: string;
  fk_model_id?: string;
  dataSource?: {
    type: 'view' | 'model' | 'custom';
    source_id?: string;
  };
  metric: {
    column_id?: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    label?: string;
  };
  filters?: any[];
  comparison?: {
    enabled: boolean;
    period: 'previous_period' | 'previous_year' | 'custom';
    customPeriod?: {
      start: string;
      end: string;
    };
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

export * from './validation';
