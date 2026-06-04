import { extractFilterFromXwhere } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { BulkAggregateCtx, DBQueryClient } from '~/dbQueryClient/types';
import { applyAggregation } from '~/dbQueryClient/cross-db-utils/applyAggregation';
import conditionV2 from '~/db/conditionV2';
import { Filter, Model } from '~/models';
import { NcError } from '~/helpers/ncError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { resolveAggregateColumns } from '~/dbQueryClient/cross-db-utils/aggregate';

// filterArrJson arrives either as a JSON string (API callers) or an
// already-parsed Filter[] (internal callers pass it pre-parsed). A malformed
// JSON string must fail closed with a 400 — silently dropping it would run the
// aggregation unfiltered (fail-open data exposure). Empty/absent => no extra
// filter; a value that parses to a non-array is rejected too.
function parseBulkFilterArrJson(
  context: NcContext,
  raw: string | Filter[] | undefined,
  alias: string,
): Filter[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    NcError.get(context).badRequest(
      `Invalid filterArrJson for bulk-aggregate bucket "${alias}"`,
    );
  }

  if (!Array.isArray(parsed)) {
    NcError.get(context).badRequest(
      `Invalid filterArrJson for bulk-aggregate bucket "${alias}"`,
    );
  }

  return parsed as Filter[];
}

/**
 * Shared, dialect-agnostic bulk aggregation orchestration.
 *
 * For each entry in `bulkFilterList` it builds a fresh, fully-filtered `tQb`,
 * then generates the aggregate expressions PER filter-set (passing `baseQuery: tQb`) — so
 * median / attachment-size / std_dev honor each set's filters instead of
 * running over the whole table.
 *
 * The only per-dialect spot is `client.bulkAggregateRowSelector(...)`, which
 * packs the per-set row into a `{...}` JSON string the caller picks up via
 * `execAndParse({ bulkAggregate: true })`.
 */
export const bulkAggregate =
  (client: DBQueryClient, logger?: Logger) =>
  async (
    context: NcContext,
    ctx: BulkAggregateCtx,
  ): Promise<Record<string, Record<string, unknown>>> => {
    const { model, view, source, args, bulkFilterList } = ctx;

    // Validate every bucket's filterArrJson up-front — outside the try below,
    // whose catch swallows errors into `{}`, so a malformed filter surfaces as
    // a 400 instead of being silently dropped (which would run the aggregation
    // unfiltered). Keyed by the bucket's unique alias for reuse in the loop.
    const parsedFilterArrJsonByAlias = new Map(
      (bulkFilterList ?? []).map(
        (f): [string, Filter[] | undefined] => [
          f.alias,
          parseBulkFilterArrJson(context, f.filterArrJson, f.alias),
        ],
      ),
    );

    try {
      if (!bulkFilterList?.length) {
        return {};
      }

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

      let viewFilterList: Filter[] = [];
      if (baseModel.viewId) {
        viewFilterList = await Filter.rootFilterList(baseModel.context, {
          viewId: baseModel.viewId,
        });
      }

      const rlsConditions = await baseModel.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];

      const selectors: Knex.Raw[] = [];

      for (const f of bulkFilterList) {
        const tQb = baseModel.dbDriver(baseModel.tnPath);
        const { filters: aggFilter } = extractFilterFromXwhere(
          baseModel.context,
          f.where,
          aliasColObjMap,
        );

        // Parsed and validated up-front (see parsedFilterArrJsonByAlias).
        const parsedFilterArrJson = parsedFilterArrJsonByAlias.get(f.alias);

        await conditionV2(
          baseModel,
          [
            ...rlsFilterGroup,
            ...(baseModel.viewId
              ? [
                  new Filter({
                    children: viewFilterList || [],
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
              children: extractFilterFromXwhere(
                baseModel.context,
                where,
                aliasColObjMap,
              ).filters,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: aggFilter,
              is_group: true,
              logical_op: 'and',
            }),
            ...(parsedFilterArrJson
              ? [
                  new Filter({
                    children: parsedFilterArrJson,
                    is_group: true,
                  }),
                ]
              : []),
          ],
          tQb,
        );

        const softDeleteFilter = await baseModel.getSoftDeleteFilter();
        if (softDeleteFilter) {
          tQb.where(softDeleteFilter);
        }

        // Per-filter-set expressions. baseQuery=tQb so median/attachment-size
        // materialize over the filtered rows (Phase 2 correctness invariant).
        const expressions: Record<string, string> = {};
        for (const { col, aggregation: agg } of aggregateColumns) {
          const aggSql = await applyAggregation({
            baseModelSqlv2: baseModel,
            aggregation: agg,
            column: col,
            baseQuery: tQb,
          });
          if (aggSql) expressions[col.id] = aggSql;
        }

        selectors.push(
          client.bulkAggregateRowSelector(baseModel, tQb, expressions, f.alias),
        );
      }

      qb.select(...selectors);
      qb.limit(1);

      return await baseModel.execAndParse(qb, null, {
        first: true,
        bulkAggregate: true,
      });
    } catch (err) {
      logger?.error?.((err as Error).message, (err as Error).stack);
      return {};
    }
  };
