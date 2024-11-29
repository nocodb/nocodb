export interface SerializedAiTableType {
  tables?: {
    title?: string;
    description?: string | null;
    columns?: {
      title?: string;
      type?: string;
      options?: string[];
    }[];
  }[];
  relationships?: {
    from?: string;
    to?: string;
    type?: string;
  }[];
}

export interface SerializedAiViewType {
  type: string;
  table: string;
  title: string;
  description?: string | null;
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
  calendar_range?:
    | {
        from_column?: string;
      }
    | {
        from_column?: string;
      }[];
  gridGroupBy?: string | string[];
  kanbanGroupBy?: string;
}

export interface PredictNextFieldsType {
  title: string;
  type: string;
  options?: string[];
  description?: string | null;
}

export interface PredictNextFormulasType {
  title: string;
  formula: string;
  description?: string | null;
}
