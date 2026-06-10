import type { OperationContract } from '~/command-registry/types';
import type { TableSyncService } from '~/modules/table-sync/table-sync.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerMacro,
} from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { TableSync } from '~/models';
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

// Update → a macro. `updateSync` fans out to traced child ops (columnAdd/
// columnDelete/columnUpdate for the field diff, tableCreate/tableDelete for
// MM junction + linked-shadow tables, and tableSyncConfigUpdate for the
// scalars + mapping rows); the decorator records them into a transcript and
// `macroUndo` replays each child's own inverse in reverse — restoring dropped
// columns/tables from trash and rebuilding the mapping set. NOTE: a field
// change triggers a full resync (a job) in the macro body, which isn't part of
// the transcript — undo can't un-run a sync already completed.
export const TableSyncUpdateContract: OperationContract<
  typeof tableSyncUpdateSchema,
  Record<string, any>
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
      return { entityTitle: sync?.title };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const transcript = (
        resolved?.extra as
          | { macroTranscript?: ReadonlyArray<unknown> }
          | undefined
      )?.macroTranscript;
      if (!transcript || !transcript.length) return null;
      return { name: OperationName.macroUndo, params: { transcript } };
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
  registerMacro(TableSyncUpdateContract, (context, params, req) =>
    svc.updateSync(context, {
      syncId: params.syncId,
      body: params.body,
      req,
    } as unknown as Parameters<typeof svc.updateSync>[1]),
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
