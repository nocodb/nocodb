import { PlanFeatureTypes, SEARCH_COUNT_CAP } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Filter } from '~/models';
import { getQueryGuard } from '~/db/queryGuard';
import { NcError } from '~/helpers/catchError';

// All-fields search is EE; EE shadows this file.

export function hasSearchTerm(args?: object) {
  const raw = (args as { search?: unknown } | undefined)?.search;
  return typeof raw === 'string' && !!raw.trim();
}

export async function getSearchFilters(
  baseModel: IBaseModelSqlV2,
  args?: object,
): Promise<Filter[]> {
  if (!getQueryGuard()?.search || !hasSearchTerm(args)) return [];
  NcError.get(baseModel.context).featureNotSupported({
    feature: PlanFeatureTypes.FEATURE_GLOBAL_SEARCH,
  });
}

export function capSearchCountQuery(
  knex: Knex,
  matchesQb: Knex.QueryBuilder,
  countColumn?: string,
) {
  return knex
    .from(matchesQb.limit(SEARCH_COUNT_CAP + 1).as('nc_search_matches'))
    .count({ count: countColumn ?? '*' })
    .first();
}
