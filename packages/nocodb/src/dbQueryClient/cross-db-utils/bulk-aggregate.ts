import { extractFilterFromXwhere } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { BulkAggregateCtx, DBQueryClient } from '~/dbQueryClient/types';
import { applyAggregation } from '~/dbQueryClient/cross-db-utils/applyAggregation';
import conditionV2 from '~/db/conditionV2';
import { Filter, Model } from '~/models';
import { parseFilterArrJson } from '~/helpers/filterArrJsonHelper';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { resolveAggregateColumns } from '~/dbQueryClient/cross-db-utils/aggregate';
import { NC_DISABLE_BULK_AGG_CONSOLIDATION } from '~/utils/nc-config';
import { NcError } from '~/helpers/ncError';
import { defaultGroupByLimitConfig } from '~/helpers/extractLimitAndOffset';

const defaultLogger = new Logger('bulkAggregate');

// JSON_BUILD_OBJECT takes 2 args per aggregate and PG caps function calls at
// 100 arguments — above this the consolidated path can't pack a bucket row.
const MAX_CONSOLIDATED_AGG_COLUMNS = 50;

/**
 * Outcome of the consolidation attempt, logged on every bulkAggregate call.
 *
 * The consolidated and legacy paths are observationally identical — same
 * response shape, same numbers — so nothing in a test or a production log can
 * otherwise tell which one ran, and the optimization could stop engaging
 * without anything going red. These strings are the signal: tests spy on
 * `Logger.prototype.debug` and assert the path, and `declined:<reason>` says
 * which guard sent a real workload back to the per-bucket path.
 */
export const BULK_AGG_CONSOLIDATION = {
  engaged: 'bulkAggregate consolidation engaged',
  declined: 'bulkAggregate consolidation declined',
  failed: 'bulkAggregate consolidation failed',
} as const;

export const BulkAggDecline = {
  Disabled: 'disabled',
  NotPg: 'non-pg',
  AggColumnCap: 'agg-column-cap',
  NoBuckets: 'no-buckets',
  NotAPartition: 'not-a-partition',
  MixedPartitionColumns: 'mixed-partition-columns',
  OverlappingBuckets: 'overlapping-buckets',
  UnslicableCondition: 'unslicable-condition',
  EmptyCondition: 'empty-condition',
  BackslashBinding: 'backslash-binding',
  NoAggExpressions: 'no-agg-expressions',
  EmptyResult: 'empty-result',
} as const;

export type BulkAggDeclineReason =
  (typeof BulkAggDecline)[keyof typeof BulkAggDecline];

// Ops the grid's group-by emits (nc-gui `buildNestedFilterArr`). Each pins a
// column to one bucket, so distinct tuples of them cannot share a row.
const PARTITIONING_OPS = new Set(['gb_eq', 'gb_null', 'checked', 'notchecked']);

// Bucket keys compare `gb_eq` values as JSON, but SQL compares them by column
// semantics: 10, '10', ' 10', '010' and '+10' all select the same numeric rows.
// Fold anything numeric to one canonical form so such buckets collide in
// `seenKeys` and decline. Over-folding only costs the optimization (text '1' and
// '1.0' fall back), never correctness; under-folding hands the shared rows to
// whichever bucket the CASE reaches first and silently zeroes the rest.
const canonicalEqKey = (value: unknown): string => {
  const raw = `${value ?? ''}`.trim();
  const num = Number(raw);
  return raw !== '' && Number.isFinite(num) ? `n:${num}` : `s:${raw}`;
};

// Each bucket appends a fully-filtered correlated subquery to one SELECT, so the
// query string grows with buckets × columns × filter-tree size. Tracks the client
// page size the way MAX_PUBLIC_BULK_ENTRIES does rather than hardcoding: raising
// NC_DB_QUERY_LIMIT_GROUP_BY_GROUP grows the batches useViewGroupBy sends, and
// `limitGroup` is floor-clamped only, so a fixed number would 400 real requests.
const MAX_BULK_AGGREGATE_BUCKETS = Math.max(
  500,
  defaultGroupByLimitConfig.limitGroup,
);

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

    // Enforced OUTSIDE the try below (whose catch swallows to `{}`) so it
    // surfaces as a 400 the client can act on instead of a silent empty result.
    if ((bulkFilterList?.length ?? 0) > MAX_BULK_AGGREGATE_BUCKETS) {
      NcError.get(context).badRequest(
        `Too many aggregation buckets requested (${bulkFilterList.length} > ${MAX_BULK_AGGREGATE_BUCKETS}). Reduce the group-by page size.`,
      );
    }

    // Validate every bucket's filterArrJson up-front — outside the try below,
    // whose catch swallows errors into `{}`, so a malformed filter surfaces as
    // a 400 instead of being silently dropped (which would run the aggregation
    // unfiltered). Keyed by the bucket's unique alias for reuse in the loop.
    const parsedFilterArrJsonByAlias = new Map(
      (bulkFilterList ?? []).map((f): [string, Filter[] | undefined] => [
        f.alias,
        parseFilterArrJson(
          context,
          f.filterArrJson,
          `bulk-aggregate bucket "${f.alias}"`,
        ),
      ]),
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

        if (Object.keys(expressions).length === 0) {
          // Nothing to aggregate (e.g. aggregation type 'none'). The scalar
          // subquery wrapper around JSON_BUILD_OBJECT() then matches >1 row and
          // PG errors "more than one row returned by a subquery"; the catch below
          // swallows that to `{}` and the client re-fires in a tight loop.
          // Emit the empty-object literal rather than SQL NULL — NULL survives
          // the parser as JS null and crashes AliasMapper's Object.keys().
          selectors.push(baseModel.dbDriver.raw('? as ??', ['{}', f.alias]));
        } else {
          selectors.push(
            client.bulkAggregateRowSelector(
              baseModel,
              tQb,
              expressions,
              f.alias,
            ),
          );
        }
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
