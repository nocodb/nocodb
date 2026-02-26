export interface ViewSectionType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_model_id: string;
  title: string;
  order?: number;
  meta?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ViewSectionListType {
  list: ViewSectionType[];
}

export interface ViewSectionCreateReqType {
  title: string;
  order?: number;
  meta?: Record<string, any>;
}

export interface ViewSectionUpdateReqType {
  title?: string;
  order?: number;
  meta?: Record<string, any>;
}
