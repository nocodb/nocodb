import {
  extractFilterFromXwhere,
  isOrderCol,
  NcApiVersion,
  UITypes,
} from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { _wherePk, extractSortsObject, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Filter, Model, Sort } from '~/models';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
  shouldSkipCache,
} from '~/services/data-opt/common-helpers';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';

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

export const list = (client: DBQueryClient, _logger: Logger) => {
  async function singleQueryList(
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
      } else if (
        ctx.model.columns.find((c) => c.column_name === 'created_at')
      ) {
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
  return {
    singleQueryList,
  };
};
