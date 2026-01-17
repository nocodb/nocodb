// eslint-disable-file no-fallthrough
import { Logger } from '@nestjs/common';
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
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { NcContext } from '~/interface/config';
import type { View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { _wherePk, extractSortsObject, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { DBQueryClient } from '~/dbQueryClient';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Filter, Model, Sort, Source } from '~/models';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';

const logger = new Logger('mysql-helpers');

// generate a unique placeholder which is not present in the string
function getUniquePlaceholders(
  searchWithin: string,
  initialVal = '__nc_placeholder__',
) {
  let placeholder = initialVal;
  let i = 0;
  while (searchWithin.includes(placeholder)) {
    placeholder = initialVal + ++i;
  }
  return placeholder;
}

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
  await ctx.model.getColumns(context);

  if (!['mysql', 'mysql2'].includes(ctx.source.type)) {
    throw new Error('Source is not mysql');
  }
  const dbQuery = DBQueryClient.get(ClientType.MYSQL);

  let skipCache = shouldSkipCache(ctx, false);

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:read`;

  const baseModel = await Model.getBaseModelSQL(context, {
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  // get the key value pair condition
  const pkCondition = _wherePk(ctx.model.primaryKeys, ctx.id);

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
            ctx.model.primaryKeys.map(
              (pkCol) => pkCondition[pkCol.column_name],
            ),
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

  const aliasColObjMap = await ctx.model.getAliasColObjMap(context);
  // let sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
  const { filters: queryFilterObj } = extractFilterFromXwhere(
    context,
    listArgs?.where,
    aliasColObjMap,
    ctx.throwErrorIfInvalidParams,
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

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  // await conditionV2(baseModel, aggrConditionObj, countQb);

  // apply sort on root query
  // if (sorts) await sortV2(baseModel, sorts, rootQb);

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
  const idPlaceholder = getUniquePlaceholders(sql);

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
          ctx.model.primaryKeys.map((pkCol) => pkCondition[pkCol.column_name]),
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
    baseModel?: IBaseModelSqlV2;
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
  if (!['mysql', 'mysql2'].includes(ctx.source.type)) {
    throw new Error('Source is not mysql');
  }
  const dbQuery = DBQueryClient.get(ClientType.MYSQL);

  let skipCache = shouldSkipCache(ctx);

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;

  await ctx.model.getColumns(context);
  let dbQueryTime;

  const baseModel =
    ctx.baseModel ||
    (await Model.getBaseModelSQL(context, {
      model: ctx.model,
      viewId: ctx.view?.id,
      dbDriver: knex,
    }));
  if (!skipCache) {
    const cachedQuery = await NocoCache.get(
      context,
      cacheKey,
      CacheGetType.TYPE_STRING,
    );
    if (cachedQuery) {
      const startTime = process.hrtime();
      const res = await baseModel.execAndParse(
        knex.raw(cachedQuery, [+listArgs.limit, +listArgs.offset]).toQuery(),
        null,
        {
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
          apiVersion: ctx.apiVersion,
        },
      );
      dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));

      if (ctx.skipPaginateWrapper) {
        return res.map(({ __nc_count, ...rest }) => rest);
      }

      return new PagedResponseImpl(
        res.map(({ __nc_count, ...rest }) => rest),
        {
          count: +res[0]?.__nc_count || 0,
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

  const aliasColObjMap = await ctx.model.getAliasColObjMap(context);
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

  if (ctx.view?.id && !ctx.ignoreViewFilterAndSort)
    viewFilters = await Filter.rootFilterList(context, {
      viewId: ctx.view?.id,
    });

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
      } else if (ctx.model.primaryKey) {
        rootQb.orderBy(ctx.model.primaryKey.column_name);
      }
    }
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

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    getHiddenColumn: ctx.getHiddenColumns,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
    includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
    includeRowColorColumns: ctx.params.include_row_color === 'true',
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
    } else if (ctx.model.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy(`${ROOT_ALIAS}.created_at`);
    }
  }

  const finalQb = qb.select(countQb.as('__nc_count'));
  knex.applyCte(finalQb);

  let res: any;
  if (skipCache) {
    const startTime = process.hrtime();
    res = await baseModel.execAndParse(finalQb, undefined, {
      apiVersion: ctx.apiVersion,
      skipSubstitutingColumnIds:
        context.api_version === NcApiVersion.V3 &&
        ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
    });
    dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
  } else {
    const { sql, bindings } = finalQb.toSQL();

    // get unique placeholder for limit and offset which is not present in query
    const placeholder = getUniquePlaceholders(finalQb.toQuery());

    // bind all params and replace limit and offset with placeholders
    // and in generated sql replace placeholders with bindings
    const query = knex
      .raw(sql, [...bindings.slice(0, -2), placeholder, placeholder])
      .toQuery()
      // escape any `?` in the query to avoid replacing them with bindings
      .replace(/\?/g, '\\?')
      .replace(
        `limit '${placeholder}' offset '${placeholder}'`,
        'limit ? offset ?',
      );

    const startTime = process.hrtime();
    // run the query with actual limit and offset
    try {
      res = await baseModel.execAndParse(
        knex.raw(query, [+listArgs.limit, +listArgs.offset]).toQuery(),
        undefined,
        {
          apiVersion: ctx.apiVersion,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        },
      );
    } catch (e) {
      if (ctx.validateFormula || !haveFormulaColumn(columns)) throw e;
      return singleQueryList(context, {
        ...ctx,
        validateFormula: true,
      });
    }
    dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));

    // cache query for later use after successful execution
    await NocoCache.set(context, cacheKey, query);
  }

  if (ctx.skipPaginateWrapper) {
    return res.map(({ __nc_count, ...rest }) => rest);
  }

  return new PagedResponseImpl(
    res.map(({ __nc_count, ...rest }) => rest),
    {
      count: +res[0]?.__nc_count || 0,
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

// allow if MySQL version is >= 8.0.0 and not MariaDB
// const version = await base.getDbVersion();
export async function isMysqlVersionSupported(
  context: NcContext,
  source: Source,
) {
  // if version is not present in meta then get it from db
  // and store it in base meta for later use
  let meta;
  if (!source.meta || !('dbVersion' in source.meta)) {
    try {
      const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
      meta = source.meta || {};
      meta.dbVersion = await sqlClient
        .raw('select version() as version')
        .then((res) => res[0][0].version);

      Source.update(context, source.id, {
        meta,
      })
        .then(() => {
          // do nothing, it's just to update the base meta and not wait for it
        })
        .catch((err) => {
          logger.error(err);
        });
    } catch {
      // disable if the version extraction fails
      return false;
    }
  } else {
    meta = source.meta;
  }

  if (!meta || !meta.dbVersion || /Maria/i.test(meta.dbVersion)) {
    return false;
  }

  // check if version is >= 8.0.0
  return +meta.dbVersion.split('.')[0] >= 8;
}
