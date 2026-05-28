import type { NcApiVersion } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { NcContext } from '~/interface/config';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import {
  setSingleQueryCache,
  SINGLE_QUERY_DEFAULT_VIEW,
} from '~/dbQueryClient/cross-db-utils/single-query-cache';

export const getDataWithCountCache = async (
  context: NcContext,
  params: {
    query: string;
    countQuery: string;
    baseModel: IBaseModelSqlV2;
    apiVersion: NcApiVersion;
    limit: number;
    offset: number;
    knex: CustomKnex;
    recordQueryTime?: (queryTime: string) => void;
    excludeCount?: boolean;
    skipCache?: boolean;
    countCacheKey?: string;
    modelId?: string;
    viewIdOrDefault?: string;
    skipSubstitutingColumnIds?: boolean;
  },
): Promise<[count: number | undefined, data: any[]]> => {
  const countHandler = async (): Promise<number | undefined> => {
    if (params.excludeCount) {
      return undefined;
    }

    if (!params.skipCache && params.countCacheKey && params.modelId) {
      await setSingleQueryCache(context, {
        modelId: params.modelId,
        viewIdOrDefault: params.viewIdOrDefault ?? SINGLE_QUERY_DEFAULT_VIEW,
        cacheKey: params.countCacheKey,
        query: params.countQuery,
      });
    }

    const r = await params.baseModel.execAndParse(params.countQuery, null, {
      first: true,
    });

    return +r?.count || 0;
  };
  const dataHandler = async () => {
    if (params.skipCache) {
      const startTime = process.hrtime();
      const result = await params.baseModel.execAndParse(params.query, null, {
        skipSubstitutingColumnIds: params.skipSubstitutingColumnIds,
      });
      params?.recordQueryTime?.(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return result;
    } else {
      const startTime = process.hrtime();
      // T-SQL pagination puts the offset FIRST in the emitted SQL
      // (`OFFSET … ROWS FETCH NEXT … ROWS ONLY`), so the binding order
      // must flip for mssql. pg/mysql `limit ? offset ?` keep
      // `[limit, offset]`.
      const isMssql = params.knex.clientType?.() === 'mssql';
      const bindings = isMssql
        ? [params.offset, params.limit]
        : [params.limit, params.offset];
      const res = await params.baseModel.execAndParse(
        params.knex.raw(params.query, bindings).toQuery(),
        null,
        // unsure why params.apiVersion only used when fetching from cache
        {
          skipSubstitutingColumnIds: params.skipSubstitutingColumnIds,
          apiVersion: params.apiVersion,
        },
      );
      params?.recordQueryTime?.(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return res;
    }
  };
  return await Promise.all([countHandler(), dataHandler()]);
};
