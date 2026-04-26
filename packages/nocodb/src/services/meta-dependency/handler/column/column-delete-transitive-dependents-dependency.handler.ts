import { Injectable } from '@nestjs/common';
import { EventType, isLinksOrLTAR, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import {
  BarcodeColumn,
  LookupColumn,
  Model,
  QrCodeColumn,
  RollupColumn,
  View,
} from '~/models';
import Column from '~/models/Column';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { ColumnDeleteFilterDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-filter-dependency.handler';
import { ColumnDeleteCoverImageDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-cover-image-dependency.handler';
import { ColumnDeleteKanbanGroupByDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-kanban-groupby-dependency.handler';
import { ColumnDeleteCalendarRangeDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-calendar-range-dependency.handler';
import { ColumnDeleteHookTriggerDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-hook-trigger-dependency.handler';

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

const DEPENDENT_QUERIES: [MetaTable, string, AffectedColumnType][] = [
  [MetaTable.COL_LOOKUP, 'fk_lookup_column_id', 'lookup'],
  [MetaTable.COL_ROLLUP, 'fk_rollup_column_id', 'rollup'],
  [MetaTable.COL_QRCODE, 'fk_qr_value_column_id', 'qrcode'],
  [MetaTable.COL_BARCODE, 'fk_barcode_value_column_id', 'barcode'],
];

/**
 * BFS over virtual columns (Lookup / Rollup / QR Code / Barcode) that
 * depended on the deleted column. Each dependent is *error-marked* (its col
 * options get an `error` field) so its metadata survives a future restore;
 * its own sorts / filters / cover-image / kanban-stack-by / calendar-range
 * / hook-trigger refs are swept the same way the per-concern delete
 * handlers sweep the root column.
 *
 * Walks same-base AND cross-base dependents (links/LTAR cross-base
 * lookups/rollups). After the BFS, clears the optimised single-query cache
 * for every affected model and broadcasts a realtime `column_update` so
 * remote clients pick up the new error state.
 */
@Injectable()
export class ColumnDeleteTransitiveDependentsDependencyHandler
  implements MetaEventHandler
{
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  /**
   * Per-concern delete handlers that we replay for each error-marked
   * transitive dependent. The framework blocks recursive `COLUMN_DELETED`
   * dispatch (`suppressDependencyEvaluation`), so we invoke each handler's
   * `handle()` directly with a synthetic param. Keeps the transitive
   * cleanup behavior identical to a regular column delete without
   * duplicating any cleanup bodies.
   *
   * Expanded-mode + row-color are intentionally omitted — those concerns
   * applied only to the root delete in the original handler too.
   */
  constructor(
    private readonly filterHandler: ColumnDeleteFilterDependencyHandler,
    private readonly coverImageHandler: ColumnDeleteCoverImageDependencyHandler,
    private readonly kanbanGroupByHandler: ColumnDeleteKanbanGroupByDependencyHandler,
    private readonly calendarRangeHandler: ColumnDeleteCalendarRangeDependencyHandler,
    private readonly hookTriggerHandler: ColumnDeleteHookTriggerDependencyHandler,
  ) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const deletedColumn = param.oldEntity;
    if (!deletedColumn?.id) return undefined;

    const id = deletedColumn.id;

    // Same-base dependents.
    for (const [table, fkField] of DEPENDENT_QUERIES) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        { condition: { [fkField]: id } },
      );
      if (rows.length) return {};
    }

    // Same-base lookups/rollups whose relation column is the deleted col.
    if (isLinksOrLTAR(deletedColumn.uidt)) {
      for (const [table, , type] of DEPENDENT_QUERIES) {
        if (type !== 'lookup' && type !== 'rollup') continue;
        const rows = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          table,
          { condition: { fk_relation_column_id: id } },
        );
        if (rows.length) return {};
      }
    }

    // Cross-base dependents.
    const columns = await Column.list(context, {
      fk_model_id: deletedColumn.fk_model_id,
    });
    for (const column of columns) {
      if (!isLinksOrLTAR(column.uidt)) continue;
      const colOptions = await column.getColOptions<any>(context, ncMeta);
      if (
        !colOptions?.fk_related_base_id ||
        colOptions.fk_related_base_id === deletedColumn.base_id
      ) {
        continue;
      }
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

    // Seed: direct dependents of the deleted column.
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

    // Cross-base dependents.
    const columns = await Column.list(context, {
      fk_model_id: deletedColumn.fk_model_id,
    });
    for (const column of columns) {
      if (!isLinksOrLTAR(column.uidt)) continue;
      const colOptions = await column.getColOptions<any>(context, ncMeta);
      if (
        !colOptions?.fk_related_base_id ||
        colOptions.fk_related_base_id === deletedColumn.base_id
      ) {
        continue;
      }

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

    // BFS: error-mark each dependent, clean their refs, discover transitive
    // dependents and continue.
    const affectedModelCtxMap = new Map<string, NcContext>();

    while (queue.length > 0) {
      const affected = queue.shift();
      const ctx = affected.context;

      await COL_OPTION_UPDATERS[affected.type](
        ctx,
        affected.fk_column_id,
        { error },
        ncMeta,
      );

      // Replay each per-concern delete handler's `handle()` for the dep.
      // Synthetic param carries just the column id — that's all the bodies
      // these handlers read from `oldEntity`.
      const depParam = {
        eventType: MetaEventType.COLUMN_DELETED,
        oldEntity: { id: affected.fk_column_id } as any,
        affectedDependencyResult: {} as AffectedDependencyResult,
      };
      await this.filterHandler.handle(ctx, depParam, ncMeta);
      await this.coverImageHandler.handle(ctx, depParam, ncMeta);
      await this.kanbanGroupByHandler.handle(ctx, depParam, ncMeta);
      await this.calendarRangeHandler.handle(ctx, depParam, ncMeta);
      await this.hookTriggerHandler.handle(ctx, depParam, ncMeta);

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

      const affectedCol = await Column.get(
        ctx,
        { colId: affected.fk_column_id },
        ncMeta,
      );
      if (affectedCol?.fk_model_id) {
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
          ) {
            continue;
          }

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

    for (const [modelId, modelCtx] of affectedModelCtxMap) {
      await View.clearSingleQueryCache(modelCtx, modelId, null, ncMeta);
    }

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
}
