// eslint-disable-file no-fallthrough
import { Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import {
  ClientType,
  extractFilterFromXwhere,
  isOrderCol,
  NcApiVersion,
  UITypes,
} from 'nocodb-sdk';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
  shouldSkipCache,
} from './common-helpers';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import {
  _wherePk,
  extractSortsObject,
  getAs,
  getListArgs,
} from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { DBQueryClient } from '~/dbQueryClient';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Profiler } from '~/helpers/profiler';
import { Filter, Model, Sort } from '~/models';
import { singleQueryRead as mysqlSingleQueryRead } from '~/services/data-opt/mysql-helpers';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';

const logger = new Logger('pg-single-query');

export async function singleQueryRead(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    apiVersion?: NcApiVersion;
  },
): Promise<PagedResponseImpl<Record<string, any>>> {
  const dbQuery = DBQueryClient.get(ClientType.PG);

  await ctx.model.getColumns(context);

  if (ctx.source.type !== 'pg') {
    throw new Error('Single query only supported in postgres');
  }

  let skipCache = shouldSkipCache(ctx, false);

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const baseModel = await Model.getBaseModelSQL(context, {
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:read`;
  if (!skipCache) {
    const cachedQuery = await NocoCache.get(
      context,
      cacheKey,
      CacheGetType.TYPE_STRING,
    );
    if (cachedQuery) {
      const res = await baseModel.execAndParse(
        knex
          .raw(
            cachedQuery,
            ctx.model.primaryKeys.length === 1
              ? [ctx.id]
              : ctx.id.split('___').map((id) => id.replaceAll('\\_', '_')),
          )
          .toQuery(),
        null,
        {
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
          first: true,
        },
      );

      return res;
    }
  }

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // load columns list
  const columns = await ctx.model.getColumns(context);

  const rootQb = knex(baseModel.getTnPath(ctx.model));

  // dummy id placeholder to be replaced later
  const idSym = Symbol('__dummy_id_placeholder');

  // use ids as a unique value to replace raw in the query later
  rootQb.where(
    ctx.model.primaryKeys.reduce((acc, pk) => {
      acc[pk.column_name] = idSym;
      return acc;
    }, {}),
  );

  const aliasColObjMap = await ctx.model.getAliasColObjMap(context, columns);
  // let sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
  const { filters: queryFilterObj } = extractFilterFromXwhere(
    context,
    listArgs?.where,
    aliasColObjMap,
  );

  const viewFilters = ctx.view?.id
    ? await Filter.rootFilterList(context, {
        viewId: ctx.view?.id,
      })
    : [];

  if (viewFilters?.length && checkForStaticDateValFilters(viewFilters)) {
    skipCache = true;
  }

  const aggrConditionObj = [
    ...(ctx.view?.id
      ? [
          new Filter({
            children: viewFilters,
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
    await checkForCurrentUserFilters({ context, filters: aggrConditionObj })
  ) {
    skipCache = true;
  }
  // apply filters on root query
  await conditionV2(baseModel, aggrConditionObj, rootQb);

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    getHiddenColumn: ctx.getHiddenColumn,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
    includeRowColorColumns: ctx.params.include_row_color,
  });

  await dbQuery.extractColumns({
    columns,
    knex,
    qb,
    getAlias,
    params: ctx.params,
    baseModel,
    ast,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    validateFormula: ctx.validateFormula,
    apiVersion: ctx.apiVersion,
  });

  // const dataAlias = getAlias();

  const finalQb = qb.first();
  knex.applyCte(finalQb);

  const { sql, bindings } = finalQb.toSQL();

  // get unique placeholder which is not present in the query
  const idPlaceholder = nanoid();

  // // take care of composite primary key
  // const idPlaceholders = ctx.model.primaryKeys.map(() => idPlaceholder);

  // bind all params and replace id  with placeholders
  // and in generated sql replace placeholders with bindings
  const query = knex
    .raw(
      sql,
      bindings.map((v: unknown) => (v === idSym ? idPlaceholder : v)),
    )
    .toQuery()
    // escape any `?` in the query to avoid replacing them with bindings
    .replace(/\?/g, '\\?')
    .replaceAll(`'${idPlaceholder}'`, '?');

  // const res = await finalQb;

  let res;
  try {
    res = await baseModel.execAndParse(
      knex
        .raw(
          query,
          ctx.model.primaryKeys.length === 1
            ? [ctx.id]
            : ctx.id.split('___').map((id) => id.replaceAll('\\_', '_')),
        )
        .toQuery(),
      null,
      {
        first: true,
        skipSubstitutingColumnIds:
          context.api_version === NcApiVersion.V3 &&
          ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      },
    );
  } catch (e) {
    if (ctx.validateFormula || !haveFormulaColumn(columns)) throw e;
    return singleQueryRead(context, {
      ...ctx,
      validateFormula: true,
    });
  }

  if (!skipCache) {
    // cache query for later use after successful execution
    await NocoCache.set(context, cacheKey, query);
  }

  return res;
}

export async function singleQueryList(
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
    baseModel?: BaseModelSqlv2;
    customConditions?: Filter[];
    getHiddenColumns?: boolean;
    apiVersion?: NcApiVersion;
    includeSortAndFilterColumns?: boolean;
    skipPaginateWrapper?: boolean;
    skipSortBasedOnOrderCol?: boolean;
    ignoreViewFilterAndSort?: boolean;
  },
): Promise<
  PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
> {
  const dbQuery = DBQueryClient.get(ClientType.PG);

  const profiler = Profiler.start('pgHelper/singleQueryList');
  const excludeCount = ctx.params?.excludeCount;

  if (ctx.source.type !== 'pg') {
    throw new Error('Source is not postgres');
  }

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

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;
  const countCacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:count`;

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

  if (ctx.view?.id && !ctx.ignoreViewFilterAndSort) {
    viewFilters = await Filter.rootFilterList(context, {
      viewId: ctx.view?.id,
    });
  }

  if (viewFilters?.length && checkForStaticDateValFilters(viewFilters)) {
    skipCache = true;
  }

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
    await checkForCurrentUserFilters({ context, filters: aggrConditionObj })
  ) {
    skipCache = true;
  }
  profiler.log('apply condition');

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  await conditionV2(baseModel, aggrConditionObj, countQb);
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
  });
  profiler.log('extract column');

  await dbQuery.extractColumns({
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
  if (!ctx.ignorePagination) {
    if (ctx.limitOverride) {
      rootQb.limit(ctx.limitOverride);
      rootQb.offset(+listArgs.offset);
    } else if (skipCache) {
      rootQb.limit(+listArgs.limit);
      rootQb.offset(+listArgs.offset);
    } else {
      // provide some dummy non-zero value to limit and offset to populate bindings,
      // if offset is 0 then it will ignore bindings
      rootQb.limit(9999);
      rootQb.offset(9999);
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
      .replace(
        `limit '${placeholder}' offset '${placeholder}'`,
        'limit ? offset ?',
      );
  }
  profiler.log('get data without cache');

  let count, res;
  try {
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
    if (ctx.validateFormula || !haveFormulaColumn(columns)) throw e;
    return singleQueryList(context, {
      ...ctx,
      validateFormula: true,
    });
  }

  if (!skipCache) {
    // cache query for later use after successful execution
    await NocoCache.set(context, cacheKey, dataQuery);
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

const getDataWithCountCache = async (
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
    skipSubstitutingColumnIds?: boolean;
  },
): Promise<[count: number | undefined, data: any[]]> => {
  const countHandler = async (): Promise<number | undefined> => {
    if (params.excludeCount) {
      return undefined;
    }

    if (!params.skipCache) {
      await NocoCache.set(context, params.countCacheKey, params.countQuery);
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
      params?.recordQueryTime(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return result;
    } else {
      const startTime = process.hrtime();
      const res = await params.baseModel.execAndParse(
        params.knex.raw(params.query, [params.limit, params.offset]).toQuery(),
        null,
        // unsure why params.apiVersion only used when fetching from cache
        {
          skipSubstitutingColumnIds: params.skipSubstitutingColumnIds,
          apiVersion: params.apiVersion,
        },
      );
      params?.recordQueryTime(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return res;
    }
  };
  return await Promise.all([countHandler(), dataHandler()]);
};

export async function singleQueryGroupedList(
  context: NcContext,
  ctx: {
    model: Model;
    view?: View;
    source: Source;
    params;
    groupColumnId: string;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    baseModel?: BaseModelSqlv2;
    customConditions?: Filter[];
    getHiddenColumns?: boolean;
    apiVersion?: NcApiVersion;
    includeSortAndFilterColumns?: boolean;
    ignoreViewFilterAndSort?: boolean;
  },
): Promise<
  {
    key: string;
    value: Record<string, unknown>[];
  }[]
> {
  const dbQuery = DBQueryClient.get(ClientType.PG);

  const profiler = Profiler.start('pgHelper/singleQueryGroupedList');

  if (ctx.source.type !== 'pg') {
    throw new Error('Source is not postgres');
  }

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

  // load columns list
  const columns = await ctx.model.getColumns(context);
  const groupColumn = columns?.find((col) => col.id === ctx.groupColumnId);

  if (!groupColumn) {
    throw new Error(`Group column with id ${ctx.groupColumnId} not found`);
  }

  // extract distinct group column values
  const groupingValues = await baseModel.extractGroupingValues(
    groupColumn,
    ctx.params.options,
  );

  const limit = +listArgs?.limit || 25;
  const offset = +listArgs?.offset || 0;

  const rootQb = knex(baseModel.getTnPath(ctx.model));

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

  if (ctx.view?.id && !ctx.ignoreViewFilterAndSort) {
    viewFilters = await Filter.rootFilterList(context, {
      viewId: ctx.view?.id,
    });
  }

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

  // apply filters on root query
  await conditionV2(baseModel, aggrConditionObj, rootQb);

  const orderColumn = columns.find((c) => isOrderCol(c));

  const tempSortQb = knex('dummy_table');

  // apply sort on root query
  if (sorts?.length) await sortV2(baseModel, sorts, tempSortQb);

  // apply sort on root query only if not skipped
  if (orderColumn) {
    tempSortQb.orderBy(orderColumn.column_name);
  }
  // Ensure stable ordering
  if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
    tempSortQb.orderBy(ctx.model.primaryKey.column_name);
  } else {
    const createdAtColumn = ctx.model.columns.find(
      (c) => c.uidt === UITypes.CreatedTime && c.system,
    );
    if (createdAtColumn) {
      tempSortQb.orderBy(createdAtColumn.column_name);
    }
  }

  const extractedOrderByQuery = tempSortQb
    .toQuery()
    .replace(/^select \* from "?dummy_table"?/i, '')
    .replaceAll('?', '\\?');

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  profiler.log('get ast');
  const { ast: _ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
  });

  const ast = { ..._ast };

  // additionally include grouping column if missing
  ast[groupColumn.title] = true;

  profiler.log('extract column');

  // Build window function partition and order clauses
  // IMPORTANT: extractColumns creates aliases for columns using getAs(column)
  // So we need to reference columns by their aliases (column IDs), not original names
  // The group column alias (column ID used as alias in extractColumns)
  const groupColumnAlias = getAs(groupColumn);

  // Use extractColumns to handle nested columns/rollups in SQL (like singleQueryList)
  await dbQuery.extractColumns({
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

  // Add a window function column to number rows according to the overall sort order
  qb.select(
    knex.raw(
      `ROW_NUMBER() OVER (${extractedOrderByQuery}) AS "_nc_sort_order"`,
    ),
  );

  // Create a subquery with window function to number rows within each group
  const baseQuerySql = qb.toQuery().replaceAll('?', '\\?');

  let groupColumnSql: string;
  const quotedGroupAlias = `"${String(groupColumnAlias).replace(/"/g, '""')}"`;
  if (groupColumn.uidt === UITypes.SingleSelect) {
    groupColumnSql = `COALESCE(NULLIF(__nc_base.${quotedGroupAlias}, ''), NULL)`;
  } else {
    groupColumnSql = `__nc_base.${quotedGroupAlias}`;
  }

  // Build the window function with proper SQL strings
  // Include ORDER BY clause to ensure correct row numbering within each partition
  const windowFunctionSql = `ROW_NUMBER() OVER (PARTITION BY ${groupColumnSql} ORDER BY "__nc_base"."_nc_sort_order" ASC)`;

  const windowQb = knex
    .from(knex.raw(`(${baseQuerySql}) as __nc_base`))
    .select('*')
    .select(knex.raw(`${windowFunctionSql} as __nc_row_num`));

  // Filter to get only rows within limit per group, and filter by grouping values
  // Use column alias for filtering and ordering
  const windowQuerySql = windowQb.toQuery().replaceAll('?', '\\?');
  const groupedQb = knex
    .from(knex.raw(`(${windowQuerySql}) as __nc_windowed`))
    .where((qb) => {
      const groupValues = [...groupingValues];
      if (groupValues.length === 0) return;

      const nullIndex = groupValues.indexOf(null);
      if (nullIndex >= 0) {
        groupValues.splice(nullIndex, 1);
        if (groupColumn.uidt === UITypes.SingleSelect) {
          qb.whereNull(groupColumnAlias).orWhere(groupColumnAlias, '=', '');
        } else {
          qb.whereNull(groupColumnAlias);
        }
        if (groupValues.length > 0) {
          qb.orWhereIn(groupColumnAlias, groupValues);
        }
      } else {
        qb.whereIn(groupColumnAlias, groupValues);
      }
    })
    .where('__nc_row_num', '<=', limit)
    .where('__nc_row_num', '>', offset)
    .orderBy(groupColumnAlias);

  knex.applyCte(groupedQb);

  profiler.log('execute grouped query');
  const data: any[] = await baseModel.execAndParse(groupedQb, null, {
    skipSubstitutingColumnIds:
      context.api_version === NcApiVersion.V3 &&
      ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
  });

  // Group results by the group column value
  // Use the column alias to get the value from the result
  const groupedResult = data.reduce<Map<string | number | null, any[]>>(
    (aggObj, row) => {
      // Try to get value by alias first, then fallback to title
      const rawVal = row[groupColumnAlias] ?? row[groupColumn.title];
      const val = typeof rawVal === 'string' && rawVal === '' ? null : rawVal;

      if (!aggObj.has(val)) {
        aggObj.set(val, []);
      }

      const cleaned: any = {};

      // Only include columns that are in original AST (explicitly requested)
      for (const [key, value] of Object.entries(row)) {
        // Skip internal columns which is not part of the AST
        if (!_ast[key]) continue;
        cleaned[key] = value;
      }

      aggObj.get(val).push(cleaned);

      return aggObj;
    },
    new Map(),
  );

  profiler.end();

  return [...groupingValues].map((key) => ({
    key,
    value: groupedResult.get(key) ?? [],
  }));
}

export function getSingleQueryReadFn(source: Source) {
  if (['mysql', 'mysql2'].includes(source.type)) {
    return mysqlSingleQueryRead;
  }
  return singleQueryRead;
}
