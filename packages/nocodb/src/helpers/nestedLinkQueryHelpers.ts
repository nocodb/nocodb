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
 * Reports whether any leaf references a known-but-hidden (non-exposed) column.
 * Used as a fast guard so the strip/re-serialize below only runs when there is
 * actually something to strip — otherwise the original `where` is left untouched.
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
 * Removes leaves that reference a known-but-hidden (non-exposed) column from a
 * parsed filter tree, pruning any group left empty. Leaves whose column can't be
 * resolved (no `fk_column_id`) are kept — they resolve to nothing downstream and
 * are harmless. Returns the surviving filters.
 */
function stripHiddenColumnFilters(
  filters: FilterType[] | undefined,
  exposedColumnIds: Set<string>,
): FilterType[] {
  const survivors: FilterType[] = [];
  for (const filter of filters || []) {
    if (filter.is_group) {
      const children = stripHiddenColumnFilters(
        filter.children as FilterType[],
        exposedColumnIds,
      );
      if (children.length) survivors.push({ ...filter, children });
    } else if (
      !filter.fk_column_id ||
      exposedColumnIds.has(filter.fk_column_id)
    ) {
      survivors.push(filter);
    }
    // else: known-but-hidden column — drop this leaf, keep the rest
  }
  return survivors;
}

/**
 * Re-serializes a parsed filter tree back to the v2 xwhere string
 * (`(field,op[,sub_op],value)`, groups wrapped in parens, children joined by
 * `~and`/`~or`). Used to re-emit a `where` after hidden-column leaves have been
 * stripped — every downstream consumer re-parses the string, so the surviving
 * conditions still apply.
 */
function serializeFiltersToXwhere(
  filters: FilterType[],
  columnById: Map<string, { title?: string }>,
): string {
  const one = (filter: FilterType, isFirst: boolean): string => {
    const prefix = isFirst ? '' : `~${filter.logical_op || 'and'}`;
    if (filter.is_group) {
      const inner = ((filter.children as FilterType[]) || [])
        .map((c, i) => one(c, i === 0))
        .join('');
      return `${prefix}(${inner})`;
    }
    const field =
      columnById.get(filter.fk_column_id)?.title ?? filter.fk_column_id;
    const parts: (string | number)[] = [field, filter.comparison_op];
    if (filter.comparison_sub_op) parts.push(filter.comparison_sub_op);
    if (filter.value !== undefined && filter.value !== null) {
      parts.push(
        Array.isArray(filter.value)
          ? filter.value.join(',')
          : (filter.value as string | number),
      );
    }
    return `${prefix}(${parts.join(',')})`;
  };
  return filters.map((f, i) => one(f, i === 0)).join('');
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

  // Strip only the leaves that reference a known-but-hidden (non-exposed) column
  // and re-emit the survivors, instead of dropping the whole `where`. The link
  // picker searches across the display value PLUS the other visible fields, so a
  // search like `(DisplayValue,like,%q%)~or(OtherField,like,%q%)` would otherwise
  // lose the entire clause on a restricted (cross-base / visibility-limited /
  // public) link — where only pk/pv/display are exposed — and silently return
  // every record. Keeping the exposed clauses preserves search on the display
  // value. Unknown column references survive the strip and resolve to nothing
  // downstream, exactly as before.
  if (query.where) {
    const { filters } = extractFilterFromXwhere(
      context,
      query.where,
      aliasColObjMap,
    );
    // Only touch the `where` when it actually references a hidden column —
    // otherwise leave the original string as-is (no re-serialization).
    if (filtersReferenceHiddenColumn(filters, exposedColumnIds)) {
      const survivors = stripHiddenColumnFilters(filters, exposedColumnIds);
      query.where = survivors.length
        ? serializeFiltersToXwhere(
            survivors,
            new Map(columns.map((c) => [c.id, c])),
          )
        : undefined;
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
