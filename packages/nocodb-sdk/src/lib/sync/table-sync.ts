export enum TableSyncTrigger {
  /** Event-driven, sub-second propagation via BaseModel hooks. Default for
   *  new internal syncs. */
  Realtime = 'realtime',
  /** No auto-propagation. The user explicitly clicks "Sync now" to apply
   *  source changes. */
  Manual = 'manual',
}

export enum TableSyncStatus {
  Syncing = 'syncing',
  Active = 'active',
  Error = 'error',
  Paused = 'paused',
}

export enum TableSyncOnDeleteAction {
  Delete = 'delete',
  MarkDeleted = 'mark_deleted',
}

export enum TableSyncInputMode {
  Browse = 'browse',
  Paste = 'paste',
}

export enum TableSyncMappingRole {
  /** The main source table for the sync. Exactly one row per sync. */
  Main = 'main',
  /** A linked source table feeding a destination shadow table. */
  LinkedShadow = 'linked_shadow',
  /** A custom junction table that backs a custom-link LTAR on the main
   *  mirror. Rows are keyed by `RemoteId` pairs (parent + child), not by
   *  the dest tables' auto PKs. `source_*` columns are null. */
  Junction = 'junction',
}

export interface TableSyncMappingType {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  fk_table_sync_id: string;

  source_workspace_id: string;
  source_base_id: string;
  source_table_id: string;
  source_view_id: string;
  source_uuid: string;
  source_password_hash: string | null;

  dest_base_id: string;
  dest_table_id: string;

  role: TableSyncMappingRole;

  created_at: string;
  updated_at: string;
}

export interface TableSyncType {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  title: string;

  /** Sync field selection. null = sync all fields, including columns added
   *  to the source later. Non-null array = sync only the listed titles. */
  selected_fields: string[] | null;

  on_delete_action: TableSyncOnDeleteAction;
  sync_trigger: TableSyncTrigger;

  /** How the user originally picked the source view. Immutable post-create. */
  source_input_mode: TableSyncInputMode;

  status: TableSyncStatus;
  last_error: string | null;
  last_synced_at: string | null;

  /** Soft-delete flag. true = trashed (recoverable), null/false = active. */
  deleted?: boolean;

  sync_job_id: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  /** Populated by API responses; not a persisted column. */
  mappings?: TableSyncMappingType[];
}
