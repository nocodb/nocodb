export enum AppStatus {
  DRAFT = 'draft',
  BUILDING = 'building',
  READY = 'ready',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export interface AppVersionType {
  id?: string;
  fk_app_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  version_number?: number;
  status?: AppStatus;
  created_by?: string;
  created_at?: string;
}

export interface AppType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  title?: string;
  description?: string;
  meta?: Record<string, any>;
  order?: number;
  fk_draft_version_id?: string;
  fk_live_version_id?: string;
  created_by?: string;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}
