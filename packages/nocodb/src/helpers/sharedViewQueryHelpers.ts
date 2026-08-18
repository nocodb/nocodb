import type { NcContext } from '~/interface/config';
import type { View } from '~/models';
import type { FilterType } from 'nocodb-sdk';
import { Column, Model } from '~/models';
import { getViewExposedColumnIds } from '~/helpers/viewVisibleColumns';
import {
  filtersReferenceHiddenColumn,
  restrictQueryToExposedColumns,
  stripHiddenColumnFilters,
} from '~/helpers/nestedLinkQueryHelpers';
import { isSharedViewAccess } from '~/helpers/accessSource';
import {
  LIST_ARG_ALIAS_KEYS,
  LIST_ARG_ALIASES,
} from '~/helpers/listArgAliases';

/**
 * Query keys `restrictSharedViewQuery` can rewrite.
 *
 * `where` / `sort` / `fields` come from `LIST_ARG_ALIAS_KEYS` rather than being
 * spelled out, because `getListArgs` also accepts `filter`/`w`, `s` and `f` —
 * enumerating the canonical names here once left `?w=(Secret,eq,x)` compiling
 * against the model's full `aliasColObjMap`, i.e. the gate open.
 */
const SANITIZED_QUERY_KEYS = [
  ...LIST_ARG_ALIAS_KEYS,
  'filterArrJson',
  'filterArr',
  'sortArrJson',
  'sortArr',
];

/** Query keys `restrictSharedViewColumnReferences` inspects. */
const GROUP_BY_QUERY_KEYS = ['column_name', 'groupByColumnName'];
const COLUMN_REFERENCE_QUERY_KEYS = [...GROUP_BY_QUERY_KEYS, 'aggregation'];

/**
 * Everything `restrictSharedViewQuery` resolves before it can decide anything.
 * Hoistable so a route confining N query objects against ONE view resolves it
 * once — see `resolveSharedViewQueryScope`.
 */
export interface SharedViewQueryScope {
  exposedColumnIds: Set<string>;
  columns: Column[];
  aliasColObjMap: Record<string, Column>;
}

/**
 * Resolve the view's exposed-column set and column maps once.
 *
 * Worth hoisting on the bulk routes: `getViewExposedColumnIds` fans out to the
 * per-view-type lookups (gallery/kanban cover, kanban stack, calendar/timeline
 * range, gantt `DateDependency`), so re-resolving per bulk entry multiplies
 * those round-trips on an unauthenticated route.
 */
export async function resolveSharedViewQueryScope(
  context: NcContext,
  { model, view }: { model: Model; view: View },
): Promise<SharedViewQueryScope> {
  const exposedColumnIds = await getViewExposedColumnIds(context, {
    model,
    view,
  });
  const columns = await Column.list(context, { fk_model_id: model.id });
  const aliasColObjMap = await model.getAliasColObjMap(context, columns);

  return { exposedColumnIds, columns, aliasColObjMap };
}

/**
 * Confines a shared view's caller-supplied query to the columns that view
 * publishes. The payload has always honoured that (`getAst`'s `allowedCols`),
 * but `where` / `sort` / `filterArrJson` / `sortArrJson` / `fields` were
 * compiled against the table's FULL column set — leaving a hidden column
 * readable as a per-request oracle (`where`) or as an ordering (`sort`).
 *
 * Narrow by design: only the shared-view/form access source — a shared BASE is
 * an authenticated pseudo-user and keeps the full surface, as does any logged-in
 * caller — and only CALLER-supplied query, since the view's own sorts/filters
 * are applied downstream and may legitimately name an unshown column.
 *
 * Strips rather than rejects, so a search across several fields does not turn
 * into "return everything". Group-by is the exception — the column IS the whole
 * request, so it 4xxes instead (`assertSharedViewGroupByColumn`).
 */
export async function restrictSharedViewQuery(
  context: NcContext,
  {
    model,
    view,
    query,
    scope,
  }: {
    model: Model;
    view?: View;
    /** Mutated in place — the data fetch and the count both read from it. */
    query: Record<string, any>;
    /** Pre-resolved via `resolveSharedViewQueryScope`; resolved here if absent. */
    scope?: SharedViewQueryScope;
  },
): Promise<void> {
  if (!query || !view || !isSharedViewAccess(context)) return;

  // Skip the column/view resolution: this runs on every public list/count
  // request and the common case carries none of these keys.
  if (!SANITIZED_QUERY_KEYS.some((key) => query[key])) return;

  const { exposedColumnIds, columns, aliasColObjMap } =
    scope ?? (await resolveSharedViewQueryScope(context, { model, view }));

  // `where` + `sort` — same strip semantics as the nested-link restriction.
  await restrictQueryToExposedColumns(context, {
    model,
    columns,
    query,
    exposedColumnIds,
    aliasColObjMap,
  });

  // `filterArrJson` / `filterArr` — a pre-parsed tree keyed by `fk_column_id`,
  // bypassing the xwhere parser. Both spellings: either can reach the compiler.
  for (const key of ['filterArrJson', 'filterArr']) {
    const raw = query[key];
    if (!raw) continue;

    const wasString = typeof raw === 'string';
    let parsed: unknown = raw;
    if (wasString) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // malformed — leave it for the downstream parser to reject
      }
    }
    if (!Array.isArray(parsed)) continue;

    const filters = parsed as FilterType[];
    if (!filtersReferenceHiddenColumn(filters, exposedColumnIds)) continue;

    const survivors = stripHiddenColumnFilters(filters, exposedColumnIds);
    query[key] = survivors.length
      ? wasString
        ? JSON.stringify(survivors)
        : survivors
      : undefined;
  }

  // `fields` (and its `f` alias) — CE's list path ignores caller fields (getAst
  // gets `query: {}`), but the EE optimized path forwards them and
  // `sanitizePublicQuery` does not strip them. Intersect rather than drop, so a
  // projection naming only shown columns still works.
  for (const key of LIST_ARG_ALIASES.fields) {
    const raw = query[key];
    if (!raw || raw === '*') continue;

    const wasArray = Array.isArray(raw);
    const requested = (wasArray ? raw : String(raw).split(',')).map((f: any) =>
      String(f).trim(),
    );

    const kept = requested.filter((ref) => {
      const colId = aliasColObjMap[ref]?.id ?? ref;
      // Unresolvable names are harmless downstream — keep them.
      return (
        !columns.some((c) => c.id === colId) || exposedColumnIds.has(colId)
      );
    });

    if (kept.length === requested.length) continue;
    query[key] = kept.length ? (wasArray ? kept : kept.join(',')) : undefined;
  }

  // `sortArrJson` / `sortArr` — `{ field | fk_column_id, direction }` entries.
  for (const key of ['sortArrJson', 'sortArr']) {
    const raw = query[key];
    if (!raw) continue;

    const wasString = typeof raw === 'string';
    let parsed: unknown = raw;
    if (wasString) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    if (!Array.isArray(parsed)) continue;

    const kept = (parsed as { field?: string; fk_column_id?: string }[]).filter(
      (entry) => {
        const colId = entry?.fk_column_id ?? aliasColObjMap[entry?.field]?.id;
        // Unresolvable references are harmless downstream — keep them.
        return !colId || exposedColumnIds.has(colId);
      },
    );
    if (kept.length === (parsed as unknown[]).length) continue;

    query[key] = kept.length
      ? wasString
        ? JSON.stringify(kept)
        : kept
      : undefined;
  }
}

/**
 * `restrictSharedViewQuery` for an anonymous entry point that holds only the
 * view and delegates the fetch to an AUTHENTICATED service — the calendar,
 * timeline and gantt shared routes, which funnel into `datasService.dataList`
 * and so never reach the gate in `public-datas.service.ts`.
 *
 * Must run BEFORE those services merge their server-built date-window filters
 * into `query`: afterwards the caller's `filterArrJson` entries and the view's
 * own are one array, and stripping cannot tell them apart.
 */
export async function restrictSharedViewQueryForView(
  context: NcContext,
  {
    view,
    query,
  }: {
    view: View;
    /** Mutated in place. */
    query: Record<string, any>;
  },
): Promise<void> {
  if (!query || !view || !isSharedViewAccess(context)) return;

  const model = await Model.getByIdOrName(context, { id: view.fk_model_id });
  if (!model) return;

  await restrictSharedViewQuery(context, { model, view, query });
}

/**
 * The group-by / aggregation column references a shared view may name.
 *
 * Unlike `where`/`sort` these cannot be partially stripped — a group-by without
 * its column has no meaningful degraded form — so an unexposed reference is
 * dropped and returned in `rejected`, for the caller to drop or error on.
 *
 * `aggregation` was never a live leak: `resolveAggregateColumns` already skips
 * `show = false` columns when a viewId is present, and the public routes always
 * pass theirs. Covered here for its viewId-less branch.
 */
export async function restrictSharedViewColumnReferences(
  context: NcContext,
  {
    model,
    view,
    query,
    scope,
  }: {
    model: Model;
    view?: View;
    query: Record<string, any>;
    /** Pre-resolved via `resolveSharedViewQueryScope`; resolved here if absent. */
    scope?: SharedViewQueryScope;
  },
): Promise<{ rejected: string[] }> {
  if (!query || !view || !isSharedViewAccess(context)) return { rejected: [] };

  if (!COLUMN_REFERENCE_QUERY_KEYS.some((key) => query[key])) {
    return { rejected: [] };
  }

  const { exposedColumnIds, columns, aliasColObjMap } =
    scope ?? (await resolveSharedViewQueryScope(context, { model, view }));

  const rejected: string[] = [];

  /** Resolve an alias/id reference; `null` when it names no known column. */
  const resolve = (ref?: string) =>
    ref
      ? aliasColObjMap[ref]?.id ?? columns.find((c) => c.id === ref)?.id
      : null;

  const isExposed = (ref?: string) => {
    const colId = resolve(ref);
    // Unknown reference: not a disclosure — let the downstream compiler decide.
    if (!colId) return true;
    return exposedColumnIds.has(colId);
  };

  // `column_name` carries a column TITLE on this route despite the name — the
  // public group-by controller forwards the query verbatim.
  for (const key of GROUP_BY_QUERY_KEYS) {
    if (query[key] && !isExposed(query[key])) {
      rejected.push(query[key]);
      delete query[key];
    }
  }

  // `aggregation` — `[{ field, type }]`, JSON or already parsed. `min`/`max`
  // return raw values, so an unexposed target is stripped from the list.
  const raw = query.aggregation;
  if (raw) {
    const wasString = typeof raw === 'string';
    let parsed: unknown = raw;
    if (wasString) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    if (Array.isArray(parsed)) {
      const entries = parsed as { field?: string; column_name?: string }[];
      const kept = entries.filter((entry) => {
        const ref = entry?.field ?? entry?.column_name;
        if (isExposed(ref)) return true;
        rejected.push(ref);
        return false;
      });
      if (kept.length !== entries.length) {
        query.aggregation = wasString ? JSON.stringify(kept) : kept;
      }
    }
  }

  return { rejected };
}
