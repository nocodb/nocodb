import { nanoid } from 'nanoid';
import {
  extractFilterFromXwhere,
  isDeletedCol,
  NcApiVersion,
} from 'nocodb-sdk';
import debug from 'debug';
import { normalizeIdForQuery } from '../utils';
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
import { getListArgs } from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import { haveFormulaColumn } from '~/helpers/dbHelpers';
import getAst from '~/helpers/getAst';
import { Filter, Model } from '~/models';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { isTransientError } from '~/helpers/db-error/utils';
import { RlsSubscriptionRegistry } from '~/socket/RlsSubscriptionRegistry';

const debugSingleQueryRead = debug('nc:db:query:singleQueryRead');

export const singleQueryRead = (client: DBQueryClient) => {
  async function read(
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
      ignoreRls?: boolean;
      deletedOnly?: boolean;
    },
  ): Promise<Record<string, any>> {
    client.validateClientType(ctx.source.type);

    await ctx.model.getColumns(context);

    // Normalize id: extract PK values if id is an object
    // For composite keys: keep as array, for single key: extract single value
    const normalizedIdValues = normalizeIdForQuery(
      ctx.id,
      ctx.model.primaryKeys,
    );

    let skipCache = shouldSkipCache(ctx, false);

    // get knex connection
    const knex = await NcConnectionMgrv2.get(ctx.source);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: ctx.model.id,
      viewId: ctx.view?.id,
      dbDriver: knex,
    });

    // Use bitwise flags: bit 0 (1) = getHiddenColumn, bit 1 (2) = extractOnlyPrimaries, bit 2 (4) = extractOrderColumn, bit 3 (8) = linksAsLtar
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
    const flags =
      (ctx.getHiddenColumn ? 1 : 0) |
      (ctx.extractOnlyPrimaries ? 2 : 0) |
      (ctx.extractOrderColumn ? 4 : 0) |
      (linksAsLtar ? 8 : 0) |
      (ctx.deletedOnly ? 16 : 0);

    const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
      ctx.view?.id ?? 'default'
    }:read:${flags}${rlsCacheSegment}`;
    if (!skipCache) {
      const cachedQuery = await NocoCache.get(
        context,
        cacheKey,
        CacheGetType.TYPE_STRING,
      );
      if (cachedQuery) {
        const res = await baseModel.execAndParse(
          knex.raw(cachedQuery, normalizedIdValues).toQuery(),
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

    // RLS conditions already resolved above (before cache check)
    const rlsFilterGroup = rlsConditions.length
      ? [new Filter({ children: rlsConditions, is_group: true })]
      : [];

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
      await checkForCurrentUserFilters({
        context,
        filters: [...rlsFilterGroup, ...aggrConditionObj],
      })
    ) {
      skipCache = true;
    }

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

    const qb = knex.from(rootQb.as(ROOT_ALIAS));

    const { ast } = await getAst(context, {
      query: ctx.params,
      model: ctx.model,
      view: ctx.view,
      getHiddenColumn: ctx.getHiddenColumn,
      throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
      apiVersion: ctx.apiVersion,
      includeRowColorColumns: ctx.params.include_row_color,
      includeButtonFilterColumns: ctx.params.include_button_filter_columns,
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
      const queryToExec = knex.raw(query, normalizedIdValues).toQuery();
      debugSingleQueryRead(queryToExec);
      res = await baseModel.execAndParse(queryToExec, null, {
        first: true,
        skipSubstitutingColumnIds:
          context.api_version === NcApiVersion.V3 &&
          ctx.params?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      });
    } catch (e) {
      // Check if this is a transient error (connection/timeout issue)
      const isTransient = isTransientError(e);

      if (isTransient || ctx.validateFormula || !haveFormulaColumn(columns))
        throw e;
      return read(context, {
        ...ctx,
        validateFormula: true,
      });
    }

    if (!skipCache) {
      // cache query for later use after successful execution
      await NocoCache.set(context, cacheKey, query);

      // Track RLS-specific keys so clearSingleQueryCache can delete them
      // Uses Redis SET (sadd) — appends without duplicates
      if (rlsCacheSegment) {
        await NocoCache.set(
          context,
          `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:rls_keys`,
          [cacheKey],
        );
      }
    }

    return res;
  }

  return {
    read,
  };
};
