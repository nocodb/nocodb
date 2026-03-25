import debug from 'debug';
import { nanoid } from 'nanoid';
import { NcApiVersion } from 'nocodb-sdk';
import { listQueryEnrichment } from './list-query-enrichment';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { NcContext } from '~/interface/config';
import type { Filter, Source, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { getListArgs } from '~/db/BaseModelSqlv2';
import { getDataWithCountCache } from '~/dbQueryClient/cross-db-utils/get-data-with-count-cache';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Profiler } from '~/helpers/profiler';
import { Model } from '~/models';
import { shouldSkipCache } from '~/services/data-opt/common-helpers';
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
    const skipCache = shouldSkipCache(ctx);

    const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

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

    const enriched = await listQueryEnrichment(client, logger).enrich(context, {
      sourceQb: knex(baseModel.getTnPath(ctx.model)),
      ...ctx,
      listArgs: listArgs,
      skipCache,
      rlsConditions,
    });

    // const finalQb = qb.select(countQb.as('__nc_count'));
    const finalQb = enriched.finalQb;
    let dataQuery = finalQb.toQuery();
    if (!enriched.skipCache) {
      const { sql, bindings } = finalQb.toSQL();

      // get unique placeholder for limit and offset which is not present in query
      const placeholder = nanoid();

      // bind all params and replace limit and offset with placeholders
      // and in generated sql replace placeholders with bindings
      dataQuery = knex
        .raw(sql, [...bindings.slice(0, -2), placeholder, placeholder])
        .toQuery()
        // escape any `?` in the query to avoid replacing them with bindings
        .replace(/\?/g, '\\?')
        .replaceAll(`'${placeholder}'`, '?');
    }
    profiler.log('get data without cache');

    let count, res;
    try {
      debugSingleQueryList(dataQuery);
      [count, res] = await getDataWithCountCache(context, {
        query: dataQuery,
        countQuery: enriched.countQb.toQuery(),
        limit: +listArgs.limit,
        offset: +listArgs.offset,
        knex,
        countCacheKey,
        skipCache: enriched.skipCache,
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

      if (
        isTransient ||
        ctx.validateFormula ||
        !haveFormulaColumn(ctx.model.columns)
      )
        throw e;
      return list(context, {
        ...ctx,
        validateFormula: true,
      });
    }

    if (!enriched.skipCache) {
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
