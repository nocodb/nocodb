/**
 * Base-level sections — collapsible folders in the Data sidebar that group the
 * entities living directly under a base (tables, root documents, dashboards).
 *
 * Distinct from `ViewSectionType`, which groups views *inside* a single table.
 * Sections never nest and are scoped to one source: the default source's
 * sections interleave with the sidebar's top level, while an external source's
 * sections live inside that source's own group. An entity can only join a
 * section of its own source.
 */
export interface BaseSectionType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  /** Source the section belongs to. Null/absent = the base's default source. */
  source_id?: string | null;
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
  /** Defaults to the base's default source. */
  source_id?: string | null;
  order?: number;
  meta?: Record<string, any>;
}

export interface BaseSectionUpdateReqType {
  title?: string;
  order?: number;
  meta?: Record<string, any>;
}
