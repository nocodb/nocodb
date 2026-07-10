import {
  extractFilterFromXwhere,
  isLinksOrLTAR,
  NcApiVersion,
} from 'nocodb-sdk';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn, Model } from '~/models';
import { Column } from '~/models';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';

/**
 * Walks a parsed filter tree and reports whether any leaf references a column
 * outside the allowed (exposed) set.
 */
function filtersReferenceHiddenColumn(
  filters: FilterType[] | undefined,
  exposedColumnIds: Set<string>,
): boolean {
  for (const filter of filters || []) {
    if (filter.is_group) {
      if (
        filtersReferenceHiddenColumn(
          filter.children as FilterType[],
          exposedColumnIds,
        )
      ) {
        return true;
      }
    } else if (
      filter.fk_column_id &&
      !exposedColumnIds.has(filter.fk_column_id)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps only the sort terms that target an exposed (or unknown/harmless) column.
 *
 * Mirrors the parsing in `extractSortsObject` (the downstream compiler) so the two
 * never disagree about which column a term resolves to:
 *  - V3 sort is a JSON array of `{ field, direction }` — either a JSON string or an
 *    already-parsed array. The old `String(sort).split(',')` turned that into garbage
 *    tokens that matched no alias and survived, leaving an ordering oracle on hidden
 *    columns. Here we parse it the same way `extractSortsObject` does and resolve each
 *    `field` via the alias map.
 *  - V2 sort is a comma-separated string (or array) of field names, each optionally
 *    prefixed with a sort operator (`-`, `~-`, `~+`, `+`).
 *
 * A term whose field doesn't resolve to a known column is left in place — it resolves
 * to nothing downstream and is harmless; a known-but-hidden reference is the oracle to
 * drop. Returns `undefined` when nothing survives, preserving the input shape otherwise.
 */
function sanitizeSortValue(
  sort: string | string[] | { field?: string; direction?: string }[],
  aliasColObjMap: { [columnAlias: string]: Column },
  exposedColumnIds: Set<string>,
  apiVersion?: NcApiVersion,
): string | string[] | { field?: string; direction?: string }[] | undefined {
  const isExposedOrUnknown = (colId?: string) =>
    !colId || exposedColumnIds.has(colId);

  // V3 — JSON array of `{ field, direction }`, as a JSON string or parsed array.
  if (apiVersion === NcApiVersion.V3) {
    const wasString = typeof sort === 'string';
    let parsed: any = sort;
    if (wasString) {
      try {
        parsed = JSON.parse(sort as string);
      } catch {
        parsed = sort;
      }
    }
    if (!Array.isArray(parsed)) parsed = [parsed];

    const kept = (parsed as { field?: string; direction?: string }[]).filter(
      (s) => isExposedOrUnknown(aliasColObjMap[s?.field]?.id),
    );
    if (!kept.length) return undefined;
    return wasString ? JSON.stringify(kept) : kept;
  }

  // V2 — comma-separated string or array of strings, each optionally prefixed
  // with a sort operator (`-`, `~-`, `~+`, `+`).
  const wasArray = Array.isArray(sort);
  const terms = (wasArray ? (sort as string[]) : String(sort).split(','))
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((term) =>
      isExposedOrUnknown(aliasColObjMap[term.replace(/^~?[+-]/, '')]?.id),
    );
  if (!terms.length) return undefined;
  return wasArray ? terms : terms.join(',');
}

/**
 * Restricts the caller-supplied `where`/`sort` on a nested-link list to the
 * columns the link actually exposes.
 *
 * When the caller lacks visibility access to the related table, the nested fetch is
 * restricted to the link's primary key, primary value and (optional) custom
 * display-value column via `pkAndPvOnly`/`extractOnlyPrimaries`. The caller-supplied
 * `where`/`sort`, however, are otherwise compiled against the related table's full
 * column set, turning any hidden column into a one-bit oracle
 * (`where=(Secret,like,X%)` → the related row matches or it doesn't; `sort` reorders
 * by the hidden value). Stripping references to non-exposed columns keeps the
 * predicate confined to what the link already shows, mirroring the public
 * shared-view sanitizer.
 *
 * The restriction must match the fetch's actual SELECT exposure so the predicate and
 * the SELECT never disagree about what's visible — which differs by path:
 *  - when the caller threads in `hasLimitedAccess` (the EE optimized list path, which
 *    SELECTs the full column set whenever the user has visibility access —
 *    `extractOnlyPrimaries: hasLimitedAccess`): the gate is exactly that same value,
 *    so a cross-base link whose related table the user CAN see exposes everything and
 *    its `where`/`sort` apply unchanged (restricting it would silently drop legitimate
 *    filters on shown columns, e.g. searching the picker by a displayed non-pv field).
 *    The caller computes that access in the related table's own context, so cross-base
 *    roles are evaluated correctly and the predicate and SELECT resolve visibility from
 *    a single source.
 *  - default (CE fetcher, public shared view, legacy routes) SELECTs pk/pv-only for
 *    ANY cross-base link OR any visibility-limited table, independent of the caller's
 *    incidental access (`pkAndPvOnly: isCrossBaseLink() || hasLimitedAccess`, and the
 *    public path forces `extractOnlyPrimaries: true`). There the gate stays the
 *    conservative `isCrossBaseLink() || !access`, which also keeps the anonymous
 *    public path (no user) restricted. Relaxing it here would reopen the oracle on
 *    MySQL/disabled-optimization (unoptimized fetcher) and on public shared views,
 *    where the SELECT genuinely hides the columns.
 *
 * Must be invoked at every nested-link entry point that forwards request query to a
 * fetcher — because the EE optimized path builds its own query from `param.query`
 * and never funnels through the shared `BaseModelSqlv2.mmList`/`hmList`, sanitizing
 * the query at the entry point covers both the optimized and unoptimized fetchers.
 * The covered surfaces:
 *  - the v2/v3 `/links/` endpoint and its copy/paste/delete-all diff;
 *  - the v1 `/mm/`,`/hm/`,`/bt/`,`/oo/` linked-list endpoints;
 *  - the legacy `/data/:viewId/:rowId/mm|hm/:colId` route;
 *  - the excluded-list / link-picker endpoints (`mm/hm/bt/ooExcludedList`) — the
 *    same `pkAndPvOnly` restriction applies over the *unlinked* rows;
 *  - the public shared-view `/mm/`,`/hm/` endpoints (`publicMmList`/`publicHmList`).
 *
 * Mutates `query` in place — both the data fetch and the count read from it.
 */
export async function restrictNestedLinkQuery(
  context: NcContext,
  colOptions: LinkToAnotherRecordColumn,
  relatedModel: Model,
  query: Record<string, any>,
  options?: {
    /**
     * Precomputed "user lacks visibility access to the related table" decision,
     * threaded from the caller's SELECT exposure (the EE optimized list path's
     * `extractOnlyPrimaries: hasLimitedAccess`). When provided, the where/sort is
     * restricted iff this is true — resolving access once, from the same source as
     * the SELECT, so the predicate and the SELECT can't disagree. Omitted everywhere
     * else, where the conservative cross-base gate is computed here (see fn docs).
     */
    hasLimitedAccess?: boolean;
  },
): Promise<void> {
  if (!query) return;

  // Nothing to sanitize — skip the access check and column lookup entirely.
  if (!query.where && !query.sort) return;

  // The related table may live in another base — resolve its own context for the
  // column lookup below.
  const { refContext } = colOptions.getRelContext(context);

  // Gate the restriction to the fetch's actual SELECT exposure (see fn docs):
  //  - when the caller threads in `hasLimitedAccess` (the EE optimized SELECT's own
  //    access decision): restrict iff the user lacks access — the same value the
  //    SELECT uses, so the two can't disagree;
  //  - default: restrict for any cross-base link or visibility-limited table —
  //    conservative, and keeps the anonymous public path (no user) restricted.
  const restricted =
    options?.hasLimitedAccess !== undefined
      ? options.hasLimitedAccess
      : colOptions.isCrossBaseLink() ||
        !(await hasTableVisibilityAccess(
          context,
          relatedModel.id,
          context.user,
        ));

  if (!restricted) return;

  // Resolve the related table's columns in its own context and into a local list
  // (don't mutate the shared model's column cache, which the downstream
  // fetcher/count rely on).
  const columns = await Column.list(refContext, {
    fk_model_id: relatedModel.id,
  });
  const displayValueColId = colOptions.fk_display_value_column_id;
  const exposedColumnIds = new Set(
    columns
      .filter((c) => c.pk || c.pv || c.id === displayValueColId)
      .map((c) => c.id),
  );

  const aliasColObjMap = await relatedModel.getAliasColObjMap(
    refContext,
    columns,
  );

  // Drop the whole `where` if it references any hidden (non-exposed) column.
  // Unknown column references are left as-is — they resolve to nothing downstream
  // and are harmless, whereas a known-but-hidden reference is the oracle to kill.
  if (query.where) {
    const { filters } = extractFilterFromXwhere(
      context,
      query.where,
      aliasColObjMap,
    );
    if (filtersReferenceHiddenColumn(filters, exposedColumnIds)) {
      query.where = undefined;
    }
  }

  // Keep only sort terms that target an exposed (or unknown/harmless) column.
  if (query.sort) {
    query.sort = sanitizeSortValue(
      query.sort,
      aliasColObjMap,
      exposedColumnIds,
      context.api_version,
    );
  }
}

/**
 * Convenience wrapper around {@link restrictNestedLinkQuery} for entry points that
 * hold a resolved link {@link Column} rather than its colOptions/related model.
 * No-op for non-LTAR columns.
 */
export async function restrictNestedLinkQueryForColumn(
  context: NcContext,
  column: Column,
  query: Record<string, any>,
  options?: { hasLimitedAccess?: boolean },
): Promise<void> {
  if (!query || !column || !isLinksOrLTAR(column)) return;

  const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
    context,
  );
  if (!colOptions) return;

  const relatedModel = await colOptions.getRelatedTable(context);
  await restrictNestedLinkQuery(
    context,
    colOptions,
    relatedModel,
    query,
    options,
  );
}
