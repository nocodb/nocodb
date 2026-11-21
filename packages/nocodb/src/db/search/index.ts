import {
  PlanFeatureTypes,
  SEARCH_COUNT_CAP,
  SEARCH_TERM_MAX_LENGTH,
  SEARCH_TIMEZONE_QUERY_PARAM,
} from 'nocodb-sdk';
import type { SearchState } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { ScanSearchProvider } from '~/db/search/scanSearchProvider';
import {
  classifySearchTerm,
  IndexSearchProvider,
  noRows,
  reportSearchState,
} from '~/db/search/indexSearchProvider';
import {
  getSearchIndexMeta,
  searchIndexBlocker,
  searchIndexTooLarge,
} from '~/db/search/searchIndex';
import {
  getSearchIndexMode,
  isGlobalSearchEnabled,
  isGlobalSearchSwitchedOff,
} from '~/db/search/searchIndexMeta';
import { maybeAutoBuildSearchIndex } from '~/db/search/searchIndexSync';
import {
  getQueryGuard,
  SEARCH_PLAN_MARK,
  searchPlanSettings,
} from '~/db/queryGuard';
import { NcError } from '~/helpers/catchError';
import { getGlobalSearchAccess } from '~/helpers/globalSearchGate';
import { isSharedViewAccess } from '~/helpers/accessSource';
import { Filter } from '~/models';
import { liveSearchable, searchLiveOnlyMaxRows } from '~/db/search/searchLive';

export type { SearchMatch, SearchProvider } from '~/db/search/types';
export {
  liveSearchable,
  liveSearchFieldWeight,
  searchLiveMaxRows,
  searchLiveOnlyMaxRows,
} from '~/db/search/searchLive';

const scanProvider = new ScanSearchProvider();
const indexProvider = new IndexSearchProvider(scanProvider);

/** The all-fields search term in request args, if any. */
export function getSearchTerm(args?: object): string | undefined {
  const raw = (args as { search?: unknown } | undefined)?.search;
  if (typeof raw !== 'string') return undefined;
  const term = raw.trim();
  if (!term) return undefined;
  if (term.length > SEARCH_TERM_MAX_LENGTH) {
    NcError.get().invalidRequestBody(
      `Search term is longer than ${SEARCH_TERM_MAX_LENGTH} characters`,
    );
  }
  return term;
}

function getSearchTimezone(args?: object): string | undefined {
  const raw = (args as Record<string, unknown> | undefined)?.[
    SEARCH_TIMEZONE_QUERY_PARAM
  ];
  return typeof raw === 'string' && raw.length <= 64 ? raw : undefined;
}

export function hasSearchTerm(args?: object) {
  const raw = (args as { search?: unknown } | undefined)?.search;
  return typeof raw === 'string' && !!raw.trim();
}

/** Whether the table's index can answer now; otherwise why not. */
async function searchAvailability(
  baseModel: IBaseModelSqlV2,
): Promise<
  'ready' | Extract<SearchState, 'indexing' | 'failed' | 'unsupported'>
> {
  const model = baseModel.model;
  if (await searchIndexBlocker(baseModel.context, model)) return 'unsupported';
  const mode = getSearchIndexMode(model);
  if (mode === 'off') return 'unsupported';
  const meta = getSearchIndexMeta(model);
  if (meta?.state === 'ready') return 'ready';
  // Not building: retried after a backoff, past the cap only explicitly.
  if (meta?.state === 'failed' && !meta.build) return 'failed';
  return 'indexing';
}

/**
 * Filters to AND into a data query for `args.search`; empty without a term.
 * Postgres sources only — other databases keep single-field search.
 */
export async function getSearchFilters(
  baseModel: IBaseModelSqlV2,
  args?: object,
): Promise<Filter[]> {
  // Only routes behind QueryGuardInterceptor search; elsewhere `search` stays ignored, as before.
  if (!getQueryGuard()?.search) return [];
  const term = getSearchTerm(args);
  if (!term) return [];

  // Lowered at runtime: a grid loaded before it still asks, so answer empty
  // and say why instead of failing every load.
  if (isGlobalSearchSwitchedOff()) {
    reportSearchState('disabled');
    return noRows(baseModel).filters;
  }
  if (!isGlobalSearchEnabled()) {
    NcError.get(baseModel.context).badRequest(
      'Searching all fields is turned off on this server',
    );
  }
  if (!baseModel.isPg) {
    NcError.get(baseModel.context).badRequest(
      'Searching all fields is available on PostgreSQL sources only',
    );
  }
  const access = await getGlobalSearchAccess(baseModel.context);
  if (access === 'none') {
    NcError.get(baseModel.context).featureNotSupported({
      feature: PlanFeatureTypes.FEATURE_GLOBAL_SEARCH,
    });
  }
  // A plan without global search reads small tables live and never the index.
  const liveOnly = access === 'live';
  const liveMaxRows = liveOnly ? searchLiveOnlyMaxRows() : undefined;
  // Some paths (shared views) arrive without columns: no primary key, and
  // the filters below would name no field.
  if (!baseModel.model.columns) await baseModel.model.getColumns();

  // Only a member's search starts a build, not a shared view or base visitor's.
  if (
    !liveOnly &&
    !baseModel.context.is_public &&
    !isSharedViewAccess(baseModel.context)
  ) {
    maybeAutoBuildSearchIndex(baseModel);
  }

  const availability = await searchAvailability(baseModel);
  if (availability === 'unsupported' || !baseModel.model.primaryKey) {
    reportSearchState('unsupported');
    return noRows(baseModel).filters;
  }

  const kinds = await classifySearchTerm(baseModel, term);
  const textOnly = kinds.num === undefined && kinds.day === undefined;
  // No trigram (`ab`, `東京`): the index can't narrow it, so only a small table
  // is searched, read directly. A number or date (`12`) matches as one on
  // every table, never as text.
  const scan =
    !kinds.pattern &&
    textOnly &&
    (await liveSearchable(baseModel, liveMaxRows));
  if (!scan && !kinds.pattern && textOnly) {
    // Live-only: a longer term wouldn't help, the table is too large either way.
    reportSearchState(liveOnly ? 'plan_limit' : 'term_too_short');
    return noRows(baseModel).filters;
  }

  const request = { term, timezone: getSearchTimezone(args), scan };
  if (scan || liveOnly || availability !== 'ready') {
    // Same matches as the index, read from the table: slower, so small tables only.
    if (!scan && !(await liveSearchable(baseModel, liveMaxRows))) {
      // Live-only never builds an index, so the plan is why, whichever cap
      // (plan rows, cells, `NC_SEARCH_LIVE_MAX_ROWS`) binds.
      reportSearchState(
        liveOnly
          ? 'plan_limit'
          : (await searchIndexTooLarge(
              baseModel.context,
              baseModel.model,
              baseModel.dbDriver,
            ))
          ? 'too_large'
          : 'too_large_unindexed',
      );
      return noRows(baseModel).filters;
    }
    if (!liveOnly && availability !== 'ready') reportSearchState(availability);
    return (await indexProvider.matchUnindexed(baseModel, request)).filters;
  }

  const match = await indexProvider.match(baseModel, request);

  if (match.kind === 'condition') return match.filters;

  const pk = baseModel.model.primaryKey;
  if (!pk)
    NcError.get(baseModel.context).badRequest('Table has no primary key');
  return [
    new Filter({
      is_group: true,
      logical_op: 'and',
      children: [
        new Filter({
          fk_column_id: pk.id,
          comparison_op: 'in',
          value: match.ids as any,
        }),
      ],
    }),
  ];
}

/**
 * Reads a searched page's primary keys on their own, under the search planner
 * settings, and narrows `pageQb` (filters, search, sort, limit; no joins) to
 * them. The select wrapped around it then plans normally: with nested loops
 * off, every LATERAL lookup or rollup hashes its whole related table per row.
 */
export async function pinSearchPage(
  baseModel: IBaseModelSqlV2,
  pageQb: Knex.QueryBuilder,
) {
  const guard = getQueryGuard();
  const pk = baseModel.model.primaryKey;
  if (
    !guard?.search ||
    !guard.planSettings ||
    !searchPlanSettings().length ||
    !baseModel.isPg ||
    !pk ||
    baseModel.model.primaryKeys?.length !== 1 ||
    !pageQb.toSQL().sql.includes(SEARCH_PLAN_MARK)
  ) {
    return;
  }
  const idsQb = pageQb.clone().clearSelect().select({ nc_pk: pk.column_name });
  // A builder's CTEs (base users) would be applied and cleared here, leaving
  // the final select without them: apply them to the copy and keep them.
  baseModel.dbDriver.cteGenerator?.()?.applyCte(idsQb);
  const rows = await baseModel.execAndParse(idsQb.toQuery(), null, {
    raw: true,
  });
  pageQb.clear('where').clear('order').clear('limit').clear('offset');
  if (rows.length) {
    pageQb.whereIn(
      pk.column_name,
      rows.map((r) => r.nc_pk),
    );
  } else {
    pageQb.whereRaw('false');
  }
}

/**
 * Bound a searched count: rows past the cap are never read, so the result is
 * at most `SEARCH_COUNT_CAP + 1` (shown as "1,000+").
 */
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
