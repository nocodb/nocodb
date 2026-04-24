import { Injectable } from '@nestjs/common';
import { EventType, isLinksOrLTAR, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '../../types';
import {
  BarcodeColumn,
  Filter,
  LookupColumn,
  Model,
  QrCodeColumn,
  RollupColumn,
  Sort,
  View,
} from '~/models';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import Column from '~/models/Column';
import NocoSocket from '~/socket/NocoSocket';

type AffectedColumnType = 'lookup' | 'rollup' | 'qrcode' | 'barcode';

interface AffectedColumn {
  fk_column_id: string;
  type: AffectedColumnType;
  context: NcContext;
}

const COL_OPTION_UPDATERS: Record<
  AffectedColumnType,
  (
    ctx: NcContext,
    colId: string,
    data: { error: string },
    ncMeta: any,
  ) => Promise<any>
> = {
  lookup: LookupColumn.update.bind(LookupColumn),
  rollup: RollupColumn.update.bind(RollupColumn),
  qrcode: QrCodeColumn.update.bind(QrCodeColumn),
  barcode: BarcodeColumn.update.bind(BarcodeColumn),
};

// Dependent column queries used for both discovery and transitive BFS
const DEPENDENT_QUERIES: [MetaTable, string, AffectedColumnType][] = [
  [MetaTable.COL_LOOKUP, 'fk_lookup_column_id', 'lookup'],
  [MetaTable.COL_ROLLUP, 'fk_rollup_column_id', 'rollup'],
  [MetaTable.COL_QRCODE, 'fk_qr_value_column_id', 'qrcode'],
  [MetaTable.COL_BARCODE, 'fk_barcode_value_column_id', 'barcode'],
];

/**
 * When a column is deleted, mark dependent virtual columns (Lookup, Rollup, QR Code, Barcode)
 * with an error instead of cascade-deleting them. This preserves the column metadata for
 * potential restore (soft-delete / base trash).
 */
@Injectable()
export class ColumnDeleteDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  /**
   * Lightweight check: are there any dependents at all?
   * Avoids starting a transaction when nothing needs updating.
   */
  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const deletedColumn = param.oldEntity;
    if (!deletedColumn?.id) return undefined;

    const id = deletedColumn.id;

    for (const [table, fkField] of DEPENDENT_QUERIES) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        { condition: { [fkField]: id } },
      );
      if (rows.length) return {};
    }

    if (isLinksOrLTAR(deletedColumn.uidt)) {
      for (const [table, , type] of DEPENDENT_QUERIES) {
        if (type !== 'lookup' && type !== 'rollup') continue;
        const fkField = 'fk_relation_column_id';
        const rows = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          table,
          { condition: { [fkField]: id } },
        );
        if (rows.length) return {};
      }
    }

    // Check cross-base dependents
    const columns = await Column.list(context, {
      fk_model_id: deletedColumn.fk_model_id,
    });
    for (const column of columns) {
      if (!isLinksOrLTAR(column.uidt)) continue;
      const colOptions = await column.getColOptions<any>(context, ncMeta);
      if (
        !colOptions?.fk_related_base_id ||
        colOptions.fk_related_base_id === deletedColumn.base_id
      )
        continue;

      for (const [table, fkField] of DEPENDENT_QUERIES) {
        if (fkField.includes('qr') || fkField.includes('barcode')) continue;
        const rows = await ncMeta.metaList2(
          context.workspace_id,
          colOptions.fk_related_base_id,
          table,
          { condition: { [fkField]: id } },
        );
        if (rows.length) return {};
      }
    }

    return undefined;
  }

  /**
   * Single BFS pass: discover all dependents (direct + transitive), error-mark
   * each one, and clean up its sorts/filters.
   */
  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const deletedColumn = param.oldEntity;
    if (!deletedColumn?.id) return;

    const id = deletedColumn.id;
    const error = `Field '${
      deletedColumn.title || deletedColumn.column_name
    }' was deleted`;

    // Seed: find all direct dependents of the deleted column
    const visited = new Set<string>();
    const queue: AffectedColumn[] = [];

    const enqueue = (
      fk_column_id: string,
      type: AffectedColumnType,
      ctx: NcContext,
    ) => {
      const key = `${ctx.base_id}:${fk_column_id}`;
      if (visited.has(key)) return;
      visited.add(key);
      queue.push({ fk_column_id, type, context: ctx });
    };

    // Direct dependents — use cache for lookups/rollups (matching original Column.delete pattern)
    for (const [table, fkField, type] of DEPENDENT_QUERIES) {
      let rows: any[];

      if (type === 'lookup' || type === 'rollup') {
        const scope =
          type === 'lookup' ? CacheScope.COL_LOOKUP : CacheScope.COL_ROLLUP;
        const cachedList = await NocoCache.getList(context, scope, [id]);
        const { isNoneList } = cachedList;
        rows = cachedList.list;
        if (!isNoneList && !rows.length) {
          rows = await ncMeta.metaList2(
            context.workspace_id,
            context.base_id,
            table,
            { condition: { [fkField]: id } },
          );
        }
      } else {
        rows = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          table,
          { condition: { [fkField]: id } },
        );
      }

      for (const row of rows) {
        enqueue(row.fk_column_id, type, context);
      }
    }

    // For LTAR columns: lookups/rollups referencing it as their relation
    if (isLinksOrLTAR(deletedColumn.uidt)) {
      for (const row of await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LOOKUP,
        { condition: { fk_relation_column_id: id } },
      )) {
        enqueue(row.fk_column_id, 'lookup', context);
      }

      for (const row of await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_ROLLUP,
        { condition: { fk_relation_column_id: id } },
      )) {
        enqueue(row.fk_column_id, 'rollup', context);
      }
    }

    // Cross-base dependents
    const columns = await Column.list(context, {
      fk_model_id: deletedColumn.fk_model_id,
    });
    for (const column of columns) {
      if (!isLinksOrLTAR(column.uidt)) continue;
      const colOptions = await column.getColOptions<any>(context, ncMeta);
      if (
        !colOptions?.fk_related_base_id ||
        colOptions.fk_related_base_id === deletedColumn.base_id
      )
        continue;

      const crossCtx = { ...context, base_id: colOptions.fk_related_base_id };

      for (const row of await ncMeta.metaList2(
        context.workspace_id,
        colOptions.fk_related_base_id,
        MetaTable.COL_LOOKUP,
        { condition: { fk_lookup_column_id: id } },
      )) {
        enqueue(row.fk_column_id, 'lookup', crossCtx);
      }

      for (const row of await ncMeta.metaList2(
        context.workspace_id,
        colOptions.fk_related_base_id,
        MetaTable.COL_ROLLUP,
        { condition: { fk_rollup_column_id: id } },
      )) {
        enqueue(row.fk_column_id, 'rollup', crossCtx);
      }
    }

    // Collect unique model IDs (with their column's context) whose single-query
    // cache needs clearing. Context may differ for cross-base dependents.
    const affectedModelCtxMap = new Map<string, NcContext>();

    // BFS: error-mark each dependent, clean up sorts/filters, discover transitive dependents
    while (queue.length > 0) {
      const affected = queue.shift();
      const ctx = affected.context;

      await COL_OPTION_UPDATERS[affected.type](
        ctx,
        affected.fk_column_id,
        { error },
        ncMeta,
      );
      await this.cleanupSortsAndFilters(ctx, affected.fk_column_id, ncMeta);

      // Discover transitive dependents of this just-marked column (same base)
      for (const [table, fkField, type] of DEPENDENT_QUERIES) {
        for (const row of await ncMeta.metaList2(
          ctx.workspace_id,
          ctx.base_id,
          table,
          { condition: { [fkField]: affected.fk_column_id } },
        )) {
          enqueue(row.fk_column_id, type, ctx);
        }
      }

      // Discover transitive cross-base dependents
      const affectedCol = await Column.get(
        ctx,
        { colId: affected.fk_column_id },
        ncMeta,
      );
      if (affectedCol?.fk_model_id) {
        // Derive context from the column's own base_id/workspace_id (authoritative
        // source), matching the pattern in Column.get → getColOptions.
        if (!affectedModelCtxMap.has(affectedCol.fk_model_id)) {
          affectedModelCtxMap.set(affectedCol.fk_model_id, {
            ...context,
            workspace_id: affectedCol.fk_workspace_id || context.workspace_id,
            base_id: affectedCol.base_id,
          });
        }

        const tableColumns = await Column.list(
          ctx,
          { fk_model_id: affectedCol.fk_model_id },
          ncMeta,
        );
        for (const col of tableColumns) {
          if (!isLinksOrLTAR(col.uidt)) continue;
          const opts = await col.getColOptions<any>(ctx, ncMeta);
          if (
            !opts?.fk_related_base_id ||
            opts.fk_related_base_id === ctx.base_id
          )
            continue;

          const crossCtx = { ...ctx, base_id: opts.fk_related_base_id };
          for (const row of await ncMeta.metaList2(
            ctx.workspace_id,
            opts.fk_related_base_id,
            MetaTable.COL_LOOKUP,
            { condition: { fk_lookup_column_id: affected.fk_column_id } },
          )) {
            enqueue(row.fk_column_id, 'lookup', crossCtx);
          }
          for (const row of await ncMeta.metaList2(
            ctx.workspace_id,
            opts.fk_related_base_id,
            MetaTable.COL_ROLLUP,
            { condition: { fk_rollup_column_id: affected.fk_column_id } },
          )) {
            enqueue(row.fk_column_id, 'rollup', crossCtx);
          }
        }
      }
    }

    // Clear single-query cache for all affected tables so stale CTE SQL
    // (which may reference the now-deleted column) is not reused.
    // Use each model's own context since cross-base models have different base_id.
    for (const [modelId, modelCtx] of affectedModelCtxMap) {
      await View.clearSingleQueryCache(modelCtx, modelId, null, ncMeta);
    }

    // Broadcast realtime updates so other clients refresh field metadata
    // for tables whose columns were error-marked.
    for (const [modelId, modelCtx] of affectedModelCtxMap) {
      const model = await Model.get(modelCtx, modelId, false, ncMeta);
      if (!model) continue;

      await model.getColumns(modelCtx, ncMeta);

      NocoSocket.broadcastEvent(modelCtx, {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_update',
          payload: { table: model, column: {}, skipDataReload: true },
        },
      } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
    }
  }

  private async cleanupSortsAndFilters(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    for (const sort of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { condition: { fk_column_id: columnId } },
    )) {
      await Sort.delete(context, sort.id, ncMeta);
    }

    for (const filter of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: {
          _or: [
            { fk_column_id: { eq: columnId } },
            { fk_value_col_id: { eq: columnId } },
          ],
        },
      },
    )) {
      await Filter.delete(context, filter.id, ncMeta);
    }
  }
}
