import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, Model } from '~/models';
import { cellKindOf, isComputedField } from '~/db/search/searchIndexFields';
import { searchEnvInt } from '~/db/search/searchEnv';

/** Fields per row the live budget assumes at least: narrower tables don't get more rows. */
const LIVE_BUDGET_FIELDS = 10;

/**
 * A link, lookup, rollup, formula or button counts as this many fields: read
 * live, each costs about 5x a stored field per row (measured on 50k rows).
 */
const LIVE_COMPUTED_FIELD_WEIGHT = 5;

/** Searchable fields of a table, a computed one counted at its live cost. */
export function liveSearchFieldWeight(columns: Column[]) {
  return columns.reduce(
    (sum, c) =>
      cellKindOf(c, columns)
        ? sum + (isComputedField(c) ? LIVE_COMPUTED_FIELD_WEIGHT : 1)
        : sum,
    0,
  );
}

/**
 * Rows up to which a table without a ready index is searched live, row by
 * row; a larger one matches nothing until its index is built. The cost is
 * rows x fields read, so the budget is in cells (`NC_SEARCH_LIVE_MAX_CELLS`,
 * 500k: 50k rows at 10 fields or fewer, about 10k with 9 lookups or
 * rollups). `NC_SEARCH_LIVE_MAX_ROWS` caps it.
 */
export async function searchLiveMaxRows(model: Model) {
  const fields = liveSearchFieldWeight(await model.getColumns());
  const rows = Math.floor(
    searchEnvInt('NC_SEARCH_LIVE_MAX_CELLS', 500_000, 0) /
      Math.max(LIVE_BUDGET_FIELDS, fields),
  );
  return Math.min(rows, searchEnvInt('NC_SEARCH_LIVE_MAX_ROWS', rows, 0));
}

/** Whether the table is small enough to search live, without its index. */
export async function liveSearchable(
  baseModel: IBaseModelSqlV2,
): Promise<boolean> {
  const max = await searchLiveMaxRows(baseModel.model);
  if (!max) return false;
  const knex = baseModel.dbDriver;
  const rows = knex(baseModel.tnPath)
    .select(knex.raw('1'))
    .limit(max + 1);
  const result = await baseModel.execAndParse(
    knex.from(rows.as('nc_search_rows')).count({ count: '*' }),
    null,
    { raw: true, first: true },
  );
  return Number(result?.count ?? 0) <= max;
}
