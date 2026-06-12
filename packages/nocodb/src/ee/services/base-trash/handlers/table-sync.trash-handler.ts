import { Injectable } from '@nestjs/common';
import { EventType, TableSyncMappingRole, TableSyncStatus } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { TableTrashHandler } from '~/services/base-trash/handlers/table.trash-handler';
import { TablesService } from '~/services/tables.service';
import BaseTrash from '~/models/BaseTrash';
import { Column, Model, TableSync, TableSyncMapping } from '~/models';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';

/**
 * Trash handler for Table Sync (`TableSync`).
 *
 * Two delete modes, both routed through this handler via `TableSyncService.delete`:
 *
 *  - Keep tables (`dropTables: false`): trash() converts each destination table
 *    back to a plain editable table (un-sync); restore() re-attaches;
 *    permanentDelete() purges sync metadata while the tables stay. Recorded in
 *    `related_items.tables` (dest base id + readonly column ids).
 *
 *  - Drop tables (`dropTables: true`): trash() soft-deletes every dest table
 *    (junction tables included, junctions last) to trash itself, each stamped
 *    with this sync as its `parent`, and records them in
 *    `related_items.droppedTables` so restore()/permanentDelete() cascade to
 *    them (junctions must come back together — `getMMModel` ignores soft-deleted
 *    junctions, so a junction restored out of step breaks links).
 *
 * The `skipTrash` hard delete is NOT handled here — it stays in
 * `TableSyncService.delete` as the normal (non-restorable) flow.
 *
 * Destination tables can live in a different base (`dest_base_id`), so every
 * table op runs in a dest-scoped context. Dropping the dest tables joins this
 * trash transaction (`ncMeta` threaded into `tablesService.tableDelete`), so
 * the sync soft-delete and every dest-table trash commit or roll back together.
 */
interface TableSyncTrashRelatedItems {
  tables: Array<{
    destBaseId: string;
    tableId: string;
    readonlyColIds: string[];
  }>;
  droppedTables: Array<{ baseId: string; tableId: string }>;
}

/**
 * Delete options for Table Sync — passed verbatim through the generic
 * `TrashCallParam.options` bag. `dropTables` tells trash() to also soft-delete
 * the dest tables (else they're kept, un-synced).
 */
export interface TableSyncTrashOptions {
  dropTables?: boolean;
}

@Injectable()
export class TableSyncTrashHandler extends BaseTrashHandler<TableSync> {
  resourceType = 'tableSync';
  affectedCaches = ['commandPalette', 'baseSchema'] as const;

  constructor(
    private readonly tableTrashHandler: TableTrashHandler,
    private readonly tablesService: TablesService,
    private readonly nocoJobsService: NocoJobsService,
  ) {
    super();
  }

  async trash(
    ctx: NcContext,
    id: string,
    param: TrashCallParam<TableSyncTrashOptions>,
    ncMeta?: MetaService,
  ): Promise<TrashResult<TableSync>> {
    const sync = await TableSync.get(ctx, id, false, ncMeta);
    if (!sync) {
      NcError.get(ctx).tableSyncNotFound(id);
    }

    const dropTables = !!param.options?.dropTables;

    const tables: TableSyncTrashRelatedItems['tables'] = [];
    const droppedTables: Array<{ baseId: string; tableId: string }> = [];

    if (dropTables) {
      // Soft-delete every dest table (junctions last so their MM links resolve)
      // to trash as a child of this sync entry, for cascade restore / purge.
      const orderedMappings = [...(sync.mappings ?? [])].sort(
        (a, b) =>
          (a.role === TableSyncMappingRole.Junction ? 1 : 0) -
          (b.role === TableSyncMappingRole.Junction ? 1 : 0),
      );

      const parent = { type: 'tableSync', id: sync.id, name: sync.title };

      for (const m of orderedMappings) {
        const destCtx: NcContext = {
          ...ctx,
          base_id: m.dest_base_id,
          socket_id: null,
        };
        const model = await Model.get(destCtx, m.dest_table_id, false, ncMeta);
        if (!model) continue;
        await this.tablesService.tableDelete(
          destCtx,
          {
            tableId: m.dest_table_id,
            req: param.req,
            parent,
            forceDeleteSyncs: true,
          },
          ncMeta,
        );
        droppedTables.push({
          baseId: m.dest_base_id,
          tableId: m.dest_table_id,
        });
      }
    } else {
      // Keep tables — convert each non-junction dest table back to a plain,
      // editable table (un-sync). Junction tables back custom-MM LTARs, so they
      // stay synced to keep the kept tables' links routing.
      for (const m of sync.mappings ?? []) {
        if (m.role === TableSyncMappingRole.Junction) continue;

        const destCtx: NcContext = { ...ctx, base_id: m.dest_base_id };
        const model = await Model.get(destCtx, m.dest_table_id, false, ncMeta);
        if (!model) continue;

        await model.getColumns(destCtx, ncMeta);

        const readonlyColIds = (model.columns ?? [])
          .filter((c) => c.readonly && c.id)
          .map((c) => c.id);

        await Model.updateSynced(destCtx, m.dest_table_id, false, ncMeta);

        for (const colId of readonlyColIds) {
          await Column.update2(
            destCtx,
            { colId, column: { readonly: false }, isSimpleUpdate: true },
            ncMeta,
          );
        }

        tables.push({
          destBaseId: m.dest_base_id,
          tableId: m.dest_table_id,
          readonlyColIds,
        });
        await this.broadcastTableUpdate(destCtx, m.dest_table_id, ncMeta);
      }
    }

    await TableSync.softDelete(ctx, id, true, ncMeta);

    return { entity: sync, relatedItems: { tables, droppedTables } };
  }

  /** One `table_update` so clients refresh the grid after a dest table's
   *  `synced` flag + column `readonly` flags flip (un-sync on trash, re-sync on
   *  restore). Dest tables can live in another base, so pass the dest-scoped ctx. */
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

  /** Re-fetch the (now un-deleted) sync and push table_sync_create so live
   *  clients put it back in the list. No socket_id (see broadcastTableUpdate) —
   *  the restoring client has no optimistic re-add. Covers undo-of-delete,
   *  manual restore, and redo-of-create (all route through restore()). */
  private async broadcastRestored(
    ctx: NcContext,
    syncId: string,
    ncMeta?: MetaService,
  ): Promise<void> {
    const sync = await TableSync.get(ctx, syncId, false, ncMeta);
    if (!sync) return;
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'table_sync_create',
        payload: { ...sync, base_id: ctx.base_id },
      },
    });
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    const { tables = [], droppedTables = [] } =
      trashEntry.getRelatedItems<TableSyncTrashRelatedItems>();

    for (const t of tables) {
      const destCtx: NcContext = { ...ctx, base_id: t.destBaseId };
      const model = await Model.get(destCtx, t.tableId, false, ncMeta);
      if (!model) {
        const orphaned = await TableSyncMapping.listByDestTable(
          t.destBaseId,
          t.tableId,
          ncMeta,
        );
        for (const m of orphaned) {
          await TableSyncMapping.deleteById(
            { ...ctx, base_id: m.base_id },
            m.id,
            ncMeta,
          );
        }
        continue;
      }

      await Model.updateSynced(destCtx, t.tableId, true, ncMeta);
      for (const colId of t.readonlyColIds ?? []) {
        const column = await Column.get(destCtx, { colId }, ncMeta);
        if (!column) continue;

        await Column.update2(
          destCtx,
          { colId, column: { readonly: true }, isSimpleUpdate: true },
          ncMeta,
        );
      }
      await this.broadcastTableUpdate(destCtx, t.tableId, ncMeta);
    }

    // Drop-tables path: cascade-restore the child tables (junction included)
    // trashed alongside the sync. They're hidden under the sync in the list, so
    // this is the only way to bring them back, and restoring together keeps the
    // MM links intact. Each child's own trash entry re-syncs it + restores links.
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

    await TableSync.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    const job = await this.nocoJobsService.add(
      JobTypes.TableSyncRun,
      {
        context: ctx,
        syncId: trashEntry.resource_id,
        mode: 'full-resync',
        req: param.req,
      },
      { delay: 5000 },
    );
    await TableSync.update(
      ctx,
      trashEntry.resource_id,
      { status: TableSyncStatus.Syncing, sync_job_id: `${job.id}` },
      ncMeta,
    );

    await this.broadcastRestored(ctx, trashEntry.resource_id, ncMeta);
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    const { droppedTables = [] } =
      trashEntry.getRelatedItems<TableSyncTrashRelatedItems>();

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

    await TableSync.delete(ctx, trashEntry.resource_id, ncMeta);
  }

  async beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<boolean> {
    const sync = await TableSync.get(ctx, trashEntry.resource_id, true, ncMeta);
    return !!sync;
  }
}
