import { Injectable, Logger } from '@nestjs/common';
import { EventType, SyncTrigger } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { TableTrashHandler } from '~/services/base-trash/handlers/table.trash-handler';
import { BaseTrash, Column, Model, SyncConfig, SyncMapping } from '~/models';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { TablesService } from '~/services/tables.service';
import { SyncModuleSyncDataProcessor } from '~/integrations/sync/module/services/sync.processor';
import { JobTypes } from '~/interface/Jobs';

/**
 * Trash handler for App Sync (integration-based `SyncConfig`).
 *
 * PARENT (top-level) sync, KEEP tables: trash() converts the synced tables back
 * to plain editable tables (un-sync) and soft-deletes the parent config + its
 * children as a single trash entry. The mappings are kept so restore can
 * re-attach. `related_items` records the child sync ids and, per kept table, the
 * columns we flipped writable — so restore re-applies `synced` + `readonly`.
 *
 * PARENT sync, DROP tables: trash() sends every dest table (junction included)
 * to trash as a child of this entry; `related_items.droppedTables` records them
 * so restore()/permanentDelete() cascade to the child tables (junctions come
 * back with their tables, keeping MM links intact).
 *
 * CHILD sync (one source within a multi-source sync, `fk_parent_sync_config_id`
 * set): trash() wipes the child's rows from the parent's shared tables then
 * soft-deletes the child config (it owns no tables), stamping the parent so it
 * shows as its own restorable entry under the live parent.
 * restore() un-deletes it and re-triggers a sync to re-fetch the wiped rows
 * (the per-child incremental cursor is derived from existing rows, so an empty
 * table re-fetches from the start). permanentDelete() hard-deletes the config
 * (+ its integration).
 *
 * The `skipTrash` hard delete is NOT handled here — it stays in
 * `SyncModuleService.deleteSync` as the normal (non-restorable) flow.
 */
/**
 * Delete options the App Sync handler reads from `param.options` (the generic
 * `TOptions` on `TrashCallParam`). Extend here as App Sync needs more flags.
 */
export interface AppSyncTrashOptions {
  /** Also send the dest tables to trash (else keep them, un-synced). */
  dropTables?: boolean;
}

interface AppSyncTrashRelatedItems {
  childSyncIds: string[];
  tables: Array<{ tableId: string; readonlyColIds: string[] }>;
  droppedTables: Array<{ baseId: string; tableId: string }>;
}

@Injectable()
export class AppSyncTrashHandler extends BaseTrashHandler<SyncConfig> {
  resourceType = 'appSync';
  childTypes = ['appSync'];
  affectedCaches = ['commandPalette', 'baseSchema'] as const;

  private readonly logger = new Logger(AppSyncTrashHandler.name);

  constructor(
    private readonly nocoJobsService: NocoJobsService,
    private readonly tableTrashHandler: TableTrashHandler,
    private readonly bulkDataAliasService: BulkDataAliasService,
    private readonly tablesService: TablesService,
    private readonly syncDataProcessor: SyncModuleSyncDataProcessor,
  ) {
    super();
  }

  /** Wipe a child sync's rows from the parent's shared dest tables (keyed by the
   *  child's `SyncConfigId`) so its data is gone but the config stays
   *  restorable. Used by the soft-delete child path in `trash()`. */
  private async wipeChildRows(
    ctx: NcContext,
    syncConfig: SyncConfig,
    req: NcRequest,
    ncMeta?: MetaService,
  ): Promise<void> {
    const parentMappings = await SyncMapping.list(
      ctx,
      { fk_sync_config_id: syncConfig.fk_parent_sync_config_id, force: true },
      ncMeta,
    );
    for (const mapping of parentMappings) {
      const model = await Model.get(ctx, mapping.fk_model_id, false, ncMeta);
      if (!model) continue;
      await model.getColumns(ctx, ncMeta);
      const syncConfigIdCol = model.columns.find(
        (c) => c.title === 'SyncConfigId',
      );
      if (!syncConfigIdCol?.id) {
        continue;
      }
      await this.bulkDataAliasService.bulkDataDeleteAll(
        { ...ctx, socket_id: null },
        {
          baseName: model.base_id,
          tableName: model.id,
          req,
          query: {
            internalFlags: { skipHooks: true },
            filterArr: [
              {
                comparison_op: 'eq',
                value: syncConfig.id,
                logical_op: 'and',
                fk_column_id: syncConfigIdCol.id,
              },
            ],
          },
        },
      );
    }
  }

  /**
   * Soft-delete flow for app sync (the restorable path). `SyncModuleService`
   * routes here via `trashResource('appSync', { options })` only when NOT
   * hard-deleting — the `skipTrash` hard delete stays in the service as the
   * normal flow. Branches:
   *   - child → wipe rows + soft-delete (stamps the parent so it's a
   *     restorable child entry);
   *   - parent keep → un-sync the live tables;
   *   - parent drop → trash every dest table (junction last) as a child for
   *     cascade restore/purge.
   *
   * Note: in the drop path the dest-table trashing joins this trash
   * transaction (`ncMeta` threaded into `tablesService.tableDelete`), so the
   * sync soft-delete and every dest-table trash commit or roll back together.
   */
  async trash(
    ctx: NcContext,
    id: string,
    param: TrashCallParam<AppSyncTrashOptions>,
    ncMeta?: MetaService,
  ): Promise<TrashResult<SyncConfig>> {
    const syncConfig = await SyncConfig.get(ctx, id, false, ncMeta);
    if (!syncConfig) {
      NcError.get(ctx).syncConfigNotFound(id);
    }

    const dropTables = !!param.options?.dropTables;

    // Child: wipe its rows from the parent's shared tables, soft-delete
    // the config, and stamp the live parent so it's a restorable child entry.
    if (syncConfig.fk_parent_sync_config_id) {
      await this.wipeChildRows(ctx, syncConfig, param.req, ncMeta);
      await SyncConfig.softDelete(ctx, id, true, ncMeta);
      const parentSync = await SyncConfig.get(
        ctx,
        syncConfig.fk_parent_sync_config_id,
        false,
        ncMeta,
      );
      return {
        entity: syncConfig,
        parentType: 'appSync',
        parentId: syncConfig.fk_parent_sync_config_id,
        parentName: parentSync?.title,
      };
    }

    // Top-level. Drop → trash every dest table (junction last) as a child
    // for cascade restore/purge. Keep → un-sync the live dest tables.
    const childSyncIds = (syncConfig.children ?? []).map((c) => c.id);
    const droppedTables: Array<{ baseId: string; tableId: string }> = [];
    const tables: AppSyncTrashRelatedItems['tables'] = [];

    const mappings = await SyncMapping.list(
      ctx,
      { fk_sync_config_id: id, force: true },
      ncMeta,
    );

    if (dropTables) {
      const targets: Array<{ id: string; mm: boolean }> = [];
      for (const mapping of mappings) {
        const model = await Model.get(ctx, mapping.fk_model_id, false, ncMeta);
        if (model) targets.push({ id: model.id, mm: !!model.mm });
      }
      targets.sort((a, b) => (a.mm ? 1 : 0) - (b.mm ? 1 : 0));

      const tableParent = {
        type: 'appSync',
        id: syncConfig.id,
        name: syncConfig.title,
      };
      for (const t of targets) {
        await this.tablesService.tableDelete(
          { ...ctx, socket_id: null },
          {
            tableId: t.id,
            req: param.req,
            parent: tableParent,
            forceDeleteSyncs: true,
          },
          ncMeta,
        );
        droppedTables.push({ baseId: ctx.base_id, tableId: t.id });
      }
    } else {
      for (const mapping of mappings) {
        const model = await Model.get(ctx, mapping.fk_model_id, false, ncMeta);
        // Junction/MM tables stay synced so their LTARs keep routing.
        if (!model || model.mm) continue;

        await model.getColumns(ctx, ncMeta);

        const readonlyColIds = (model.columns ?? [])
          .filter((c) => c.readonly && c.id)
          .map((c) => c.id);

        await Model.updateSynced(ctx, model.id, false, ncMeta);

        for (const colId of readonlyColIds) {
          await Column.update2(
            ctx,
            { colId, column: { readonly: false }, isSimpleUpdate: true },
            ncMeta,
          );
        }

        tables.push({ tableId: model.id, readonlyColIds });
        await this.broadcastTableUpdate(ctx, model.id, ncMeta);
      }
    }

    await SyncConfig.softDelete(ctx, id, true, ncMeta);
    for (const childId of childSyncIds) {
      await SyncConfig.softDelete(ctx, childId, true, ncMeta);
    }

    return {
      entity: syncConfig,
      relatedItems: { childSyncIds, tables, droppedTables },
    };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.parent_type === 'appSync') {
      if (trashEntry.parent_id) {
        const parentTrash = await BaseTrash.getByResourceId(
          ctx,
          'appSync',
          trashEntry.parent_id,
          ncMeta,
        );
        if (parentTrash) {
          NcError.get(ctx).parentInTrash('appSync');
        }
      }

      await SyncConfig.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
      const job = await this.nocoJobsService.add(
        JobTypes.SyncModuleSyncData,
        {
          context: ctx,
          syncConfigId: trashEntry.resource_id,
          trigger: SyncTrigger.Manual,
          bulk: false,
          req: param.req,
        },
        { delay: 5000 },
      );
      await SyncConfig.update(
        ctx,
        trashEntry.resource_id,
        { sync_job_id: `${job.id}` },
        ncMeta,
      );

      const child = await SyncConfig.get(
        ctx,
        trashEntry.resource_id,
        true,
        ncMeta,
      );
      if (child?.fk_parent_sync_config_id) {
        await this.broadcastRestored(
          ctx,
          child.fk_parent_sync_config_id,
          'app_sync_update',
          ncMeta,
        );
      }
      return;
    }

    const {
      childSyncIds = [],
      tables = [],
      droppedTables = [],
    } = trashEntry.getRelatedItems<AppSyncTrashRelatedItems>();

    for (const t of tables) {
      const model = await Model.get(ctx, t.tableId, false, ncMeta);
      if (!model) {
        const orphaned = await SyncMapping.listByModelId(
          ctx,
          t.tableId,
          ncMeta,
        );
        for (const m of orphaned) {
          await SyncMapping.delete(ctx, m.id, ncMeta);
        }
        continue;
      }

      await Model.updateSynced(ctx, t.tableId, true, ncMeta);
      for (const colId of t.readonlyColIds ?? []) {
        const column = await Column.get(ctx, { colId }, ncMeta);
        if (!column) continue;

        await Column.update2(
          ctx,
          { colId, column: { readonly: true }, isSimpleUpdate: true },
          ncMeta,
        );
      }
      await this.broadcastTableUpdate(ctx, t.tableId, ncMeta);
    }

    for (const t of droppedTables) {
      const childCtx: NcContext = { ...ctx, base_id: t.baseId };
      const childEntry = await BaseTrash.getByResourceId(
        childCtx,
        'table',
        t.tableId,
        ncMeta,
      );
      if (!childEntry) continue; // already restored / purged out-of-band
      await this.tableTrashHandler.restore(childCtx, childEntry, param, ncMeta);
      await BaseTrash.delete(childCtx, childEntry.id, ncMeta);
    }

    await SyncConfig.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    for (const childId of childSyncIds) {
      await SyncConfig.softDelete(ctx, childId, false, ncMeta);
    }

    try {
      await this.syncDataProcessor.reconcileSyncSchema(
        ctx,
        trashEntry.resource_id,
        param.req,
        { skipDataBackfill: true },
        ncMeta,
      );
    } catch (e) {
      this.logger.warn(
        `Restore: schema reconcile failed for sync ${trashEntry.resource_id}: ${
          (e as Error)?.message ?? e
        }`,
        e.stack
      );
    }

    await this.broadcastRestored(
      ctx,
      trashEntry.resource_id,
      'app_sync_create',
      ncMeta,
    );
  }

  private async broadcastTableUpdate(
    ctx: NcContext,
    tableId: string,
    ncMeta?: MetaService,
  ): Promise<void> {
    const table = await Model.getWithInfo(ctx, { id: tableId }, ncMeta);
    if (!table) return;
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: { action: 'table_update', payload: table },
    });
  }

  private async broadcastRestored(
    ctx: NcContext,
    syncConfigId: string,
    action: 'app_sync_create' | 'app_sync_update',
    ncMeta?: MetaService,
  ): Promise<void> {
    const config = await SyncConfig.get(ctx, syncConfigId, false, ncMeta);
    if (!config) return;

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action,
        payload: { ...config, base_id: ctx.base_id },
      },
    });
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.parent_type === 'appSync') {
      await SyncConfig.delete(ctx, trashEntry.resource_id, ncMeta);
      return;
    }

    const { childSyncIds = [], droppedTables = [] } =
      trashEntry.getRelatedItems<AppSyncTrashRelatedItems>();

    // Drop-tables path: hard-delete the dest tables (junction included) still in
    // trash under this sync. Tables the user restored out-of-band (no trash
    // entry) are left alone.
    for (const t of droppedTables) {
      const childCtx: NcContext = { ...ctx, base_id: t.baseId };
      const childEntry = await BaseTrash.getByResourceId(
        childCtx,
        'table',
        t.tableId,
        ncMeta,
      );
      if (!childEntry) continue;
      await this.tableTrashHandler.permanentDelete(
        childCtx,
        childEntry,
        param,
        ncMeta,
      );
      await BaseTrash.delete(childCtx, childEntry.id, ncMeta);
    }

    // Tables were converted to plain tables at trash time and are kept — only
    // the sync metadata is purged here.
    const mappings = await SyncMapping.list(
      ctx,
      { fk_sync_config_id: trashEntry.resource_id, force: true },
      ncMeta,
    );
    for (const m of mappings) {
      await SyncMapping.delete(ctx, m.id, ncMeta);
    }

    // Children are soft-deleted, so the parent's listChildren-based cascade
    // won't see them — hard-delete each child config (+ its integration) first.
    for (const childId of childSyncIds) {
      await SyncConfig.delete(ctx, childId, ncMeta);
    }
    await SyncConfig.delete(ctx, trashEntry.resource_id, ncMeta);
  }

  // If the sync was already hard-deleted out-of-band (e.g. base cleanup),
  // skip the purge but still let the service drop the stale trash row.
  // Otherwise fall through to the base parent-in-trash guard, so an
  // independently-trashed child can't be purged while its parent is in trash —
  // it gets purged via the parent's childTypes cascade instead.
  async beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<boolean> {
    const sync = await SyncConfig.get(
      ctx,
      trashEntry.resource_id,
      true,
      ncMeta,
    );
    if (!sync) return false;
    return super.beforePermanentDelete(ctx, trashEntry, ncMeta);
  }
}
