import type { OperationContract } from '~/command-registry/types';
import type { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
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
import { BaseTrash, Integration, SyncConfig } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  appSyncConfigUpdateSchema,
  appSyncCreateSchema,
  appSyncDeleteSchema,
  appSyncUpdateSchema,
} from '~/command-registry/operations/_schemas/app-sync';

interface AppSyncDeleteExtra {
  isChild?: boolean;
}

// Scalar config fields whose pre-update values we snapshot for undo. The
// integration `custom_schema` isn't here — it's reverted separately by the
// prevSchemas swap in AppSyncConfigUpdateContract's inverse, not as a scalar.
const APP_SYNC_PREV_KEYS = [
  'title',
  'sync_type',
  'sync_trigger',
  'sync_trigger_cron',
  'on_delete_action',
] as const;

interface AppSyncUpdateExtra {
  prev?: Record<string, unknown>;
  // Per-integration pre-update `custom_schema`, keyed by integration id. Lets
  // undo revert the schema: updateSync's diff then restores any dropped tables
  // from trash (via restore-aware create) and drops any that were added.
  prevSchemas?: Record<string, unknown>;
}

export const AppSyncDeleteContract: OperationContract<
  typeof appSyncDeleteSchema,
  AppSyncDeleteExtra,
  boolean
> = {
  name: OperationName.appSyncDelete,
  entity: MetaTable.SYNC_CONFIGS,
  schema: appSyncDeleteSchema,
  entry: {
    entity_id: (params) => params.syncConfigId,
    description: () => 'Delete sync',
    before: async (context, params) => {
      const sync = await SyncConfig.get(context, params.syncConfigId);
      return {
        entityTitle: sync?.title,
        extra: { isChild: !!sync?.fk_parent_sync_config_id },
      };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'appSync', resourceId: params.syncConfigId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const AppSyncConfigUpdateContract: OperationContract<
  typeof appSyncConfigUpdateSchema,
  AppSyncUpdateExtra
> = {
  name: OperationName.appSyncConfigUpdate,
  entity: MetaTable.SYNC_CONFIGS,
  schema: appSyncConfigUpdateSchema,
  entry: {
    entity_id: (params) => params.syncConfigId,
    description: () => 'Update sync config',
    before: async (context, params) => {
      const sync = await SyncConfig.get(context, params.syncConfigId);
      if (!sync) return {};
      const prev: Record<string, unknown> = {
        title: sync.title,
        sync_type: sync.sync_type,
        sync_trigger: sync.sync_trigger,
        sync_trigger_cron: sync.sync_trigger_cron,
        on_delete_action: sync.on_delete_action,
      };
      // Snapshot each integration's current (pre-update) custom_schema so undo
      // can revert the schema. Runs before the op applies, so getConfig()
      // returns the OLD schema.
      const prevSchemas: Record<string, unknown> = {};
      const configs = [params.payload?.config].flat().filter(Boolean) as Array<{
        id?: string;
      }>;
      for (const c of configs) {
        if (!c?.id) continue;
        const integration = await Integration.get(context, c.id);
        const cfg = await integration?.getConfig?.();
        if (cfg?.custom_schema) prevSchemas[c.id] = cfg.custom_schema;
      }
      return {
        entityTitle: sync.title,
        extra: {
          prev,
          ...(Object.keys(prevSchemas).length ? { prevSchemas } : {}),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      const forwardBody = params.payload;
      if (!prev || !forwardBody) return null;
      const inverseBody: Record<string, unknown> = {};
      for (const k of APP_SYNC_PREV_KEYS) {
        if (k in forwardBody) inverseBody[k] = prev[k];
      }
      // Swap each integration's custom_schema back to its pre-update value,
      // reusing the forward config payload so the integration round-trip is
      // identical to the forward call.
      const prevSchemas = resolved?.extra?.prevSchemas;
      if (prevSchemas && forwardBody.config) {
        const configs = [forwardBody.config].flat().filter(Boolean) as Array<{
          id?: string;
          config?: Record<string, unknown>;
        }>;
        const reverted = configs.map((c) =>
          c?.id && prevSchemas[c.id] && c.config
            ? {
                ...c,
                config: { ...c.config, custom_schema: prevSchemas[c.id] },
              }
            : c,
        );
        inverseBody.config = Array.isArray(forwardBody.config)
          ? reverted
          : reverted[0];
      }
      if (!Object.keys(inverseBody).length) return null;
      return {
        name: OperationName.appSyncConfigUpdate,
        params: { syncConfigId: params.syncConfigId, payload: inverseBody },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Update → a macro. `updateSync` fans out to traced child ops (tableCreate/
// tableDelete/columnAdd/columnUpdate/columnDelete for the schema, and
// appSyncConfigUpdate for the scalars + integration config); the decorator
// records them into a transcript and `macroUndo` replays each child's own
// inverse in reverse — restoring dropped tables/fields from trash, reverting
// type changes from their data backup, and reverting the config.
export const AppSyncUpdateContract: OperationContract<
  typeof appSyncUpdateSchema,
  Record<string, any>
> = {
  name: OperationName.appSyncUpdate,
  entity: MetaTable.SYNC_CONFIGS,
  schema: appSyncUpdateSchema,
  macro: true,
  entry: {
    entity_id: (params) => params.syncConfigId,
    entity_title: (params) => params.payload?.title,
    description: () => 'Update sync',
    before: async (context, params) => {
      const sync = await SyncConfig.get(context, params.syncConfigId);
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

export const AppSyncCreateContract: OperationContract<
  typeof appSyncCreateSchema,
  Record<string, any>,
  { syncConfig?: { id?: string; title?: string } } | undefined
> = {
  name: OperationName.appSyncCreate,
  entity: MetaTable.SYNC_CONFIGS,
  schema: appSyncCreateSchema,
  entry: {
    entity_id: (_params, result) => result?.syncConfig?.id,
    entity_title: (_params, result) => result?.syncConfig?.title,
    description: () => 'Create sync',
  },
  undo: {
    inverse: (_context, _params, result) => {
      const syncConfigId = result?.syncConfig?.id;
      if (!syncConfigId) return null;
      return {
        name: OperationName.appSyncDelete,
        params: { syncConfigId, dropTables: true },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerAppSyncHandlers(
  svc: SyncModuleService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    AppSyncCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);

      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'appSync',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { syncConfig: { id: meta.entityId } };
        }
        NcError.get(context).internalServerError(
          'Cannot redo sync creation — its trash entry is gone. Re-create the sync.',
        );
      }

      return svc.createSync(
        context,
        params as unknown as Parameters<typeof svc.createSync>[1],
        req,
      );
    },
  );
  OperationRegistry.register(
    AppSyncDeleteContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.deleteSync(context, {
        syncConfigId: params.syncConfigId,
        dropTables: params.dropTables,
        skipTrash: params.skipTrash,
        req,
      });
    },
  );
  registerMacro(AppSyncUpdateContract, (context, params, req) =>
    svc.updateSync(context, {
      syncConfigId: params.syncConfigId,
      payload: params.payload,
      req,
    } as unknown as Parameters<typeof svc.updateSync>[1]),
  );
  // Glue child of the macro — scalars + integration config persist.
  OperationRegistry.register(
    AppSyncConfigUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.appSyncConfigUpdate(context, {
        syncConfigId: params.syncConfigId,
        payload: params.payload,
        req,
      } as unknown as Parameters<typeof svc.appSyncConfigUpdate>[1]);
    },
  );
}
