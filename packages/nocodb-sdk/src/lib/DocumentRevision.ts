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
  fk_tab_id?: string;
  source?: DocRevisionSource;
  created_at?: string;
  updated_at?: string;
}
