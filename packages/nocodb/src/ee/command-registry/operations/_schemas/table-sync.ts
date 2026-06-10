import { z } from 'zod';
import { TableSyncOnDeleteAction, TableSyncTrigger } from 'nocodb-sdk';

export const tableSyncFreezeSchema = z
  .object({
    syncId: z.string(),
  })
  .strict();

export const tableSyncResumeSchema = z
  .object({
    syncId: z.string(),
  })
  .strict();

export const tableSyncDeleteSchema = z
  .object({
    syncId: z.string(),
    dropTables: z.boolean().optional(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

// Not `.strict()` — the controller forwards the raw request body as `body`;
// unknown keys are stripped rather than throwing (which would silently drop
// undoability via the decorator's swallowed validation error).
const tableSyncUpdateBodySchema = z.object({
  title: z.string().optional(),
  sync_trigger: z.nativeEnum(TableSyncTrigger).optional(),
  on_delete_action: z.nativeEnum(TableSyncOnDeleteAction).optional(),
  source_view_id: z.string().optional(),
  password: z.string().optional(),
  selected_fields: z.array(z.string()).nullable().optional(),
  link_view_by_column: z.record(z.string()).optional(),
});

export const tableSyncUpdateSchema = z
  .object({
    syncId: z.string(),
    body: tableSyncUpdateBodySchema,
  })
  .strict();

// Snapshot of the sync's mapping rows, captured by `tableSyncConfigUpdate` so
// undo/redo can rebuild them. Column/table ids are preserved across replay, so
// the dest_table_id / dest_column_id references stay valid; the mapping rows'
// own ids are NOT preserved (re-inserted fresh, with column-mapping parent refs
// remapped against the freshly-inserted table mappings). Rows are non-strict so
// a future column addition on the model doesn't break replay of old logs.
const tableSyncMappingRowSchema = z.object({
  id: z.string(),
  fk_table_sync_id: z.string(),
  source_workspace_id: z.string().nullable().optional(),
  source_base_id: z.string().nullable().optional(),
  source_table_id: z.string().nullable().optional(),
  source_view_id: z.string().nullable().optional(),
  source_uuid: z.string().nullable().optional(),
  source_password_hash: z.string().nullable().optional(),
  dest_base_id: z.string().nullable().optional(),
  dest_table_id: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

const tableSyncColumnMappingRowSchema = z.object({
  fk_table_sync_id: z.string(),
  fk_table_sync_mapping_id: z.string(),
  source_workspace_id: z.string().nullable().optional(),
  source_base_id: z.string().nullable().optional(),
  source_table_id: z.string().nullable().optional(),
  source_column_id: z.string().nullable().optional(),
  dest_base_id: z.string().nullable().optional(),
  dest_table_id: z.string().nullable().optional(),
  dest_column_id: z.string().nullable().optional(),
});

const tableSyncMappingSnapshotSchema = z.object({
  tableMappings: z.array(tableSyncMappingRowSchema),
  columnMappings: z.array(tableSyncColumnMappingRowSchema),
});

const tableSyncConfigUpdatePayloadSchema = z.object({
  title: z.string().optional(),
  sync_trigger: z.nativeEnum(TableSyncTrigger).optional(),
  on_delete_action: z.nativeEnum(TableSyncOnDeleteAction).optional(),
  selected_fields: z.array(z.string()).nullable().optional(),
  // Target mapping set to materialise on replay (redo → new set, undo → old
  // set). Omitted on the original forward call, where reconcileFields already
  // produced the correct set.
  mappings: tableSyncMappingSnapshotSchema.optional(),
  // Pre-update mapping set — carried so the contract's inverse can hand it back
  // as `mappings` on undo. Ignored by the forward handler.
  prevMappings: tableSyncMappingSnapshotSchema.optional(),
});

export const tableSyncConfigUpdateSchema = z
  .object({
    syncId: z.string(),
    payload: tableSyncConfigUpdatePayloadSchema,
  })
  .strict();

// Safe subset of the create body — `password` (paste-mode source share secret)
// is dropped (non-strict strips it) so it never lands in the operation log.
// Redo restores from trash by id, so the full body isn't needed.
const tableSyncCreateBodySchema = z.object({
  title: z.string().optional(),
  source_workspace_id: z.string().optional(),
  source_base_id: z.string().optional(),
  source_table_id: z.string().optional(),
  source_view_id: z.string().optional(),
  selected_fields: z.array(z.string()).nullable().optional(),
  link_view_by_column: z.record(z.string()).optional(),
  on_delete_action: z.string().optional(),
  sync_trigger: z.string().optional(),
  source_input_mode: z.string().optional(),
});

export const tableSyncCreateSchema = z
  .object({
    body: tableSyncCreateBodySchema,
  })
  .strict();
