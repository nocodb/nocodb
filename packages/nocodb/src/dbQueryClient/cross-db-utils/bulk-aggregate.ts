import { ClientType, extractFilterFromXwhere } from 'nocodb-sdk';
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

// JSON_BUILD_OBJECT takes 2 args per aggregate and PG caps function calls at
// 100 arguments — above this the consolidated path can't pack a bucket row.
const MAX_CONSOLIDATED_AGG_COLUMNS = 50;

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

      /**
       * Single-scan consolidation (PG only). The legacy path below builds one
       * fully-filtered derived subquery PER bucket — N buckets = N scans of the
       * table inside one statement, which is what melts large tables when the
       * grid requests aggregations for many groups.
       *
       * Instead: tag each row with the alias of the bucket it belongs to via a
       * CASE over the buckets' conditions, GROUP BY that tag (buckets from the
       * grid group-by flow are disjoint — a row belongs to exactly one group;
       * for overlapping buckets the first matching CASE branch wins), pack the
       * aggregates per bucket with JSON_BUILD_OBJECT, then pivot back to the
       * legacy single-row `{alias: json}` shape so `execAndParse` post-
       * processing and the response contract stay identical.
       *
       * PG's aggregation handler emits plain aggregate expressions (internal
       * `FILTER (WHERE ...)` clauses and correlated-subquery arguments are
       * valid in a grouped context, and it never uses `baseQuery`), so the
       * expressions ride GROUP BY unchanged. MySQL/SQLite emulate median &co.
       * with self-contained subqueries over `baseQuery` — those would silently
       * aggregate the whole table under GROUP BY, so they stay on the legacy
       * path. Any bail-out (dialect, arg cap, un-extractable bucket condition,
       * error) returns null and the legacy path runs.
       */
      const tryConsolidated = async (): Promise<Record<
        string,
        Record<string, unknown>
      > | null> => {
        if (NC_DISABLE_BULK_AGG_CONSOLIDATION) return null;
        if (client.clientType !== ClientType.PG) return null;
        if (aggregateColumns.length > MAX_CONSOLIDATED_AGG_COLUMNS) return null;

        try {
          // Deterministic prefix used to slice each bucket's WHERE fragment out
          // of a throwaway builder — bail out if the shape ever diverges.
          const emptyPrefix = knex(baseModel.tnPath).toQuery();
          const wherePrefix = `${emptyPrefix} where `;

          const buckets: Array<{ alias: string; cond: string }> = [];
          for (const f of bulkFilterList) {
            const condQb = knex(baseModel.tnPath);
            const { filters: bucketFilter } = extractFilterFromXwhere(
              baseModel.context,
              f.where,
              aliasColObjMap,
            );
            const parsedFilterArrJson = parsedFilterArrJsonByAlias.get(f.alias);

            await conditionV2(
              baseModel,
              [
                new Filter({
                  children: bucketFilter,
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
              condQb,
            );

            const sql = condQb.toQuery();
            // A bucket with no distinguishing predicate can't be CASE-tagged.
            if (!sql.startsWith(wherePrefix)) return null;
            const cond = sql.slice(wherePrefix.length).trim();
            if (!cond) return null;

            buckets.push({ alias: f.alias, cond });
          }

          if (!buckets.length) return null;

          // PG ignores `baseQuery`, so one expression set serves every bucket.
          const expressions: Record<string, string> = {};
          for (const { col, aggregation: agg } of aggregateColumns) {
            const aggSql = await applyAggregation({
              baseModelSqlv2: baseModel,
              aggregation: agg,
              column: col,
            });
            if (aggSql) expressions[col.id] = aggSql;
          }
          if (!Object.keys(expressions).length) return null;

          const innerQb = knex(baseModel.tnPath);

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
            ],
            innerQb,
          );

          const softDeleteFilterC = await baseModel.getSoftDeleteFilter();
          if (softDeleteFilterC) {
            innerQb.where(softDeleteFilterC);
          }

          // Restrict the scan to rows belonging to a requested bucket. The
          // composed fragments carry no knex bindings, so literal `?` chars
          // inside them are left untouched.
          innerQb.whereRaw(
            `(${buckets.map((b) => `(${b.cond})`).join(' OR ')})`,
          );

          const caseSql = `CASE ${buckets
            .map(
              (b) =>
                `WHEN ${b.cond} THEN ${knex.raw('?', [b.alias]).toQuery()}`,
            )
            .join(' ')} END`;
          const jsonPack = `JSON_BUILD_OBJECT(${Object.keys(expressions)
            .map((k) => `'${k}', ${expressions[k]}`)
            .join(', ')})`;

          innerQb.select(knex.raw(`${caseSql} as __nc_bucket__`));
          // ::text so the outer MAX() pivot can aggregate it (json has no max).
          innerQb.select(knex.raw(`(${jsonPack})::text as __nc_aggs__`));
          innerQb.groupByRaw('1');

          // Pivot the bucket rows back into the legacy one-row shape. Empty
          // buckets (no matching rows) fall back to '{}'.
          const outerQb = knex
            .select(
              ...buckets.map((b) =>
                knex.raw(
                  `COALESCE(MAX(CASE WHEN ?? = ? THEN ?? END), '{}') as ??`,
                  ['__nc_bucket__', b.alias, '__nc_aggs__', b.alias],
                ),
              ),
            )
            .from(innerQb.as('__nc_bulk_agg__'));

          return await baseModel.execAndParse(outerQb, null, {
            first: true,
            bulkAggregate: true,
          });
        } catch (err) {
          logger?.warn?.(
            `bulkAggregate consolidation failed, falling back to per-bucket path: ${
              (err as Error).message
            }`,
          );
          return null;
        }
      };

      const consolidated = await tryConsolidated();
      if (consolidated) {
        return consolidated;
      }

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
