import { extractFilterFromXwhere, NcApiVersion } from 'nocodb-sdk';
import { normalizeIdForQuery } from '../utils';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';
import { _wherePk, getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { Filter, Model } from '~/models';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
  shouldSkipCache,
} from '~/services/data-opt/common-helpers';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { isTransientError } from '~/helpers/db-error/utils';

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

export const read = (client: DBQueryClient) => {
  async function singleQueryRead(
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
    },
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    await ctx.model.getColumns(context);

    if (!['mysql', 'mysql2'].includes(ctx.source.type)) {
      throw new Error('Source is not mysql');
    }

    // Normalize id: extract PK values if id is an object
    // For composite keys: keep as array, for single key: extract single value
    const normalizedIdValues = normalizeIdForQuery(
      ctx.id,
      ctx.model.primaryKeys,
    );

    let skipCache = shouldSkipCache(ctx, false);

    // get knex connection
    const knex = await NcConnectionMgrv2.get(ctx.source);

    const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
      ctx.view?.id ?? 'default'
    }:read:${!!ctx.getHiddenColumn}:${!!ctx.extractOnlyPrimaries}:${!!ctx.extractOrderColumn}`;

    const baseModel = await Model.getBaseModelSQL(context, {
      id: ctx.model.id,
      viewId: ctx.view?.id,
      dbDriver: knex,
    });

    // Build primary key condition object from normalized values
    const pkCondition = ctx.model.primaryKeys.reduce((acc, pk, idx) => {
      acc[pk.column_name] = normalizedIdValues[idx];
      return acc;
    }, {});

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
      extractOnlyPrimaries: ctx.extractOnlyPrimaries,
      extractOrderColumn: ctx.extractOrderColumn,
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
    } catch (e) {
      // Check if this is a transient error (connection/timeout issue)
      const isTransient = isTransientError(e);

      if (isTransient || ctx.validateFormula || !haveFormulaColumn(columns))
        throw e;
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
  return {
    singleQueryRead,
  };
};
