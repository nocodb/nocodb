import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  isLinksOrLTAR,
  MetaEventType,
  NOCO_SERVICE_USERS,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import type { MetaService } from '~/meta/meta.service';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import NocoCache from '~/cache/NocoCache';
import { NcBaseError, NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { ColumnsService } from '~/services/columns.service';
import { LinkPlaceholderService } from '~/services/link-placeholder.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { CacheScope, MetaTable } from '~/utils/globals';

interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

@Injectable()
export class FieldTrashHandler implements TrashHandler<Column> {
  resourceType = 'field';

  private logger = new Logger(FieldTrashHandler.name);

  constructor(
    private readonly metaDependencyEventHandler: MetaDependencyEventHandler,
    private readonly columnsService: ColumnsService,
    private readonly linkPlaceholderService: LinkPlaceholderService,
  ) {}

  async trash(
    ctx: NcContext,
    id: string,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Column>> {
    const col = await Column.get(ctx, { colId: id }, ncMeta);
    if (!col) {
      NcError.get(ctx).fieldNotFound(id);
    }

    const table = await Model.getByIdOrName(
      ctx,
      { id: col.fk_model_id },
      ncMeta,
    );

    // Find reverse link column before transaction (read-only)
    let reverseCol: Column | null = null;
    if (isLinksOrLTAR(col)) {
      reverseCol = await this.linkPlaceholderService.findReverseLinkColumn(
        ctx,
        col.id,
        ncMeta,
      );
    }

    // Create placeholder before soft-deleting — the placeholder's
    // display-value population may resolve a Formula pv that references
    // these link columns.  If columns are already soft-deleted,
    // formulaQueryBuilderv2 filters them out and generates invalid SQL.
    let cascadeResult: { columns: CascadedColumn[] } | null = null;
    if (reverseCol) {
      const result =
        await this.linkPlaceholderService.createPlaceholderForReverse(
          ctx,
          reverseCol,
          '_nc_trash_ph_',
          ncMeta,
        );
      if (result) {
        cascadeResult = {
          columns: [
            {
              id: result.reverseCol.id,
              placeholder_id: result.placeholder.id,
              table_id: result.table_id,
            },
          ],
        };
      }
    }

    // Soft-delete column + reverse column atomically.
    // If caller passed a transaction, piggy-back on it; otherwise start our own.
    const useCallerTxn = !!ncMeta;
    const txnMeta = useCallerTxn
      ? ncMeta
      : await (Noco.ncMeta as MetaService).startTransaction();
    try {
      await txnMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: true },
        col.id,
      );
      await NocoCache.update(ctx, `${CacheScope.COLUMN}:${col.id}`, {
        deleted: true,
      });
      await View.clearSingleQueryCache(ctx, col.fk_model_id, null, txnMeta);

      // Soft-delete reverse link column in the same transaction
      if (reverseCol) {
        await txnMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: true },
          reverseCol.id,
        );
        await NocoCache.update(ctx, `${CacheScope.COLUMN}:${reverseCol.id}`, {
          deleted: true,
        });
      }

      if (!useCallerTxn) await txnMeta.commit();
    } catch (e) {
      if (!useCallerTxn) await txnMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      throw e;
    }

    // Mark formula/button dependents (same table, sync)
    const dependents: Array<{ id: string; type: string }> = [];
    await this.markFormulaErrors(ctx, col, dependents, ncMeta);

    // Mark Lookup/Rollup/QrCode/Barcode dependents (async BFS)
    await this.markDependentsAndCollect(ctx, col, dependents, ncMeta);

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns || []) {
        const cascadedCol = await Column.get(
          ctx,
          {
            colId: item.id,
            includeDeleted: true,
          },
          ncMeta,
        );
        if (cascadedCol) {
          await this.markDependentsAndCollect(
            ctx,
            cascadedCol,
            dependents,
            ncMeta,
          );
        }
      }
    }

    // Build related_items
    const relatedItems: Record<string, any> = {};
    if (cascadeResult?.columns?.length) {
      relatedItems.columns = cascadeResult.columns;
    }
    if (dependents.length) {
      relatedItems.dependents = dependents;
    }

    // Socket broadcast
    await table.getColumns(ctx, ncMeta);

    NocoSocket.broadcastEvent(
      ctx,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_delete',
          payload: { table, column: col },
        } as Record<string, unknown>,
      } as Parameters<typeof NocoSocket.broadcastEvent>[1],
      ctx.socket_id,
    );

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns) {
        const relatedTable = await Model.getWithInfo(
          ctx,
          {
            id: item.table_id,
          },
          ncMeta,
        );
        NocoSocket.broadcastEvent(ctx, {
          event: EventType.META_EVENT,
          payload: {
            action: 'column_delete',
            payload: { table: relatedTable },
          } as Record<string, unknown>,
        } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
      }
    }

    return {
      entity: col,
      relatedItems: Object.keys(relatedItems).length ? relatedItems : undefined,
      meta: { uidt: col.uidt },
      parentType: 'table',
      parentId: col.fk_model_id,
      parentName: table?.title,
    };
  }

  // ── Restore ────────────────────────────────────────────────

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    // Validate parent
    if (trashEntry.parent_id) {
      const parentTable = await Model.get(ctx, trashEntry.parent_id, true);
      if (!parentTable) {
        NcError.get(ctx).tableNotFound(trashEntry.parent_id);
      }
      if (parentTable.deleted) {
        NcError.get(ctx).parentInTrash('table');
      }
    }

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    try {
      // Restore column — update DB
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        trashEntry.resource_id,
      );
      const freshCol = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        trashEntry.resource_id,
      );
      if (freshCol) {
        await NocoCache.set(
          ctx,
          `${CacheScope.COLUMN}:${trashEntry.resource_id}`,
          freshCol,
        );
      }
      await View.clearSingleQueryCache(ctx, trashEntry.parent_id, null, ncMeta);

      // Restore cascaded link columns + drop placeholders
      await this.restoreCascadedLinks(ctx, trashEntry, ncMeta);

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e.message, e.stack);
      throw e;
    }

    // Clear dependent errors
    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.dependents?.length) {
      await this.clearDependentErrors(ctx, relatedItems.dependents);
    }

    // Socket broadcast — include the restored column so frontend can update
    const restoredTable = await Model.getWithInfo(ctx, {
      id: trashEntry.parent_id,
    });

    const restoredCol = await Column.get(ctx, {
      colId: trashEntry.resource_id,
    });

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_add',
        payload: { table: restoredTable, column: restoredCol },
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        const relatedModel = await Model.getWithInfo(ctx, {
          id: item.table_id,
        });
        if (relatedModel) {
          const relatedCol = await Column.get(ctx, { colId: item.id });
          NocoSocket.broadcastEvent(ctx, {
            event: EventType.META_EVENT,
            payload: {
              action: 'column_add',
              payload: { table: relatedModel, column: relatedCol },
            } as Record<string, unknown>,
          } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
        }
      }
    }
  }

  // ── Permanent Delete ───────────────────────────────────────

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    const relatedItems = trashEntry.getRelatedItems();
    // Restore cascaded reverse columns temporarily so columnsService can find them
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        await Noco.ncMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: false },
          item.id,
        );
        const freshCol = await Noco.ncMeta.metaGet2(
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

    // Restore primary column temporarily
    await Noco.ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      { deleted: false },
      trashEntry.resource_id,
    );
    const freshCol = await Noco.ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      trashEntry.resource_id,
    );
    if (freshCol) {
      await NocoCache.set(
        ctx,
        `${CacheScope.COLUMN}:${trashEntry.resource_id}`,
        freshCol,
      );
    }

    // Use columnsService for full cleanup (FK constraints, junction tables, view columns, etc.)
    await this.columnsService.columnDelete(ctx, {
      columnId: trashEntry.resource_id,
      user: NOCO_SERVICE_USERS.TRASH_CLEANUP_USER as any,
      forceDeleteSystem: true,
      skipLinkPlaceholder: true,
    });
  }

  // ── Restore Cascaded Links ─────────────────────────────────

  private async restoreCascadedLinks(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: any,
  ) {
    const relatedItems = trashEntry.getRelatedItems();
    if (!relatedItems?.columns?.length) return;

    for (const item of relatedItems.columns) {
      const colTable = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );

      if (colTable?.deleted) continue; // Deferred

      // Delete placeholder column (skip if already deleted)
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
              user: {} as any,
              forceDeleteSystem: true,
            },
            ncMeta,
          );
        }
      }

      // Restore original column — update DB
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        item.id,
      );
      const freshRevCol = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        item.id,
      );
      if (freshRevCol) {
        await NocoCache.set(
          ctx,
          `${CacheScope.COLUMN}:${item.id}`,
          freshRevCol,
        );
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

  // ── Dependency Marking ─────────────────────────────────────

  private async markFormulaErrors(
    ctx: NcContext,
    col: Column,
    dependents: Array<{ id: string; type: string }>,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const columns = await Column.list(
      ctx,
      { fk_model_id: col.fk_model_id },
      ncMeta,
    );

    for (const formulaCol of columns.filter(
      (c) => c.uidt === UITypes.Formula,
    )) {
      const formula = await formulaCol.getColOptions<FormulaColumn>(
        ctx,
        ncMeta,
      );
      if (
        formula?.formula &&
        addFormulaErrorIfMissingColumn({
          formula,
          columnId: col.id,
          title: col.title,
        })
      ) {
        await FormulaColumn.update(
          ctx,
          formulaCol.id,
          formula as FormulaColumn & { parsed_tree?: any },
          ncMeta,
        );
        dependents.push({ id: formulaCol.id, type: 'formula' });
      }
    }

    for (const buttonCol of columns.filter((c) => c.uidt === UITypes.Button)) {
      const button = await buttonCol.getColOptions<ButtonColumn>(ctx, ncMeta);
      if (
        button?.type === 'url' &&
        button.formula &&
        addFormulaErrorIfMissingColumn({
          formula: button,
          columnId: col.id,
          title: col.title,
        })
      ) {
        await ButtonColumn.update(ctx, buttonCol.id, button as any, ncMeta);
        dependents.push({ id: buttonCol.id, type: 'button' });
      }
    }
  }

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

  private async clearDependentErrors(
    ctx: NcContext,
    dependents: Array<{ id: string; type: string }>,
  ) {
    type ErrorUpdater = (
      cx: NcContext,
      colId: string,
      data: Record<string, unknown>,
    ) => Promise<any>;

    const updaters: Record<string, ErrorUpdater> = {
      lookup: LookupColumn.update.bind(LookupColumn),
      rollup: RollupColumn.update.bind(RollupColumn),
      qrcode: QrCodeColumn.update.bind(QrCodeColumn),
      barcode: BarcodeColumn.update.bind(BarcodeColumn),
      formula: FormulaColumn.update.bind(FormulaColumn),
      button: ButtonColumn.update.bind(ButtonColumn),
    };

    for (const dep of dependents) {
      try {
        const updater = updaters[dep.type];
        if (updater) await updater(ctx, dep.id, { error: null });
      } catch (e) {
        this.logger.error(
          `Failed to clear error on dependent ${dep.id}: ${e.message}`,
          e.stack,
        );
      }
    }
  }
}
