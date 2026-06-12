import { isLinksOrLTAR, TableSyncMappingRole } from 'nocodb-sdk';
import type { OperationContract } from '~/command-registry/types';
import type { TableSyncService } from '~/modules/table-sync/table-sync.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { computeTableSyncDetachPlan } from '~/modules/table-sync/table-sync.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Model, TableSync, TableSyncColumnMapping } from '~/models';
import BaseTrash from '~/ee/models/BaseTrash';
import { NcError } from '~/helpers/catchError';
import {
  tableSyncAttachTableSchema,
  tableSyncConfigUpdateSchema,
  tableSyncCreateSchema,
  tableSyncDeleteSchema,
  tableSyncDetachTableSchema,
  tableSyncFreezeSchema,
  tableSyncResumeSchema,
  tableSyncUpdateSchema,
} from '~/command-registry/operations/_schemas/table-sync';

// Scalar config fields whose pre-update values the glue op snapshots for undo.
// Source re-pointing fields (password / link_view_by_column) aren't here; the
// source_view_id re-bind rides the mapping snapshot instead.
const TABLE_SYNC_PREV_KEYS = [
  'title',
  'sync_trigger',
  'on_delete_action',
  'selected_fields',
] as const;

interface TableSyncConfigUpdateExtra {
  prev?: Record<string, unknown>;
}

export const TableSyncFreezeContract: OperationContract<
  typeof tableSyncFreezeSchema
> = {
  name: OperationName.tableSyncFreeze,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncFreezeSchema,
  entry: {
    entity_id: (params) => params.syncId,
    description: () => 'Pause sync',
  },
  undo: {
    inverse: (_context, params) => ({
      name: OperationName.tableSyncResume,
      params: { syncId: params.syncId },
    }),
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const TableSyncResumeContract: OperationContract<
  typeof tableSyncResumeSchema
> = {
  name: OperationName.tableSyncResume,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncResumeSchema,
  entry: {
    entity_id: (params) => params.syncId,
    description: () => 'Resume sync',
  },
  undo: {
    inverse: (_context, params) => ({
      name: OperationName.tableSyncFreeze,
      params: { syncId: params.syncId },
    }),
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Delete → undo restores from trash (reuses TrashRestoreContract). The default
// (soft) path is recoverable for both modes: keep-tables soft-deletes only the
// sync row, while drop-tables soft-deletes every dest table (junctions
// included) to trash as a child of the sync entry, so restoring the sync
// cascades them back. The `skipTrash` hard-delete path is NOT restorable, so
// its inverse is null.
export const TableSyncDeleteContract: OperationContract<
  typeof tableSyncDeleteSchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.tableSyncDelete,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncDeleteSchema,
  entry: {
    entity_id: (params) => params.syncId,
    description: () => 'Delete sync',
    before: async (context, params) => {
      const sync = await TableSync.get(context, params.syncId);
      return { entityTitle: sync?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'tableSync', resourceId: params.syncId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Glue child of the tableSyncUpdate macro — applies the scalar config fields
// and, on replay only, rebuilds the sync's mapping rows from the snapshot
// (column/table ids are id-stable across replay, but TableSyncMapping /
// TableSyncColumnMapping rows aren't part of the trash cycle, so they must be
// re-materialised). The inverse reverts the scalars + hands back the pre-update
// mapping snapshot carried in `prevMappings`.
export const TableSyncConfigUpdateContract: OperationContract<
  typeof tableSyncConfigUpdateSchema,
  TableSyncConfigUpdateExtra
> = {
  name: OperationName.tableSyncConfigUpdate,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncConfigUpdateSchema,
  entry: {
    entity_id: (params) => params.syncId,
    description: () => 'Update sync config',
    before: async (context, params) => {
      const sync = await TableSync.get(context, params.syncId);
      if (!sync) return {};
      const prev: Record<string, unknown> = {
        title: sync.title,
        sync_trigger: sync.sync_trigger,
        on_delete_action: sync.on_delete_action,
        selected_fields: sync.selected_fields,
      };
      return { entityTitle: sync.title, extra: { prev } };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      const forwardBody = params.payload;
      if (!forwardBody) return null;
      const inverseBody: Record<string, unknown> = {};
      if (prev) {
        for (const k of TABLE_SYNC_PREV_KEYS) {
          if (k in forwardBody) inverseBody[k] = prev[k];
        }
      }
      // Restore the pre-update mapping set captured in the forward params.
      if (forwardBody.prevMappings) {
        inverseBody.mappings = forwardBody.prevMappings;
      }
      if (!Object.keys(inverseBody).length) return null;
      return {
        name: OperationName.tableSyncConfigUpdate,
        params: { syncId: params.syncId, payload: inverseBody },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Update → a macro so the fanned-out child ops stay grouped under one undo
// entry. The inverse is NOT a transcript replay: `before` snapshots the
// pre-update values of every field the forward body touches (incl. the
// link-view picks derived from LinkedShadow mappings) and undo simply RE-RUNS
// updateSync with that snapshot — its own reconcile recreates hard-dropped
// fields/shadow tables and drops added ones. Redo re-runs the forward body.
// Recreated shadow tables/columns get fresh ids (regenerated sync artifacts).
export const TableSyncUpdateContract: OperationContract<
  typeof tableSyncUpdateSchema,
  { prevBody?: Record<string, unknown> }
> = {
  name: OperationName.tableSyncUpdate,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncUpdateSchema,
  macro: true,
  entry: {
    entity_id: (params) => params.syncId,
    entity_title: (params) => params.body?.title,
    description: () => 'Update sync',
    before: async (context, params) => {
      const sync = await TableSync.get(context, params.syncId);
      if (!sync) return {};

      const forwardBody = (params.body ?? {}) as Record<string, unknown>;
      const prevBody: Record<string, unknown> = {};

      if ('title' in forwardBody) prevBody.title = sync.title;
      if ('sync_trigger' in forwardBody)
        prevBody.sync_trigger = sync.sync_trigger;
      if ('on_delete_action' in forwardBody)
        prevBody.on_delete_action = sync.on_delete_action;

      const mainMapping = (sync.mappings ?? []).find(
        (m) => m.role === TableSyncMappingRole.Main,
      );
      if ('source_view_id' in forwardBody && mainMapping?.source_view_id) {
        prevBody.source_view_id = mainMapping.source_view_id;
      }

      // Field changes: snapshot BOTH selected_fields and the link-view picks —
      // re-running with selected_fields but without the picks would wipe the
      // MM-link bindings (reconcileFields treats absent picks as "unpicked").
      if (
        'selected_fields' in forwardBody ||
        'link_view_by_column' in forwardBody
      ) {
        prevBody.selected_fields = sync.selected_fields ?? null;

        const linkViewByColumn: Record<string, string> = {};
        const shadowViewByTableId = new Map<string, string>();
        for (const m of sync.mappings ?? []) {
          if (
            m.role === TableSyncMappingRole.LinkedShadow &&
            m.source_table_id &&
            m.source_view_id
          ) {
            shadowViewByTableId.set(m.source_table_id, m.source_view_id);
          }
        }

        if (shadowViewByTableId.size && mainMapping?.source_table_id) {
          const sourceCtx = {
            workspace_id:
              mainMapping.source_workspace_id ?? context.workspace_id,
            base_id: mainMapping.source_base_id ?? context.base_id,
          };
          const sourceModel = await Model.get(
            sourceCtx,
            mainMapping.source_table_id,
          );
          const sourceColumns = await sourceModel?.getColumns(sourceCtx);
          for (const col of sourceColumns ?? []) {
            if (!col.title || !isLinksOrLTAR(col)) continue;
            const relatedId = (
              col.colOptions as { fk_related_model_id?: string }
            )?.fk_related_model_id;
            if (!relatedId) continue;
            const viewId = shadowViewByTableId.get(relatedId);
            if (viewId) linkViewByColumn[col.title] = viewId;
          }
        }

        prevBody.link_view_by_column = linkViewByColumn;
      }

      return { entityTitle: sync.title, extra: { prevBody } };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prevBody = resolved?.extra?.prevBody;
      if (!prevBody || !Object.keys(prevBody).length) return null;
      return {
        name: OperationName.tableSyncUpdate,
        params: { syncId: params.syncId, body: prevBody },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Create → undo deletes the sync with its tables (recoverably, to trash);
// redo restores everything from trash (ids preserved, cross-base aware).
export const TableSyncCreateContract: OperationContract<
  typeof tableSyncCreateSchema,
  Record<string, any>,
  { id?: string; title?: string } | undefined
> = {
  name: OperationName.tableSyncCreate,
  entity: MetaTable.TABLE_SYNCS,
  schema: tableSyncCreateSchema,
  entry: {
    entity_id: (_params, result) => result?.id,
    entity_title: (_params, result) => result?.title,
    description: () => 'Create sync',
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.tableSyncDelete,
        params: { syncId: result.id, dropTables: true },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

interface TableSyncDetachExtra {
  attachParams?: Record<string, unknown>;
}

// "Convert to regular table" on a single shadow/junction dest table: the
// whole field cluster (the named table + its junction/shadow counterpart,
// see computeTableSyncDetachPlan) leaves the sync config together — mapping
// rows dropped (incl. the link-view pick riding the shadow's source_view_id),
// the affected field titles removed from selected_fields, the cluster's
// tables gone plain, and the remaining tables' LTAR columns handed over. The
// inverse re-ATTACHES all of it. `before` captures everything attach needs,
// since detach destroys it. Converting the MAIN dest table is NOT this op:
// that drops the sync itself via tableSyncDelete (keep tables), with its own
// trash-restore undo.
export const TableSyncDetachTableContract: OperationContract<
  typeof tableSyncDetachTableSchema,
  TableSyncDetachExtra
> = {
  name: OperationName.tableSyncDetachTable,
  entity: MetaTable.TABLE_SYNC_MAPPINGS,
  schema: tableSyncDetachTableSchema,
  entry: {
    entity_id: (params) => params.modelId,
    description: () => 'Convert synced table to regular table',
    before: async (context, params) => {
      const plan = await computeTableSyncDetachPlan(context, params.modelId);
      if (!plan) return {};

      const destCtx = { ...context, base_id: plan.mapping.dest_base_id };
      const model = await Model.get(destCtx, params.modelId);

      const columnMappingRow = (c: {
        fk_table_sync_id?: string | null;
        fk_table_sync_mapping_id?: string | null;
        source_workspace_id?: string | null;
        source_base_id?: string | null;
        source_table_id?: string | null;
        source_column_id?: string | null;
        dest_base_id?: string | null;
        dest_table_id?: string | null;
        dest_column_id?: string | null;
      }) => ({
        fk_table_sync_id: c.fk_table_sync_id,
        fk_table_sync_mapping_id: c.fk_table_sync_mapping_id,
        source_workspace_id: c.source_workspace_id,
        source_base_id: c.source_base_id,
        source_table_id: c.source_table_id,
        source_column_id: c.source_column_id,
        dest_base_id: c.dest_base_id,
        dest_table_id: c.dest_table_id,
        dest_column_id: c.dest_column_id,
      });

      const mappings = [];
      for (const m of plan.detachMappings) {
        const columnMappings =
          await TableSyncColumnMapping.listByTableSyncMapping(
            plan.syncCtx,
            m.id,
          );
        mappings.push({
          mapping: {
            id: m.id,
            fk_table_sync_id: m.fk_table_sync_id,
            source_workspace_id: m.source_workspace_id,
            source_base_id: m.source_base_id,
            source_table_id: m.source_table_id,
            source_view_id: m.source_view_id,
            source_uuid: m.source_uuid,
            source_password_hash: m.source_password_hash,
            dest_base_id: m.dest_base_id,
            dest_table_id: m.dest_table_id,
            role: m.role,
          },
          columnMappings: columnMappings.map(columnMappingRow),
        });
      }

      return {
        entityTitle: model?.title,
        extra: {
          attachParams: {
            modelId: params.modelId,
            syncId: plan.sync.id,
            syncBaseId: plan.mapping.base_id,
            mappings,
            tables: plan.tables,
            ...(plan.linkCols.length ? { linkCols: plan.linkCols } : {}),
            prevSelectedFields: plan.sync.selected_fields ?? null,
            ...(plan.fieldColumnMappings.length
              ? {
                  fieldColumnMappings:
                    plan.fieldColumnMappings.map(columnMappingRow),
                }
              : {}),
          },
        },
      };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const attachParams = resolved?.extra?.attachParams;
      if (!attachParams) return null;
      return {
        name: OperationName.tableSyncAttachTable,
        params: attachParams,
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Replay-only inverse of detach — never invoked over HTTP. Its own inverse is
// detach again, so undo→redo round-trips.
export const TableSyncAttachTableContract: OperationContract<
  typeof tableSyncAttachTableSchema
> = {
  name: OperationName.tableSyncAttachTable,
  entity: MetaTable.TABLE_SYNC_MAPPINGS,
  schema: tableSyncAttachTableSchema,
  entry: {
    entity_id: (params) => params.modelId,
    description: () => 'Re-attach table to sync',
  },
  undo: {
    inverse: (_context, params) => ({
      name: OperationName.tableSyncDetachTable,
      params: { modelId: params.modelId },
    }),
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerTableSyncHandlers(
  svc: TableSyncService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    TableSyncCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);

      // Redo: restore the trashed sync instead of re-creating, preserving ids.
      // The trash handler's restore() cascades the dest tables back (recorded
      // as `droppedTables` when create-undo deleted with dropTables:true), so
      // no manual per-table restore is needed here.
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'tableSync',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
        NcError.get(context).internalServerError(
          'Cannot redo sync creation — its trash entry is gone. Re-create the sync.',
        );
      }

      return svc.createSync(context, {
        body: params.body,
        req,
      } as unknown as Parameters<typeof svc.createSync>[1]);
    },
  );
  OperationRegistry.register(
    TableSyncFreezeContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.freezeSync(context, { syncId: params.syncId, req });
    },
  );
  OperationRegistry.register(
    TableSyncResumeContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.resumeSync(context, { syncId: params.syncId, req });
    },
  );
  OperationRegistry.register(
    TableSyncDeleteContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.delete(context, {
        syncId: params.syncId,
        dropTables: params.dropTables,
        skipTrash: params.skipTrash,
        req,
      });
    },
  );
  OperationRegistry.register(
    TableSyncUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.updateSync(context, {
        syncId: params.syncId,
        body: params.body,
        req,
      } as unknown as Parameters<typeof svc.updateSync>[1]);
    },
  );
  // Glue child of the tableSyncUpdate macro — scalars + mapping-row rebuild.
  OperationRegistry.register(
    TableSyncConfigUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableSyncConfigUpdate(context, {
        syncId: params.syncId,
        payload: params.payload,
        req,
      } as unknown as Parameters<typeof svc.tableSyncConfigUpdate>[1]);
    },
  );
  OperationRegistry.register(
    TableSyncDetachTableContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.detachTable(context, { modelId: params.modelId, req });
    },
  );
  OperationRegistry.register(
    TableSyncAttachTableContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.attachTable(context, {
        ...(params as unknown as Parameters<typeof svc.attachTable>[1]),
        req,
      });
    },
  );
}
