import { extractFilterFromXwhere, isOrderCol, UITypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcApiVersion } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { XcFilter } from '~/db/sql-data-mapper/lib/BaseModel';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import { _wherePk, extractSortsObject, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import getAst from '~/helpers/getAst';
import { Profiler } from '~/helpers/profiler';
import { Filter, Model, Sort } from '~/models';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
} from '~/services/data-opt/common-helpers';
import { RlsSubscriptionRegistry } from '~/socket/RlsSubscriptionRegistry';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export const listQueryEnrichment = (client: DBQueryClient, _logger: Logger) => {
  async function enrich(
    context: NcContext,
    ctx: {
      sourceQb: Knex.QueryBuilder;
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
      extractOnlyPrimaries?: boolean;
      skipCache?: boolean;
      listArgs?: XcFilter;
      ignoreRls?: boolean;
      limitOffsetPlaceholder?: number;
    },
  ): Promise<{
    finalQb: Knex.QueryBuilder;
    countQb: Knex.QueryBuilder;
    skipCache: boolean;
    rlsCacheSegment: string;
  }> {
    client.validateClientType(ctx.source.type);

    const profiler = Profiler.start(
      client.clientType + ': listQueryEnrichment',
    );

    let skipCache = ctx.skipCache;
    let skipSortBasedOnOrderCol = ctx.skipSortBasedOnOrderCol;

    const listArgs =
      ctx.listArgs ??
      getListArgs(ctx.params ?? {}, ctx.model, {
        apiVersion: ctx.apiVersion,
      });

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

    // Resolve RLS conditions — include policy hash in cache key
    // so users with the same RLS filters share a cache entry
    const rlsConditions = ctx.ignoreRls
      ? []
      : await baseModel.getRlsConditions();
    let rlsCacheSegment = '';
    if (rlsConditions.length) {
      const hash = RlsSubscriptionRegistry.computeAccessHash(rlsConditions);
      rlsCacheSegment = `:rls:${hash}`;
    }

    // load columns list
    const columns = await ctx.model.getColumns(context);

    // Use sourceQb as the root/inner query
    const rootQb = ctx.sourceQb;

    // Clone before conditions are applied so countQb starts from the same base
    const countQbBase = rootQb.clone();

    // handle shuffle if query param preset
    if (+listArgs?.shuffle) {
      await baseModel.shuffle({ qb: rootQb });
      skipSortBasedOnOrderCol = true;
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
    // allViewFilters will have every filter defined in a view in a flatten form
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

    // RLS conditions already resolved above
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
      await conditionV2(
        baseModel,
        rlsFilterGroup,
        countQbBase,
        undefined,
        true,
      );
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
      countQbBase,
      undefined,
      ctx.throwErrorIfInvalidParams,
    );

    const orderColumn = columns.find((c) => isOrderCol(c));

    // apply sort on root query
    if (sorts?.length) await sortV2(baseModel, sorts, rootQb);

    if (!skipSortBasedOnOrderCol) {
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
        }
      }
    }

    // Wrap rootQb with ROOT_ALIAS for column extraction
    const qb = knex.from(rootQb.as(ROOT_ALIAS));

    // Build count query wrapping the conditioned base
    const countQb = knex
      .from(countQbBase.as('count_qb'))
      .count({ count: ctx.model.primaryKey?.column_name || '*' });

    profiler.log('get ast');
    const { ast } = await getAst(context, {
      query: ctx.params,
      model: ctx.model,
      view: ctx.view,
      throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
      apiVersion: ctx.apiVersion,
      includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
      getHiddenColumn: ctx.getHiddenColumns,
      includeRowColorColumns: ctx.params?.include_row_color === 'true',
      includeButtonFilterColumns:
        ctx.params?.include_button_filter_columns === 'true',
      extractOnlyPrimaries: ctx.extractOnlyPrimaries,
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

    if (!ctx.ignorePagination) {
      if (!skipCache && ctx.limitOffsetPlaceholder) {
        rootQb.limit(ctx.limitOffsetPlaceholder);
        rootQb.offset(ctx.limitOffsetPlaceholder);
      } else {
        rootQb.limit(ctx.limitOverride || +listArgs.limit);
        rootQb.offset(+listArgs.offset);
      }
    }

    profiler.log('apply sort');
    // apply the sort on final query to get the result in correct order
    if (sorts?.length) await sortV2(baseModel, sorts, qb, ROOT_ALIAS);

    // apply sort on outer query only if not skipped
    if (!skipSortBasedOnOrderCol) {
      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      }
    }

    // ignore stable sorting / sort by created time when shuffle
    if (!+listArgs?.shuffle) {
      // Ensure stable ordering on the outer query
      if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
        qb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
      } else {
        const createdAtColumn = ctx.model.columns.find(
          (c) => c.uidt === UITypes.CreatedTime && c.system,
        );
        if (createdAtColumn) {
          qb.orderBy(`${ROOT_ALIAS}.${createdAtColumn.column_name}`);
        }
      }
    }

    // const finalQb = qb.select(countQb.as('__nc_count'));
    const finalQb = qb;
    knex.applyCte(finalQb);

    profiler.end();

    return { finalQb, countQb, skipCache, rlsCacheSegment };
  }
  return {
    enrich,
  };
};
