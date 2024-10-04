export interface SerializedAiViewType {
  type: string;
  table: string;
  title: string;
  filters?: {
    comparison_op: string;
    logical_op: string;
    value?: number | null;
    column: string;
  }[];
  sorts?: {
    column: string;
    order: 'asc' | 'desc';
  }[];
  calendar_range?: {
    from_column: string;
  }[];
  gridGroupBy?: string | string[];
  kanbanGroupBy?: string | string[];
}

export interface PredictNextFieldsType {
  title: string;
  type: string;
  options?: string[];
}
