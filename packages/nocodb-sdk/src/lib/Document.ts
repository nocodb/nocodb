export interface DocumentType {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  content?: Record<string, any>; // ProseMirror JSON document
  meta?: Record<string, any>; // icon, cover, lock, settings
  order?: number;
  parent_id?: string | null;
  deleted?: boolean;
  has_children?: boolean;
  version?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated Use DocumentType instead */
export type DocType = DocumentType;
