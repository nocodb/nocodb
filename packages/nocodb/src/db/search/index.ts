import { SEARCH_COUNT_CAP, SEARCH_TERM_MAX_LENGTH, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';
import {
  ncLikeContainsPattern,
  ncLikeEscapeClause,
} from '~/db/field-handler/utils/handlerUtils';
import { getQueryGuard } from '~/db/queryGuard';
import { ScanSearchProvider } from '~/db/search/scanSearchProvider';
import { NcError } from '~/helpers/catchError';
import { Filter } from '~/models';
import { FILTER_RAW_CLAUSE } from '~/models/Filter';

// CE reads the table live, text fields only, at any size: a full scan per search. EE shadows this file.

// Mirrored by TEXT_SEARCH_TYPES in nc-gui/utils/allFieldsSearchUtils.ts.
const TEXT_SEARCH_TYPES = new Set<string>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
]);

const scanProvider = new ScanSearchProvider();

export function hasSearchTerm(args?: object) {
  const raw = (args as { search?: unknown } | undefined)?.search;
  return typeof raw === 'string' && !!raw.trim();
}

const isTextSearchField = (column: Column) =>
  TEXT_SEARCH_TYPES.has(column.uidt) && !!column.column_name;

/**
 * `col like '%term%'`, folded on both sides where the dialect needs it: `like`
 * alone folds by ILIKE on pg, by UPPER on Oracle, and on MySQL by the column's
 * collation, which a `_bin`/`_cs` one doesn't do at all. MSSQL keeps plain
 * `like`: `LOWER()` rejects `ntext`/`text`, and its default collations fold
 * anyway. SQLite folds ASCII only, so it can disagree with the client matcher
 * on non-ASCII letters.
 */
function searchLikeClause(knex: CustomKnex, column: Column, term: string) {
  const pattern = ncLikeContainsPattern(knex, term);
  const escape = ncLikeEscapeClause(knex);
  return (qb: Knex.QueryBuilder, alias?: string) => {
    const field = alias ? `${alias}.${column.column_name}` : column.column_name;
    if (knex.clientType() === 'pg') {
      qb.where(knex.raw('??::text ilike ?', [field, pattern]));
    } else if (knex.clientType() === 'oracledb') {
      qb.where(knex.raw(`UPPER(??) like UPPER(?)${escape}`, [field, pattern]));
    } else if (knex.clientType() === 'mssql') {
      qb.where(knex.raw(`?? like ?${escape}`, [field, pattern]));
    } else {
      qb.where(knex.raw(`LOWER(??) like LOWER(?)${escape}`, [field, pattern]));
    }
  };
}

/** Filters to AND into a data query for `args.search`; empty without a term. */
export async function getSearchFilters(
  baseModel: IBaseModelSqlV2,
  args?: object,
): Promise<Filter[]> {
  if (!getQueryGuard()?.search || !hasSearchTerm(args)) return [];
  const term = (args as { search: string }).search.trim();
  if (term.length > SEARCH_TERM_MAX_LENGTH) {
    NcError.get(baseModel.context).invalidRequestBody(
      `Search term is longer than ${SEARCH_TERM_MAX_LENGTH} characters`,
    );
  }
  if (!baseModel.model.columns) await baseModel.model.getColumns();

  const fields = (await scanProvider.searchableColumns(baseModel)).filter(
    isTextSearchField,
  );
  if (!fields.length) {
    const none = new Filter({
      fk_column_id: baseModel.model.columns[0]?.id,
      comparison_op: 'in',
      value: '',
    });
    none[FILTER_RAW_CLAUSE] = (qb) => qb.whereRaw('1 = 0');
    return [none];
  }

  return [
    new Filter({
      is_group: true,
      logical_op: 'and',
      children: fields.map((c) => {
        const filter = new Filter({
          fk_column_id: c.id,
          comparison_op: 'like',
          value: term,
          logical_op: 'or',
        });
        filter[FILTER_RAW_CLAUSE] = searchLikeClause(
          baseModel.dbDriver,
          c,
          term,
        );
        return filter;
      }),
    }),
  ];
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
