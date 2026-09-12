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
  /**
   * SQL-side key for this aggregate. The column id alone when the field
   * carries a single aggregation (so the existing id→title rewrite still
   * applies), suffixed with the aggregation when it carries several.
   *
   * Deliberately free of dots and of the column title: it is interpolated
   * into SQL both as a knex `??` identifier (which splits on `.`) and, on the
   * bulk path, as a single-quoted JSON key.
   */
  resultKey: string;
  /**
   * Response label, set only when the field carries more than one
   * aggregation — otherwise the field title is the label, as before.
   */
  displayKey?: string;
}

/**
 * Assign each spec its SQL key and response label.
 *
 * Aggregates used to be keyed by column id all the way through, so two
 * aggregations on one field collided: the request `Amount/sum, Amount/avg,
 * Amount/count_filled` came back as a single `{"Amount": <count>}` — a
 * well-formed answer to a question nobody asked.
 */
function withResultKeys(specs: AggregateColumnSpec[]): AggregateColumnSpec[] {
  const perColumn = new Map<string, number>();
  for (const { col } of specs) {
    perColumn.set(col.id, (perColumn.get(col.id) ?? 0) + 1);
  }

  return specs.map((spec) => {
    if ((perColumn.get(spec.col.id) ?? 0) < 2) {
      return { ...spec, resultKey: spec.col.id };
    }

    return {
      ...spec,
      resultKey: `${spec.col.id}__${spec.aggregation}`,
      displayKey: `${spec.col.title}.${spec.aggregation}`,
    };
  });
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

      const columns = await baseModel.model.getColumns();

      const aggregateColumns = await resolveAggregateColumns({
        baseModel,
        view,
        aggregation,
      });
      if (!aggregateColumns.length) {
        return {};
      }

      const aliasColObjMap = await baseModel.model.getAliasColObjMap(columns);

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
        aggregateColumns.map(async ({ col, aggregation: agg, resultKey }) => {
          const aggSql = await applyAggregation({
            baseModelSqlv2: baseModel,
            aggregation: agg,
            column: col,
            alias: resultKey,
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

      const keyToLabel = new Map(
        aggregateColumns.map((spec) => [
          spec.resultKey,
          spec.displayKey ?? spec.col.title,
        ]),
      );

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(aggregated)) {
        result[keyToLabel.get(key) ?? key] = value;
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
  // A field may legitimately appear more than once — `sum` and `avg` of the
  // same column is the obvious case. Keyed by field alone this Map kept only
  // the last type, so every earlier aggregation on that field was dropped
  // before a single line of SQL was built.
  const overrideMap = new Map<string, string[]>();
  for (const a of aggregation ?? []) {
    const types = overrideMap.get(a.field);
    if (types) types.push(a.type);
    else overrideMap.set(a.field, [a.type]);
  }
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

      let aggTypes: string[];
      if (overrideMode) {
        if (!overrideMap.has(gc.fk_column_id)) continue;
        aggTypes = overrideMap.get(gc.fk_column_id);
      } else {
        aggTypes = gc.aggregation ? [gc.aggregation] : [];
      }
      if (!aggTypes.length) continue;
      if (isLinksOrLTAR(col) && col.system) continue;

      for (const aggType of aggTypes) {
        if (!aggType) continue;
        aggregateColumns.push({ col, aggregation: aggType, resultKey: col.id });
      }
    }
    return withResultKeys(aggregateColumns);
  }

  if (overrideMode) {
    for (const agg of aggregation!) {
      const col = baseModel.model.columnsById[agg.field];
      if (!col) continue;
      if (isLinksOrLTAR(col) && col.system) continue;
      aggregateColumns.push({
        col,
        aggregation: agg.type,
        resultKey: col.id,
      });
    }
  }

  return withResultKeys(aggregateColumns);
}
