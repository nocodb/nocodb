/**
 * Base-level sections — collapsible folders in the Data sidebar that group the
 * entities living directly under a base (tables, root documents, dashboards).
 *
 * Distinct from `ViewSectionType`, which groups views *inside* a single table.
 * Base sections are keyed by `base_id` alone and never nest.
 */
export interface BaseSectionType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  title: string;
  order?: number;
  meta?: Record<string, any>;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BaseSectionListType {
  list: BaseSectionType[];
}

export interface BaseSectionCreateReqType {
  title: string;
  order?: number;
  meta?: Record<string, any>;
}

export interface BaseSectionUpdateReqType {
  title?: string;
  order?: number;
  meta?: Record<string, any>;
}
