import {
  extractFilterFromXwhere,
  isLinksOrLTAR,
  isSystemColumn,
} from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { Column, View } from '~/models';
import type { AggregateCtx, DBQueryClient } from '~/dbQueryClient/types';
import { applyAggregation } from '~/dbQueryClient/cross-db-utils/applyAggregation';
import conditionV2 from '~/db/conditionV2';
import { Filter, GridViewColumn, Model } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export interface AggregateColumnSpec {
  col: Column;
  aggregation: string;
}

/**
 * Shared, dialect-agnostic single-filter-set aggregation orchestration.
 */
export const aggregate =
  (_client: DBQueryClient, logger?: Logger) =>
  async (
    context: NcContext,
    ctx: AggregateCtx,
  ): Promise<Record<string, unknown>> => {
    const { model, view, source, args } = ctx;

    try {
      const knex = await NcConnectionMgrv2.get(source);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: knex,
        model,
        source,
      });

      const { where, aggregation } = baseModel._getListArgs(args);

      const columns = await baseModel.model.getColumns(baseModel.context);

      const aggregateColumns = await resolveAggregateColumns({
        baseModel,
        view,
        aggregation,
      });
      if (!aggregateColumns.length) {
        return {};
      }

      const aliasColObjMap = await baseModel.model.getAliasColObjMap(
        baseModel.context,
        columns,
      );

      const qb = baseModel.dbDriver(baseModel.tnPath);

      const { filters: filterObj } = extractFilterFromXwhere(
        baseModel.context,
        where,
        aliasColObjMap,
      );

      const rlsConditions = await baseModel.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];

      await conditionV2(
        baseModel,
        [
          ...rlsFilterGroup,
          ...(baseModel.viewId
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList(baseModel.context, {
                      viewId: baseModel.viewId,
                    })) || [],
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );

      const softDeleteFilter = await baseModel.getSoftDeleteFilter();
      if (softDeleteFilter) {
        qb.where(softDeleteFilter);
      }

      const selectors: Knex.Raw[] = [];

      await Promise.all(
        aggregateColumns.map(async ({ col, aggregation: agg }) => {
          const aggSql = await applyAggregation({
            baseModelSqlv2: baseModel,
            aggregation: agg,
            column: col,
            alias: col.id,
            baseQuery: qb,
          });
          if (aggSql) selectors.push(baseModel.dbDriver.raw(aggSql));
        }),
      );

      if (!selectors.length) {
        return {};
      }

      qb.select(...selectors);

      const aggregated = await baseModel.execAndParse(qb, null, {
        first: true,
        bulkAggregate: true,
        skipDateConversion: true,
        skipAttachmentConversion: true,
        skipUserConversion: true,
      });

      if (!aggregated || typeof aggregated !== 'object') {
        return {};
      }

      const idToTitle = new Map(
        aggregateColumns.map(({ col }) => [col.id, col.title]),
      );

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(aggregated)) {
        result[idToTitle.get(key) ?? key] = value;
      }

      return result;
    } catch (e) {
      logger?.error?.((e as Error).message, (e as Error).stack);
      throw e;
    }
  };

/**
 * Resolve the `(column, aggregation-type)` pairs to compute. Shared by both
 * the single and bulk aggregation orchestrations — normalizing the two
 * heterogeneous shapes (`GridViewColumn` list vs. caller-supplied aggregation
 * override) into one typed list.
 *
 * - When `viewId` is set, use the view's visible `GridViewColumn`s (filtered
 *   to non-system unless `view.show_system_fields`). An explicit `aggregation`
 *   override narrows to only those columns AND overrides the aggregation type.
 * - When `viewId` is absent, `aggregation` must be supplied and is the source.
 */
export async function resolveAggregateColumns({
  baseModel,
  view,
  aggregation,
}: {
  baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>;
  view?: View;
  aggregation?: Array<{ field: string; type: string }>;
}): Promise<AggregateColumnSpec[]> {
  const aggregateColumns: AggregateColumnSpec[] = [];
  const overrideMap = new Map<string, string>(
    (aggregation ?? []).map((a) => [a.field, a.type]),
  );
  const overrideMode = !!aggregation?.length;

  if (baseModel.viewId) {
    const gridCols = await GridViewColumn.list(
      baseModel.context,
      baseModel.viewId,
    );
    for (const gc of gridCols) {
      const col = baseModel.model.columnsById[gc.fk_column_id];
      if (!col) continue;
      if (!gc.show) continue;
      if (!view?.show_system_fields && isSystemColumn(col)) continue;

      let aggType: string | undefined;
      if (overrideMode) {
        if (!overrideMap.has(gc.fk_column_id)) continue;
        aggType = overrideMap.get(gc.fk_column_id);
      } else {
        aggType = gc.aggregation;
      }
      if (!aggType) continue;
      if (isLinksOrLTAR(col) && col.system) continue;

      aggregateColumns.push({ col, aggregation: aggType });
    }
    return aggregateColumns;
  }

  if (overrideMode) {
    for (const agg of aggregation!) {
      const col = baseModel.model.columnsById[agg.field];
      if (!col) continue;
      if (isLinksOrLTAR(col) && col.system) continue;
      aggregateColumns.push({ col, aggregation: agg.type });
    }
  }

  return aggregateColumns;
}
