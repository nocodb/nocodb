import { isLinksOrLTAR, TableSyncMappingRole } from 'nocodb-sdk';
import type { OperationContract } from '~/command-registry/types';
import type { TableSyncService } from '~/modules/table-sync/table-sync.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Model, TableSync } from '~/models';
import BaseTrash from '~/ee/models/BaseTrash';
import { NcError } from '~/helpers/catchError';
import {
  tableSyncConfigUpdateSchema,
  tableSyncCreateSchema,
  tableSyncDeleteSchema,
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
}
