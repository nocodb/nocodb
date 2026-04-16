// eslint-disable-file no-fallthrough
import {
  ClientType,
  extractFilterFromXwhere,
  isDeletedCol,
  isOrderCol,
  NcApiVersion,
  UITypes,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { extractSortsObject, getAs, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { DBQueryClient } from '~/dbQueryClient';
import getAst from '~/helpers/getAst';
import { Profiler } from '~/helpers/profiler';
import { Filter, Model, Sort } from '~/models';
import { singleQueryRead as mysqlSingleQueryRead } from '~/services/data-opt/mysql-helpers';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export async function singleQueryRead(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string | Record<string, any>;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    apiVersion?: NcApiVersion;
    extractOnlyPrimaries?: boolean;
    extractOrderColumn?: boolean;
    customConditions?: Filter[];
    ignoreRls?: boolean;
    deletedOnly?: boolean;
  },
): Promise<Record<string, any>> {
  const dbQuery = DBQueryClient.get(ClientType.PG);
  return dbQuery.singleQueryRead(context, ctx);
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
    ignoreRls?: boolean;
    deletedOnly?: boolean;
  },
): Promise<
  PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
> {
  const dbQuery = DBQueryClient.get(ClientType.PG);
  return dbQuery.singleQueryList(context, ctx);
}

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
    includeButtonFilterColumns?: boolean;
    includeRowColourColumns?: boolean;
    deletedOnly?: boolean;
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

  // Soft-delete filter: exclude deleted records normally, or select ONLY deleted for trash listing
  if (ctx.deletedOnly) {
    const deletedCol = ctx.model.columns?.find((c) => isDeletedCol(c));
    if (deletedCol) {
      rootQb.where(deletedCol.column_name, true);
    } else {
      rootQb.whereRaw('1 = 0');
    }
  } else {
    const softDeleteFilter = await baseModel.getSoftDeleteFilter();
    if (softDeleteFilter) {
      rootQb.where(softDeleteFilter);
    }
  }

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

  // Resolve RLS (Row-Level Security) conditions
  const rlsConditions = await baseModel.getRlsConditions();
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

  // RLS filters — always throw on missing columns to prevent row leaks
  if (rlsFilterGroup.length) {
    await conditionV2(baseModel, rlsFilterGroup, rootQb, undefined, true);
  }

  // apply remaining filters on root query
  await conditionV2(
    baseModel,
    aggrConditionObj,
    rootQb,
    undefined,
    ctx.throwErrorIfInvalidParams,
  );

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
    includeButtonFilterColumns: ctx.includeButtonFilterColumns,
    includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
    includeRowColorColumns: ctx.includeRowColourColumns,
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
