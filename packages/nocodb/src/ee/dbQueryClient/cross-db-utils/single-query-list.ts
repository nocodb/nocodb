import debug from 'debug';
import {
  extractFilterFromXwhere,
  isOrderCol,
  NcApiVersion,
  UITypes,
} from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import type { DBQueryClient } from '~/dbQueryClient/types';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
  shouldSkipCache,
} from '~/services/data-opt/common-helpers';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { _wherePk, extractSortsObject, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { getDataWithCountCache } from '~/dbQueryClient/cross-db-utils/get-data-with-count-cache';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Profiler } from '~/helpers/profiler';
import { Filter, Model, Sort } from '~/models';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { isTransientError } from '~/helpers/db-error/utils';
import { RlsSubscriptionRegistry } from '~/socket/RlsSubscriptionRegistry';

const debugSingleQueryList = debug('nc:db:query:singleQueryList');

export const singleQueryList = (client: DBQueryClient, logger: Logger) => {
  async function list(
    context: NcContext,
    ctx: {
      model: Model;
      view?: View;
      source: Source;
      params;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      baseModel?: IBaseModelSqlV2;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      skipPaginateWrapper?: boolean;
      skipSortBasedOnOrderCol?: boolean;
      ignoreViewFilterAndSort?: boolean;
      ignoreRls?: boolean;
    },
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    client.validateClientType(ctx.source.type);

    const profiler = Profiler.start(client.clientType + ': singleQueryList');
    const excludeCount = ctx.params?.excludeCount;

    let dbQueryTime;
    let skipCache = shouldSkipCache(ctx);

    const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

    const getAlias = getAliasGenerator();

    // get knex connection
    const knex = await NcConnectionMgrv2.get(ctx.source);

    const baseModel =
      ctx.baseModel ||
      (await Model.getBaseModelSQL(context, {
        id: ctx.model.id,
        viewId: ctx.view?.id,
        dbDriver: knex,
      }));

    const linksAsLtar =
      ctx.apiVersion === NcApiVersion.V3 && ctx.params?.linksAsLtar === 'true';

    // Resolve RLS conditions early — include policy hash in cache key
    // so users with the same RLS filters share a cache entry
    const rlsConditions = ctx.ignoreRls
      ? []
      : await baseModel.getRlsConditions();
    let rlsCacheSegment = '';
    if (rlsConditions.length) {
      const hash = RlsSubscriptionRegistry.computeAccessHash(rlsConditions);
      rlsCacheSegment = `:rls:${hash}`;
    }

    const cacheKeySuffix = (linksAsLtar ? ':ltar' : '') + rlsCacheSegment;
    const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
      ctx.view?.id ?? 'default'
    }:queries${cacheKeySuffix}`;
    const countCacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
      ctx.view?.id ?? 'default'
    }:count${cacheKeySuffix}`;

    if (!skipCache) {
      const cachedQuery = await NocoCache.get(
        context,
        cacheKey,
        CacheGetType.TYPE_STRING,
      );
      const cachedCountQuery = await NocoCache.get(
        context,
        countCacheKey,
        CacheGetType.TYPE_STRING,
      );
      if (cachedQuery && cachedCountQuery) {
        profiler.log('get data using cache');
        debugSingleQueryList(cachedQuery);
        const [countRes, res] = await getDataWithCountCache(context, {
          query: cachedQuery,
          countQuery: cachedCountQuery,
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          knex,
          countCacheKey,
          skipCache,
          excludeCount,
          recordQueryTime: (time: string) => {
            dbQueryTime = time;
          },
          apiVersion: ctx.apiVersion,
          baseModel,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        });

        // if count is less than the actual result length then reset the count cache
        if (
          countRes !== undefined &&
          countRes !== null &&
          countRes < res.length
        ) {
          await NocoCache.del(context, countCacheKey);
          logger.warn(
            'Invalid count query cache deleted. Query: ' + cachedCountQuery,
          );
        }
        profiler.end();
        if (ctx.skipPaginateWrapper) {
          return res.map(({ __nc_count, ...rest }) => rest);
        }
        return new PagedResponseImpl(
          res.map(({ __nc_count, ...rest }) => rest),
          {
            count: countRes,
            limit: +listArgs.limit,
            offset: +listArgs.offset,
            limitOverride: +ctx.limitOverride,
          },
          {
            stats: {
              dbQueryTime,
            },
          },
        );
      }
    }

    // load columns list
    const columns = await ctx.model.getColumns(context);

    const rootQb = knex(baseModel.getTnPath(ctx.model));

    const countQb = knex(baseModel.getTnPath(ctx.model));
    countQb.count({ count: ctx.model.primaryKey?.column_name || '*' });

    // handle shuffle if query param preset
    if (+listArgs?.shuffle) {
      await baseModel.shuffle({ qb: rootQb });
      ctx.skipSortBasedOnOrderCol = true;
    }

    if (listArgs.pks) {
      const pks = listArgs.pks.split(',');
      rootQb.where((qb) => {
        pks.forEach((pk) => {
          qb.orWhere(_wherePk(ctx.model.primaryKeys, pk));
        });
        return qb;
      });
    }

    profiler.log('getAliasColObjMap');
    const aliasColObjMap = await ctx.model.getAliasColObjMap(context, columns);
    let sorts = extractSortsObject(
      context,
      listArgs?.sort,
      aliasColObjMap,
      ctx.throwErrorIfInvalidParams,
      ctx.apiVersion,
    );
    const { filters: queryFilterObj } = extractFilterFromXwhere(
      context,
      listArgs?.where,
      aliasColObjMap,
      ctx.throwErrorIfInvalidParams,
    );

    if (!sorts?.['length'] && ctx.params.sortArr?.length) {
      sorts = ctx.params.sortArr;
    } else if (!sorts?.['length'] && ctx.view && !ctx.ignoreViewFilterAndSort) {
      sorts = await Sort.list(context, { viewId: ctx.view.id });
    }

    let viewFilters: Filter[] = [];
    // allViewFilters will have every filters defined in a view in a flatten form
    // used to verify whether cache will be skipped
    let allViewFilters: Filter[] = [];

    if (ctx.view?.id && !ctx.ignoreViewFilterAndSort) {
      viewFilters = await Filter.rootFilterList(context, {
        viewId: ctx.view?.id,
      });
      allViewFilters = await Filter.allViewFilterList(context, {
        viewId: ctx.view?.id,
      });
    }

    if (viewFilters?.length && checkForStaticDateValFilters(allViewFilters)) {
      skipCache = true;
    }

    // RLS conditions already resolved above (before cache check)
    const rlsFilterGroup = rlsConditions.length
      ? [new Filter({ children: rlsConditions, is_group: true })]
      : [];

    const aggrConditionObj = [
      ...(ctx.view && !ctx.ignoreViewFilterAndSort
        ? [
            new Filter({
              children: viewFilters,
              is_group: true,
            }),
          ]
        : []),
      ...(ctx.customConditions
        ? [
            new Filter({
              children: ctx.customConditions,
              is_group: true,
            }),
          ]
        : []),
      new Filter({
        children: ctx.params.filterArr || [],
        is_group: true,
        logical_op: 'and',
      }),
      new Filter({
        children: queryFilterObj,
        is_group: true,
        logical_op: 'and',
      }),
    ];

    if (
      await checkForCurrentUserFilters({
        context,
        filters: [...rlsFilterGroup, ...aggrConditionObj, ...allViewFilters],
      })
    ) {
      skipCache = true;
    }
    profiler.log('apply condition');

    // RLS filters — always throw on missing columns to prevent row leaks
    if (rlsFilterGroup.length) {
      await conditionV2(baseModel, rlsFilterGroup, rootQb, undefined, true);
      await conditionV2(baseModel, rlsFilterGroup, countQb, undefined, true);
    }

    // apply remaining filters on root query and count query
    await conditionV2(
      baseModel,
      aggrConditionObj,
      rootQb,
      undefined,
      ctx.throwErrorIfInvalidParams,
    );
    await conditionV2(
      baseModel,
      aggrConditionObj,
      countQb,
      undefined,
      ctx.throwErrorIfInvalidParams,
    );
    const orderColumn = columns.find((c) => isOrderCol(c));

    // apply sort on root query
    if (sorts?.length) await sortV2(baseModel, sorts, rootQb);

    // apply sort on root query only if not skipped
    if (!ctx.skipSortBasedOnOrderCol) {
      if (orderColumn) {
        rootQb.orderBy(orderColumn.column_name);
      }
    }
    // ignore stable sorting / sort by created time when shuffle
    if (!+listArgs?.shuffle) {
      // Ensure stable ordering:
      // - Use auto-increment PK if available
      // - Otherwise, fallback to system CreatedTime
      // This avoids issues when order column has duplicates
      if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
        rootQb.orderBy(ctx.model.primaryKey.column_name);
      } else {
        const createdAtColumn = ctx.model.columns.find(
          (c) => c.uidt === UITypes.CreatedTime && c.system,
        );
        if (createdAtColumn) {
          rootQb.orderBy(createdAtColumn.column_name);
        } /*else if (ctx.model.primaryKey) {
          rootQb.orderBy(ctx.model.primaryKey.column_name);
        }*/
      }
    }

    const qb = knex.from(rootQb.as(ROOT_ALIAS));

    profiler.log('get ast');
    const { ast } = await getAst(context, {
      query: ctx.params,
      model: ctx.model,
      view: ctx.view,
      throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
      apiVersion: ctx.apiVersion,
      includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
      getHiddenColumn: ctx.getHiddenColumns,
      includeRowColorColumns: ctx.params.include_row_color === 'true',
      includeButtonFilterColumns:
        ctx.params.include_button_filter_columns === 'true',
    });
    profiler.log('extract column');

    await client.extractColumns({
      columns,
      knex,
      qb,
      getAlias,
      params: ctx.params,
      baseModel,
      ast,
      throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
      validateFormula: ctx.validateFormula,
      alias: ROOT_ALIAS,
      apiVersion: ctx.apiVersion,
    });
    // Random non-zero integer sentinel for limit/offset used when caching.
    // After toQuery() resolves all bindings, we find `limit X offset X` in
    // the SQL and replace it with `limit ? offset ?` for later injection.
    const limitOffsetPlaceholder =
      Math.floor(Math.random() * 8999999) + 1000000;
    if (!ctx.ignorePagination) {
      if (skipCache) {
        rootQb.limit(ctx.limitOverride || +listArgs.limit);
        rootQb.offset(+listArgs.offset);
      } else {
        rootQb.limit(limitOffsetPlaceholder);
        rootQb.offset(limitOffsetPlaceholder);
      }
    }
    profiler.log('apply sort');
    // apply the sort on final query to get the result in correct order
    if (sorts?.length) await sortV2(baseModel, sorts, qb, ROOT_ALIAS);

    // apply sort on root query only if not skipped
    if (!ctx.skipSortBasedOnOrderCol) {
      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      }
    }
    // ignore stable sorting / sort by created time when shuffle
    if (!+listArgs?.shuffle) {
      // Ensure stable ordering:
      // - Use auto-increment PK if available
      // - Otherwise, fallback to system CreatedTime
      // This avoids issues when order column has duplicates
      if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
        qb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
      } else {
        const createdAtColumn = ctx.model.columns.find(
          (c) => c.uidt === UITypes.CreatedTime && c.system,
        );
        if (createdAtColumn) {
          qb.orderBy(`${ROOT_ALIAS}.${createdAtColumn.column_name}`);
        }
        /*else if (ctx.model.primaryKey) {
          rootQb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
        }*/
      }
    }

    // const finalQb = qb.select(countQb.as('__nc_count'));
    const finalQb = qb;
    knex.applyCte(finalQb);
    let dataQuery = finalQb.toQuery();
    if (!skipCache) {
      // dataQuery (from finalQb.toQuery()) has all bindings resolved,
      // including the unique placeholder for limit/offset.
      // Escape any literal ? to prevent them from being treated as bindings,
      // then replace the placeholder limit/offset with binding placeholders.
      dataQuery = dataQuery
        .replace(/\?/g, '\\?')
        .replace(
          `limit ${limitOffsetPlaceholder} offset ${limitOffsetPlaceholder}`,
          'limit ? offset ?',
        );
    }
    profiler.log('get data without cache');

    let count, res;
    try {
      debugSingleQueryList(dataQuery);
      [count, res] = await getDataWithCountCache(context, {
        query: dataQuery,
        countQuery: countQb.toQuery(),
        limit: +listArgs.limit,
        offset: +listArgs.offset,
        knex,
        countCacheKey,
        skipCache,
        excludeCount,
        recordQueryTime: (time: string) => {
          dbQueryTime = time;
        },
        apiVersion: ctx.apiVersion,
        baseModel,
        skipSubstitutingColumnIds:
          context.api_version === NcApiVersion.V3 &&
          ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      });
    } catch (e) {
      // Check if this is a transient error (connection/timeout issue)
      const isTransient = isTransientError(e);

      if (isTransient || ctx.validateFormula || !haveFormulaColumn(columns))
        throw e;
      return list(context, {
        ...ctx,
        validateFormula: true,
      });
    }

    if (!skipCache) {
      // cache query for later use after successful execution
      await NocoCache.set(context, cacheKey, dataQuery);

      // Track RLS-specific keys so clearSingleQueryCache can delete them
      // Uses Redis SET (sadd) — appends without duplicates
      if (rlsCacheSegment) {
        await NocoCache.set(
          context,
          `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:rls_keys`,
          [cacheKey, countCacheKey],
        );
      }
    }

    profiler.end();
    if (ctx.skipPaginateWrapper) {
      return res.map(({ __nc_count, ...rest }) => rest);
    }
    return new PagedResponseImpl(
      res.map(({ __nc_count, ...rest }) => rest),
      {
        // count: +res[0]?.__nc_count || 0,
        count,
        limit: +listArgs.limit,
        offset: +listArgs.offset,
        limitOverride: +ctx.limitOverride,
      },
      {
        stats: {
          dbQueryTime: dbQueryTime,
        },
      },
    );
  }
  return {
    list,
  };
};
