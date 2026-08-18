import debug from 'debug';
import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isDeletedCol,
  isHiddenCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  NcApiVersion,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn, Model, View } from '~/models';

// Per-strategy debug loggers, namespaced `nc:ast:<strategy name>` — enable e.g.
// `DEBUG=nc:ast:*` (all) or `DEBUG=nc:ast:viewVisibilityField` (one strategy) to
// trace which strategy owned each column and what it resolved to. Cached so each
// namespace is created once.
const strategyDebuggers = new Map<string, ReturnType<typeof debug>>();
const getStrategyDebug = (name: string): ReturnType<typeof debug> => {
  let log = strategyDebuggers.get(name);
  if (!log) {
    log = debug(`nc:ast:${name}`);
    strategyDebuggers.set(name, log);
  }
  return log;
};

/**
 * The projection map `getAst` returns. Kept intentionally narrow (`1 | true |
 * null | Ast`) so it stays assignable to `nocoExecute`'s `FieldRequest`.
 */
export type Ast = {
  [key: string]: 1 | true | null | Ast;
};

/**
 * What a column strategy yields for `isRequested`. Broader than an `Ast` node:
 * a strategy may return `false`/`0`/`undefined` ("not in the response"), `1`/
 * `true` (scalar requested), or a nested `Ast` (LTAR/lookup sub-tree). The main
 * loop collects these and narrows back to `Ast` on return.
 */
export type AstResult = boolean | number | null | undefined | Ast;

/**
 * Everything a column strategy needs that is constant across the model's
 * columns (resolved once per `getAst` call, before the per-column loop).
 */
export interface ColumnAstContext {
  model: Model;
  view?: View;
  apiVersion: NcApiVersion;
  getHiddenColumn: boolean;
  extractOrderColumn: boolean;
  includePkByDefault: boolean;
  /**
   * The `fields`/`f` request list (column titles or ids). Normalized to an
   * array-or-null at runtime; typed loosely to match `getAst`'s inference
   * (`string.includes`/`.length` and `string[].includes`/`.length` both work).
   */
  fields: string | string[] | null;
  /** view-column `show` map (`fk_column_id` -> truthy), or null when no view */
  allowedCols: Record<string, any> | null;
  rowColoringColumnIds: Set<string>;
  buttonFilterColumnIds: Set<string>;
  dependencyFieldsForRangeView?: string[];
  /**
   * When true, an explicitly-requested (`fields`) column bypasses the view-
   * `show` gate and is returned even if hidden. Opt-in; authenticated
   * link-picker paths only — never public (would leak hidden values; see the
   * DESIGN NOTE in public-datas.service.ts).
   */
  allowRequestedHiddenFields?: boolean;
}

/** Per-column inputs computed inside the loop before dispatch. */
export interface ColumnAstInput {
  col: Column;
  /** 1 for scalars, or the nested LTAR/lookup `Ast` computed upstream */
  value: AstResult;
  isInFields: boolean;
  isSortOrFilterColumn: boolean;
}

/**
 * Strategy pattern for deciding a single column's response inclusion.
 *
 * `match` mirrors one rung of the original `getAst` if/else ladder; the ladder's
 * "first branch wins" semantics are preserved by ordering — {@link columnAstStrategies}
 * is evaluated in array order and the FIRST strategy whose `match` returns true
 * owns the column. Each `match` is the standalone condition of its rung (it does
 * NOT need to re-encode "and no earlier rung matched" — ordering handles that).
 */
export interface ColumnAstStrategy {
  name: string;
  match(ctx: ColumnAstContext, input: ColumnAstInput): boolean;
  resolve(ctx: ColumnAstContext, input: ColumnAstInput): AstResult;
}

// 1. Row-meta column — never part of the response payload.
const metaFieldStrategy: ColumnAstStrategy = {
  name: 'metaField',
  match: (_ctx, { col }) => col.uidt === UITypes.Meta,
  resolve: () => false,
};

// 2. View sort/filter column (when `includeSortAndFilterColumns`).
//    For LTAR columns with a custom display value override, `value` holds the
//    nested AST that tells the query builder to include that override column.
//    Without an override, the legacy `true` is correct (pk + pv). Lookup columns
//    keep the scalar `1` — the EE query clients widen it when the looked-up
//    column is an LTAR with an override.
const sortFilterFieldStrategy: ColumnAstStrategy = {
  name: 'sortFilterField',
  match: (_ctx, { isSortOrFilterColumn }) => isSortOrFilterColumn,
  resolve: (_ctx, { value }) => value,
};

// 3. Column referenced by row-coloring or button-visibility filters.
const rowColorButtonFieldStrategy: ColumnAstStrategy = {
  name: 'rowColorButtonField',
  match: (ctx, { col }) =>
    ctx.rowColoringColumnIds.has(col.id) ||
    ctx.buttonFilterColumnIds.has(col.id),
  resolve: () => true,
};

// 4. Primary key on APIv3 — always returned (surfaced as `id`).
const v3PrimaryKeyFieldStrategy: ColumnAstStrategy = {
  name: 'v3PrimaryKeyField',
  match: (ctx, { col }) => !!col.pk && ctx.apiVersion === NcApiVersion.V3,
  resolve: () => true,
};

// 5. System column / foreign key on APIv3 (except Created/LastModified time)
//    — excluded from the response. PK is handled by the strategy above.
const v3SystemFieldStrategy: ColumnAstStrategy = {
  name: 'v3SystemField',
  match: (ctx, { col }) =>
    col.system &&
    !col.pk &&
    ![UITypes.CreatedTime, UITypes.LastModifiedTime].includes(col.uidt) &&
    ctx.apiVersion === NcApiVersion.V3,
  resolve: () => false,
};

// 6. Created/Last-Modified-By system column — excluded.
const createdModifiedByFieldStrategy: ColumnAstStrategy = {
  name: 'createdModifiedByField',
  match: (_ctx, { col }) => isCreatedOrLastModifiedByCol(col) && col.system,
  resolve: () => false,
};

// 7. Order system column — only when explicitly asked: order/hidden
//    extraction, or named in a `fields` projection (a curated field
//    allow-list that wants row order — e.g. interface page lists whose
//    client caches place realtime inserts by it — must be able to opt in;
//    v3 exclusion still wins via the earlier v3SystemField strategy).
const orderFieldStrategy: ColumnAstStrategy = {
  name: 'orderField',
  match: (_ctx, { col }) => isOrderCol(col) && col.system,
  resolve: (ctx, { isInFields }) =>
    ctx.extractOrderColumn || ctx.getHiddenColumn || isInFields,
};

// 8. Soft-delete system column — excluded.
const deletedFieldStrategy: ColumnAstStrategy = {
  name: 'deletedField',
  match: (_ctx, { col }) => isDeletedCol(col) && col.system,
  resolve: () => false,
};

// 9. `getHiddenColumn` mode — bypass the view `show` gate. Returns every column
//    that clears the system-column guard, including view-hidden ones.
const hiddenColumnFieldStrategy: ColumnAstStrategy = {
  name: 'hiddenColumnField',
  match: (ctx) => ctx.getHiddenColumn,
  resolve: (ctx, { col, value }) => {
    const { view, model } = ctx;

    const isVisibleNonHiddenColumn =
      (!view || !!view?.show_system_fields) && !isHiddenCol(col, model);
    const isCreatedOrLastModifiedSystemCol =
      isCreatedOrLastModifiedTimeCol(col) && col.system;
    // include non-has-many system links (self-link); has-many is part of
    // the mm relation and isn't needed on its own
    const isNonHasManySystemLink =
      isLinksOrLTAR(col) &&
      col.system &&
      [
        RelationTypes.BELONGS_TO,
        RelationTypes.MANY_TO_MANY,
        RelationTypes.ONE_TO_ONE,
      ].includes(
        (col.colOptions as LinkToAnotherRecordColumn)?.type as RelationTypes,
      );

    const shouldIncludeColumn =
      !isSystemColumn(col) ||
      isVisibleNonHiddenColumn ||
      isCreatedOrLastModifiedSystemCol ||
      isNonHasManySystemLink ||
      col.pk;

    return shouldIncludeColumn && value;
  },
};

// 10. View present — the `allowedCols` gate, keyed on view-column `show`, which
//     omits view-hidden columns from the response payload for EVERY caller. On a
//     shared view `restrictSharedViewQuery` confines the query surface to the
//     same set, so payload and query agree. `allowRequestedHiddenFields` is an
//     opt-in used only by the nested-link fetchers.
//     See the DESIGN NOTE in services/public-datas.service.ts.
//     PK is skipped here (handled by the fields/default strategies) when
//     `includePkByDefault` so it stays in the response by default.
const viewVisibilityFieldStrategy: ColumnAstStrategy = {
  name: 'viewVisibilityField',
  match: (ctx, { col }) =>
    !!ctx.allowedCols && (!ctx.includePkByDefault || !col.pk),
  resolve: (ctx, { col, value, isInFields }) => {
    const {
      allowedCols,
      view,
      fields,
      dependencyFieldsForRangeView,
      allowRequestedHiddenFields,
    } = ctx;

    // An explicitly-requested field passes even when view-hidden.
    const passesViewVisibility =
      allowedCols[col.id] || (allowRequestedHiddenFields && isInFields);

    return (
      passesViewVisibility &&
      (!isSystemColumn(col) ||
        (!view && isCreatedOrLastModifiedTimeCol(col)) ||
        view?.show_system_fields ||
        (dependencyFieldsForRangeView ?? []).includes(col.id) ||
        col.pv) &&
      (!fields?.length || isInFields) &&
      value
    );
  },
};

// 11. No view, but an explicit `fields` list — return only requested columns.
//     For APIv3 always keep the PK even when not listed (returned as `id`).
const explicitFieldsFieldStrategy: ColumnAstStrategy = {
  name: 'explicitFieldsField',
  match: (ctx) => !!ctx.fields?.length,
  resolve: (ctx, { col, value, isInFields }) =>
    (isInFields && value) || (ctx.apiVersion === NcApiVersion.V3 && col.pk),
};

// 12. Fallback — no view, no fields: every column is requested.
const defaultFieldStrategy: ColumnAstStrategy = {
  name: 'defaultField',
  match: () => true,
  resolve: (_ctx, { value }) => value,
};

/**
 * Ordered strategy chain — array order IS the priority (first match wins),
 * reproducing the original `getAst` if/else ladder exactly. `defaultFieldStrategy`
 * is the terminal catch-all and must stay last.
 */
export const columnAstStrategies: ColumnAstStrategy[] = [
  metaFieldStrategy,
  sortFilterFieldStrategy,
  rowColorButtonFieldStrategy,
  v3PrimaryKeyFieldStrategy,
  v3SystemFieldStrategy,
  createdModifiedByFieldStrategy,
  orderFieldStrategy,
  deletedFieldStrategy,
  hiddenColumnFieldStrategy,
  viewVisibilityFieldStrategy,
  explicitFieldsFieldStrategy,
  defaultFieldStrategy,
];

/**
 * Dispatch a single column through {@link columnAstStrategies} and return its
 * `isRequested` value. `defaultFieldStrategy` guarantees a match.
 */
export function resolveColumnAst(
  ctx: ColumnAstContext,
  input: ColumnAstInput,
): AstResult {
  const strategy = columnAstStrategies.find((s) => s.match(ctx, input))!;
  const result = strategy.resolve(ctx, input);

  const log = getStrategyDebug(strategy.name);
  if (log.enabled) {
    log('%s (%s) -> %o', input.col.title, input.col.id, result);
  }

  return result;
}
