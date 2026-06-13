import { isLinksOrLTAR } from 'nocodb-sdk';
import type { OperationContract } from '~/command-registry/types';
import type { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay } from '~/helpers/replayScope';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';
import { BaseTrash, Integration, SyncConfig } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  appSyncAttachTableSchema,
  appSyncConfigUpdateSchema,
  appSyncCreateSchema,
  appSyncDeleteSchema,
  appSyncDetachTableSchema,
  appSyncUpdateSchema,
} from '~/command-registry/operations/_schemas/app-sync';
import { Model, SyncMapping } from '~/models';

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

// Update → a macro so the fanned-out child ops (tableCreate/tableDelete/
// columnAdd/columnUpdate/columnDelete + the appSyncConfigUpdate glue) stay
// grouped under one undo entry. The inverse is NOT a transcript replay:
// `before` snapshots the full pre-update payload (scalars + each
// integration's config incl. `custom_schema`) and undo simply RE-RUNS
// updateSync with that snapshot — its own diff recreates hard-dropped
// tables/columns, drops added ones, and reverts type changes. Redo re-runs
// the forward payload the same way.
export const AppSyncUpdateContract: OperationContract<
  typeof appSyncUpdateSchema,
  { prevPayload?: Record<string, unknown> }
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
      if (!sync) return {};

      const prevPayload: Record<string, unknown> = {
        syncConfigId: params.syncConfigId,
        title: sync.title,
        sync_type: sync.sync_type,
        sync_trigger: sync.sync_trigger,
        sync_trigger_cron: sync.sync_trigger_cron,
        on_delete_action: sync.on_delete_action,
        sync_category: sync.sync_category,
        meta: sync.meta,
      };

      // Snapshot each touched integration's current (pre-update) config —
      // runs before the op applies, so getConfig() returns the OLD state.
      const configs = [params.payload?.config].flat().filter(Boolean) as Array<{
        id?: string;
        type?: string;
        sub_type?: string;
        syncConfigId?: string;
      }>;
      const prevConfigs: Array<Record<string, unknown>> = [];
      for (const c of configs) {
        if (!c?.id) continue;
        const integration = await Integration.get(context, c.id);
        if (!integration) continue;
        const cfg = await integration.getConfig();
        prevConfigs.push({
          id: c.id,
          type: c.type,
          sub_type: c.sub_type,
          title: integration.title,
          syncConfigId: c.syncConfigId,
          config: extractProps(cfg, [
            'authIntegrationId',
            'schema',
            'tables',
            'custom_schema',
          ]),
        });
      }
      if (prevConfigs.length) prevPayload.config = prevConfigs;

      return { entityTitle: sync.title, extra: { prevPayload } };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prevPayload = resolved?.extra?.prevPayload;
      if (!prevPayload) return null;
      return {
        name: OperationName.appSyncUpdate,
        params: { syncConfigId: params.syncConfigId, payload: prevPayload },
      };
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

interface AppSyncDetachExtra {
  attachParams?: Record<string, unknown>;
}

// "Convert to regular table" — the inverse re-ATTACHES the table to its sync:
// recreate the mapping, re-flag synced/readonly (incl. handed-over junctions +
// the mirrored link columns), and put the table back into the integration's
// `tables`/`custom_schema`. `before` captures everything attach needs, since
// detach destroys it.
export const AppSyncDetachTableContract: OperationContract<
  typeof appSyncDetachTableSchema,
  AppSyncDetachExtra
> = {
  name: OperationName.appSyncDetachTable,
  entity: MetaTable.SYNC_MAPPINGS,
  schema: appSyncDetachTableSchema,
  entry: {
    entity_id: (params) => params.modelId,
    description: () => 'Convert synced table to regular table',
    before: async (context, params) => {
      const mappings = await SyncMapping.listByModelId(context, params.modelId);
      const mapping = mappings[0];
      if (!mapping?.target_table) return {};

      const model = await Model.get(context, params.modelId);
      if (!model) return {};

      const columns = await model.getColumns(context);
      const readonlyColIds = (columns ?? [])
        .filter((c) => c.readonly && c.id)
        .map((c) => c.id);

      // Junctions the detach will hand over, plus the mirrored readonly link
      // columns on the still-synced related tables.
      const junctions: Array<{
        junctionId: string;
        relatedReadonlyColIds: string[];
      }> = [];
      for (const column of columns ?? []) {
        if (!isLinksOrLTAR(column)) continue;
        const colOptions = await column.getColOptions<{
          fk_mm_model_id?: string;
          fk_related_model_id?: string;
        }>(context);
        if (!colOptions?.fk_mm_model_id) continue;
        const junction = await Model.get(context, colOptions.fk_mm_model_id);
        if (!junction?.mm || !junction?.synced) continue;

        const relatedReadonlyColIds: string[] = [];
        if (colOptions.fk_related_model_id) {
          const related = await Model.get(
            context,
            colOptions.fk_related_model_id,
          );
          const relatedColumns = await related?.getColumns(context);
          for (const relatedColumn of relatedColumns ?? []) {
            if (!isLinksOrLTAR(relatedColumn) || !relatedColumn.readonly) {
              continue;
            }
            const relatedColOptions = await relatedColumn.getColOptions<{
              fk_mm_model_id?: string;
            }>(context);
            if (
              relatedColOptions?.fk_mm_model_id === junction.id &&
              relatedColumn.id
            ) {
              relatedReadonlyColIds.push(relatedColumn.id);
            }
          }
        }
        junctions.push({ junctionId: junction.id, relatedReadonlyColIds });
      }

      const syncConfig = await SyncConfig.get(
        context,
        mapping.fk_sync_config_id,
      );
      const integration = syncConfig?.fk_integration_id
        ? await Integration.get(context, syncConfig.fk_integration_id)
        : null;
      const config = await integration?.getConfig();

      return {
        entityTitle: model.title,
        extra: {
          attachParams: {
            modelId: params.modelId,
            syncConfigId: mapping.fk_sync_config_id,
            targetTable: mapping.target_table,
            readonlyColIds,
            customSchemaEntry: config?.custom_schema?.[mapping.target_table],
            ...(junctions.length ? { junctions } : {}),
          },
        },
      };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const attachParams = resolved?.extra?.attachParams;
      if (!attachParams) return null;
      return { name: OperationName.appSyncAttachTable, params: attachParams };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

// Replay-only inverse of detach — never invoked over HTTP. Its own inverse is
// detach again, so undo→redo round-trips.
export const AppSyncAttachTableContract: OperationContract<
  typeof appSyncAttachTableSchema
> = {
  name: OperationName.appSyncAttachTable,
  entity: MetaTable.SYNC_MAPPINGS,
  schema: appSyncAttachTableSchema,
  entry: {
    entity_id: (params) => params.modelId,
    description: () => 'Re-attach table to sync',
  },
  undo: {
    inverse: (_context, params) => ({
      name: OperationName.appSyncDetachTable,
      params: { modelId: params.modelId },
    }),
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
  OperationRegistry.register(
    AppSyncDetachTableContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.detachSyncTable(context, { modelId: params.modelId, req });
    },
  );
  OperationRegistry.register(
    AppSyncAttachTableContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.attachSyncTable(context, {
        ...(params as unknown as Parameters<typeof svc.attachSyncTable>[1]),
        req,
      });
    },
  );
  OperationRegistry.register(
    AppSyncUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.updateSync(context, {
        syncConfigId: params.syncConfigId,
        payload: params.payload,
        req,
      } as unknown as Parameters<typeof svc.updateSync>[1]);
    },
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
