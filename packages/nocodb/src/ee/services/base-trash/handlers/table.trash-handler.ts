import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  generateUniqueCopyName,
  MetaEventType,
  PlanLimitTypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import type { MetaService } from '~/meta/meta.service';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { getLimit } from '~/helpers/paymentHelpers';
import { Column, Model, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { ColumnsService } from '~/services/columns.service';
import { LinkPlaceholderService } from '~/services/link-placeholder.service';
import { TablesService } from '~/services/tables.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { clearDependentErrorsIfResolved } from '~/services/base-trash/dependent-error-helpers';
import { CacheScope, MetaTable } from '~/utils/globals';

interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

@Injectable()
export class TableTrashHandler extends BaseTrashHandler<Model> {
  resourceType = 'table';
  childTypes = ['view', 'field', 'record', 'hook'];
  affectedCaches = ['commandPalette', 'baseSchema'] as const;

  private logger = new Logger(TableTrashHandler.name);

  constructor(
    private readonly metaDependencyEventHandler: MetaDependencyEventHandler,
    private readonly tablesService: TablesService,
    private readonly columnsService: ColumnsService,
    private readonly linkPlaceholderService: LinkPlaceholderService,
  ) {
    super();
  }

  async checkRestoreLimit(
    ctx: NcContext,
    trashEntry: BaseTrash,
  ): Promise<void> {
    const table = await Model.get(ctx, trashEntry.resource_id, true);
    if (!table) return;

    const current = await Noco.ncMeta.metaCount(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.MODELS,
      {
        condition: { source_id: table.source_id },
        xcCondition: {
          _and: [
            { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
            { _or: [{ mm: { eq: false } }, { mm: { eq: null } }] },
          ],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_TABLE_PER_BASE,
      ctx.workspace_id,
    );

    if (limit !== Infinity && current >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} tables for your plan. Upgrade to restore this table.`,
        { plan: plan?.title, limit, current },
      );
    }
  }

  // ── Trash ──────────────────────────────────────────────────

  async trash(
    ctx: NcContext,
    id: string,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Model>> {
    const table = await Model.getByIdOrName(ctx, { id }, ncMeta);
    if (!table) {
      NcError.get(ctx).tableNotFound(id);
    }

    // Soft-delete the table
    await Model.softDelete(ctx, table.id, true, ncMeta);

    await this.metaDependencyEventHandler.handleEvent(
      ctx,
      {
        eventType: MetaEventType.TABLE_DELETED,
        oldEntity: table,
      },
      ncMeta,
    );

    // Cascade: soft-delete all reverse LTAR columns in OTHER tables + create placeholders
    const cascadedColumns = await this.cascadeLinksOnTrash(
      ctx,
      table.id,
      ncMeta,
    );

    // Mark dependents of cascade-deleted columns
    const dependents: Array<{ id: string; type: string }> = [];
    if (cascadedColumns?.length) {
      for (const item of cascadedColumns) {
        const col = await Column.get(
          ctx,
          {
            colId: item.id,
            includeDeleted: true,
          },
          ncMeta,
        );
        if (col) {
          await this.markDependentsAndCollect(ctx, col, dependents, ncMeta);
        }
      }
    }

    // Mark dependents for ALL columns inside the trashed table
    // (other tables may have Lookups/Rollups referencing these columns)
    await this.markDependentsForTableColumns(ctx, table.id, dependents, ncMeta);

    // Build related_items
    const relatedItems: Record<string, any> = {};
    if (cascadedColumns?.length) {
      relatedItems.columns = cascadedColumns;
    }
    if (dependents.length) {
      relatedItems.dependents = dependents;
    }
    // Socket broadcast
    NocoSocket.broadcastEvent(
      ctx,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_delete',
          payload: table,
        },
      } as Parameters<typeof NocoSocket.broadcastEvent>[1],
      ctx.socket_id,
    );

    return {
      entity: table,
      relatedItems: Object.keys(relatedItems).length ? relatedItems : undefined,
    };
  }

  // ── Restore ────────────────────────────────────────────────

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    // Resolve title collision — rename restored table if a live table in the
    // same source already holds the original title. table_name never collides
    // on restore: any new table created after this one was trashed would have
    // been uniquified at create time (see TablesService.tableCreate trashed-
    // name dedup), so the trashed row still owns its original table_name.
    if (trashEntry.name) {
      const trashedTable = await Model.get(
        ctx,
        trashEntry.resource_id,
        true,
        ncMeta,
      );
      if (trashedTable?.source_id) {
        const liveTables = await Model.list(
          ctx,
          {
            base_id: ctx.base_id,
            source_id: trashedTable.source_id,
          },
          ncMeta,
        );
        const existingTitles = liveTables.map((t) => t.title);
        if (existingTitles.includes(trashEntry.name)) {
          const newTitle = generateUniqueCopyName(
            trashEntry.name,
            existingTitles,
            { prefix: 'Restored' },
          );
          await ncMeta.metaUpdate(
            ctx.workspace_id,
            ctx.base_id,
            MetaTable.MODELS,
            { title: newTitle },
            trashEntry.resource_id,
          );
          await NocoCache.update(
            ctx,
            `${CacheScope.MODEL}:${trashEntry.resource_id}`,
            { title: newTitle },
          );
        }
      }
    }

    // Un-soft-delete the table
    await Model.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    // Restore cascaded link columns + drop placeholders
    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.columns?.length) {
      await this.restoreCascadedLinks(ctx, relatedItems.columns, param, ncMeta);
    }

    // Handle deferred restores (mutually-trashed tables)
    await this.restoreDeferredLinks(ctx, trashEntry.resource_id, param, ncMeta);

    if (relatedItems?.dependents?.length) {
      await clearDependentErrorsIfResolved(
        ctx,
        relatedItems.dependents,
        ncMeta,
      );
    }

    // Socket broadcast — use table_create so frontend adds back to sidebar
    const restoredTable = await Model.getWithInfo(
      ctx,
      { id: trashEntry.resource_id },
      ncMeta,
    );

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'table_create',
        payload: restoredTable,
      },
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    // Broadcast column_add for each related table whose columns were restored
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        const relatedModel = await Model.getWithInfo(
          ctx,
          { id: item.table_id },
          ncMeta,
        );
        if (relatedModel) {
          const restoredCol = await Column.get(ctx, { colId: item.id }, ncMeta);
          NocoSocket.broadcastEvent(ctx, {
            event: EventType.META_EVENT,
            payload: {
              action: 'column_add',
              payload: { table: relatedModel, column: restoredCol },
            } as Record<string, unknown>,
          } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
        }
      }
    }
  }

  // ── Permanent Delete ───────────────────────────────────────

  /**
   * Returns `false` when the model row is gone (hard-deleted out-of-band).
   * The orchestrator then drops the trash entry without running cleanup —
   * which would otherwise flip cascaded reverse columns to live before
   * `tablesService.tableDelete` throws on the missing model.
   */
  async beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<boolean> {
    await super.beforePermanentDelete(ctx, trashEntry, ncMeta);

    const existing = await Model.get(ctx, trashEntry.resource_id, true, ncMeta);
    if (!existing) {
      this.logger.log(
        `Trash entry ${trashEntry.id} table ${trashEntry.resource_id} already gone; clearing entry.`,
      );
      return false;
    }
    return true;
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    const relatedItems = trashEntry.getRelatedItems();

    // Restore cascaded reverse columns so tableDelete can properly clean up relations
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        await ncMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: false },
          item.id,
        );
        const freshCol = await ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          item.id,
        );
        if (freshCol) {
          await NocoCache.set(ctx, `${CacheScope.COLUMN}:${item.id}`, freshCol);
        }
      }
    }

    // Restore table + columns temporarily so tableDelete can run full cleanup
    await Model.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    // Restore soft-deleted columns and update cache
    const deletedCols = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      {
        condition: { fk_model_id: trashEntry.resource_id, deleted: true },
      },
    );
    for (const col of deletedCols) {
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        col.id,
      );
      await NocoCache.set(ctx, `${CacheScope.COLUMN}:${col.id}`, {
        ...col,
        deleted: false,
      });
    }

    // Run existing hard-delete chain (handles FK constraints, junction tables, view columns, etc.)
    await this.tablesService.tableDelete(
      ctx,
      {
        tableId: trashEntry.resource_id,
        req: param.req,
        forceDeleteRelations: true,
        skipLinkPlaceholder: true,
        skipTrash: true,
      },
      ncMeta,
    );
  }

  // ── Cascade: All Reverse Links in Other Tables ─────────────

  private async cascadeLinksOnTrash(
    ctx: NcContext,
    tableId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<CascadedColumn[]> {
    // Find all relations that point TO this table from OTHER tables
    const reverseRelations = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { condition: { fk_related_model_id: tableId } },
    );

    if (!reverseRelations.length) return [];

    const cascaded: CascadedColumn[] = [];

    for (const rel of reverseRelations) {
      const col = await Column.get(
        ctx,
        { colId: rel.fk_column_id, includeDeleted: true },
        ncMeta,
      );

      // Skip columns that belong to the trashed table itself
      if (!col || col.fk_model_id === tableId) continue;

      // Skip already deleted columns
      if (col.deleted) continue;

      // Skip if the column's table is also trashed
      const colTable = await Model.get(ctx, col.fk_model_id, true, ncMeta);
      if (!colTable || colTable.deleted) continue;

      // Create placeholder column before soft-deleting — the placeholder's
      // display-value population may resolve a Formula pv that references
      // this link column.  If the column is already soft-deleted,
      // formulaQueryBuilderv2 filters it out and generates invalid SQL.
      //
      // Use Noco.ncMeta (autocommit) — not the trash transaction. The DDL
      // path (sqlMgr.sqlOpPlus → ALTER TABLE) acquires a table lock, and
      // populatePlaceholderValues then runs UPDATE on a separate connection
      // pool; routing the DDL through the open meta tx would block the
      // UPDATE on PG and the file lock on SQLite. Tradeoff: if the trash
      // tx rolls back, the placeholder column is committed and orphaned.
      const placeholder = await this.linkPlaceholderService.createPlaceholder(
        ctx,
        col,
        colTable,
        '_nc_trash_ph_',
        Noco.ncMeta,
      );

      // Soft-delete the reverse link column
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: true },
        col.id,
      );
      await NocoCache.update(ctx, `${CacheScope.COLUMN}:${col.id}`, {
        deleted: true,
      });

      // Clear query caches on the affected table
      await View.clearSingleQueryCache(
        {
          ...ctx,
          workspace_id: colTable.fk_workspace_id,
          base_id: colTable.base_id,
        },
        col.fk_model_id,
        null,
        ncMeta,
      );

      if (placeholder) {
        cascaded.push({
          id: col.id,
          placeholder_id: placeholder.id,
          table_id: col.fk_model_id,
        });
      }
    }

    return cascaded;
  }

  // ── Restore Cascaded Links ─────────────────────────────────

  private async restoreCascadedLinks(
    ctx: NcContext,
    columns: CascadedColumn[],
    param: TrashCallParam,
    ncMeta?: MetaService,
  ) {
    for (const item of columns) {
      const colTable = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );

      if (colTable?.deleted) continue; // Deferred

      // Drop placeholder
      if (item.placeholder_id) {
        const phCol = await Column.get(
          ctx,
          { colId: item.placeholder_id },
          ncMeta,
        );
        if (phCol) {
          await this.columnsService.columnDelete(
            ctx,
            {
              columnId: item.placeholder_id,
              req: param.req,
              forceDeleteSystem: true,
              skipTrash: true,
            },
            ncMeta,
          );
        }
      }

      // Restore original column
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        item.id,
      );
      const freshCol = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        item.id,
      );
      if (freshCol) {
        await NocoCache.set(ctx, `${CacheScope.COLUMN}:${item.id}`, freshCol);
      }

      if (colTable) {
        await View.clearSingleQueryCache(
          {
            ...ctx,
            workspace_id: colTable.fk_workspace_id,
            base_id: colTable.base_id,
          },
          item.table_id,
          null,
          ncMeta,
        );
      }
    }
  }

  /**
   * When table A is restored, check if any OTHER trashed tables had
   * link columns pointing to A that were deferred. If those tables are now live, restore those links.
   */
  private async restoreDeferredLinks(
    ctx: NcContext,
    restoredTableId: string,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ) {
    const allTableTrash = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.TRASH,
      { condition: { resource_type: 'table' } },
    );

    for (const entry of allTableTrash) {
      if (!entry.related_items) continue;

      let relatedItems;
      try {
        relatedItems =
          typeof entry.related_items === 'object'
            ? entry.related_items
            : JSON.parse(entry.related_items);
      } catch {
        continue;
      }

      if (!relatedItems?.columns?.length) continue;

      const deferredForThisTable = relatedItems.columns.filter(
        (c: CascadedColumn) => c.table_id === restoredTableId,
      );

      if (!deferredForThisTable.length) continue;

      // Check if the entry's own table is still trashed
      const entryModel = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        entry.resource_id,
      );

      if (entryModel?.deleted) continue;

      // Restore deferred columns
      for (const item of deferredForThisTable) {
        if (item.placeholder_id) {
          const phCol = await Column.get(
            ctx,
            { colId: item.placeholder_id },
            ncMeta,
          );
          if (phCol) {
            await this.columnsService.columnDelete(
              ctx,
              {
                columnId: item.placeholder_id,
                req: param.req,
                forceDeleteSystem: true,
                skipTrash: true,
              },
              ncMeta,
            );
          }
        }

        await ncMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: false },
          item.id,
        );
        const freshDefCol = await ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          item.id,
        );
        if (freshDefCol) {
          await NocoCache.set(
            ctx,
            `${CacheScope.COLUMN}:${item.id}`,
            freshDefCol,
          );
        }
      }

      await View.clearSingleQueryCache(ctx, restoredTableId, null, ncMeta);
    }
  }

  // ── Dependency Marking ─────────────────────────────────────

  private async markDependentsAndCollect(
    ctx: NcContext,
    col: Column,
    dependents: Array<{ id: string; type: string }>,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const lookups = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_LOOKUP,
      {
        xcCondition: {
          _or: [
            { fk_relation_column_id: { eq: col.id } },
            { fk_lookup_column_id: { eq: col.id } },
          ],
        },
      },
    );
    const rollups = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_ROLLUP,
      {
        xcCondition: {
          _or: [
            { fk_relation_column_id: { eq: col.id } },
            { fk_rollup_column_id: { eq: col.id } },
          ],
        },
      },
    );
    const qrCodes = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_QRCODE,
      {
        condition: { fk_qr_value_column_id: col.id },
      },
    );
    const barcodes = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_BARCODE,
      {
        condition: { fk_barcode_value_column_id: col.id },
      },
    );

    await this.metaDependencyEventHandler.handleEvent(
      ctx,
      {
        eventType: MetaEventType.COLUMN_DELETED,
        oldEntity: col,
      },
      ncMeta,
    );

    for (const r of lookups)
      dependents.push({ id: r.fk_column_id, type: 'lookup' });
    for (const r of rollups)
      dependents.push({ id: r.fk_column_id, type: 'rollup' });
    for (const r of qrCodes)
      dependents.push({ id: r.fk_column_id, type: 'qrcode' });
    for (const r of barcodes)
      dependents.push({ id: r.fk_column_id, type: 'barcode' });
  }

  /**
   * Mark dependents for ALL columns inside the trashed table.
   * Other tables may have Lookups/Rollups referencing these columns.
   */
  private async markDependentsForTableColumns(
    ctx: NcContext,
    tableId: string,
    dependents: Array<{ id: string; type: string }>,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    try {
      const columns = await Column.list(
        ctx,
        {
          fk_model_id: tableId,
          includeDeleted: true,
        },
        ncMeta,
      );

      for (const col of columns) {
        await this.markDependentsAndCollect(ctx, col, dependents, ncMeta);
      }
    } catch (e) {
      this.logger.error(
        `Failed to mark dependents for table columns ${tableId}: ${e.message}`,
        e.stack,
      );
    }
  }
}
