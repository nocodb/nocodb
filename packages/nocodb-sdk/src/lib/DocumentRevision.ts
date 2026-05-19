export enum DocRevisionSource {
  AUTO = 'auto',
  MANUAL = 'manual',
  RESTORE = 'restore',
}

export interface DocumentRevisionType {
  id?: string;
  fk_doc_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  version?: number;
  /** ProseMirror JSON snapshot. Omitted in list responses; included in single-revision GET. */
  content?: Record<string, any>;
  title?: string;
  created_by?: string;
  source?: DocRevisionSource;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentRevisionListItem {
  id: string;
  fk_doc_id: string;
  version: number;
  title: string;
  created_by: string;
  created_by_email?: string;
  created_by_display_name?: string;
  source: DocRevisionSource;
  created_at: string;
}
