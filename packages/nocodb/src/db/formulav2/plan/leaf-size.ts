import { UITypes } from 'nocodb-sdk';
import { collectWeightedSites } from './duplication';
import { estimateFormulaBytes } from './estimate';
import type { ClientType } from 'nocodb-sdk';
import type { PlanMetaResolver } from './types';
import type { FnHandlerKey, FnVariant } from '~/db/formulav2/fn-handler';

/**
 * A quoted reference to a column of the table being selected from —
 * `"alias"."column"`, so alias + name + 5 for the quotes and the dot. The
 * caller computes it where it can (the root model's columns and the table
 * alias are already in hand); this is the fallback for a column reached
 * through a relation, whose alias is generated during the build.
 */
export const LEAF_PLAIN_BYTES = 19;

/**
 * What wrapping a reference in a lookup sub-query costs, on top of whatever
 * the terminal column expands to: the correlated SELECT, the join onto the
 * relation, and the aggregate a to-many lookup needs.
 *
 * Calibrated against emitted SQL, not hand-counted. It is a constant rather
 * than a function of the joined table's identifiers, which makes it run ~1.3x
 * high on 40-character names and low on nothing measured — see
 * `evidence/FINDINGS-estimate-drift.md` section F. High is the safe direction:
 * this figure only ever decides whether to hoist FIRST, and hoisting a
 * formula that did not need it costs one build the plan's ratio guard would
 * have declined anyway.
 */
export const LEAF_LOOKUP_WRAP_BYTES = 243;

/** A rollup's aggregate sub-query, which does not carry its terminal column. */
export const LEAF_ROLLUP_BYTES = 257;

export interface LeafSizeOptions {
  resolve: PlanMetaResolver;
  clientType?: ClientType;
  /** the pg IEEE lowerings are in force — `isPgIeeeEnabled` */
  pgIeee?: boolean;
  /** the build pins a lowering — size it the way that variant emits */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
  /**
   * Exact size for a column the caller already knows about — the root model's
   * own columns, whose name and alias are known before the build. Returning a
   * number here also means "this is a plain column", which is what keeps a
   * formula over ordinary fields from costing any metadata reads at all.
   */
  plainBytes?: (columnId: string) => number | undefined;
}

/**
 * Bytes each Identifier in `tree` expands to, keyed by column id.
 *
 * This is the term a flat `ESTIMATED_LEAF_BYTES` got wrong: measured on one
 * real schema, a leaf ranges from 19B (plain column) to 898B (lookup onto a
 * three-level formula chain), and it keeps growing with the chain below it —
 * so it is not a per-column constant that could be tabulated. It is, however,
 * a pure function of the column's reference closure, which `PlanColumnMeta`
 * already describes. So compute it the same way `buildFormulaPlan` computes
 * leaf paths: recursively, memoised, cycle-guarded.
 *
 * Cost is one `resolve` per DISTINCT non-plain column in the closure, and the
 * build that follows resolves those same columns to emit them.
 */
export async function sizeTreeLeaves(
  tree: unknown,
  opts: LeafSizeOptions,
): Promise<Map<string, number>> {
  const memo = new Map<string, number>();

  const sizeOf = async (
    columnId: string,
    path: Set<string>,
  ): Promise<number> => {
    // a revisit contributes the minimum; the emitter's CircularRefContext
    // throws before such a formula could evaluate, so this only has to end
    if (path.has(columnId)) return LEAF_PLAIN_BYTES;
    if (memo.has(columnId)) return memo.get(columnId)!;

    // the cheap path: a column of the root model that is not a reference at
    // all. Answering here is what keeps the common formula off the metadata
    // layer entirely.
    const known = opts.plainBytes?.(columnId);
    if (known !== undefined) {
      memo.set(columnId, known);
      return known;
    }

    const meta = await opts.resolve(columnId);
    const nextPath = new Set(path).add(columnId);
    let size: number;

    switch (meta?.uidt) {
      case UITypes.Formula:
      case UITypes.Button:
        size = meta.formulaTree
          ? await sizeTree(meta.formulaTree, nextPath)
          : LEAF_PLAIN_BYTES;
        break;
      case UITypes.Lookup:
      case UITypes.LinkToAnotherRecord:
      case UITypes.Links:
        size =
          LEAF_LOOKUP_WRAP_BYTES +
          (meta.targetColumnId
            ? await sizeOf(meta.targetColumnId, nextPath)
            : LEAF_PLAIN_BYTES);
        break;
      case UITypes.Rollup:
        size = LEAF_ROLLUP_BYTES;
        break;
      // stored as an id but emitted as a correlated read of the user table —
      // sized like a lookup rather than like the column it is stored in
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
      case UITypes.User:
        size = LEAF_LOOKUP_WRAP_BYTES;
        break;
      default:
        size = LEAF_PLAIN_BYTES;
    }

    memo.set(columnId, size);
    return size;
  };

  /** a referenced formula's own expression, its leaves sized the same way */
  const sizeTree = async (subtree: unknown, path: Set<string>) => {
    const leafBytes = await resolveSites(subtree, path);
    return estimateFormulaBytes(subtree, {
      clientType: opts.clientType,
      pgIeee: opts.pgIeee,
      leafBytes: (name) => leafBytes.get(name),
    });
  };

  const resolveSites = async (subtree: unknown, path: Set<string>) => {
    const sizes = new Map<string, number>();
    for (const site of collectWeightedSites(subtree, {
      ieee: opts.pgIeee,
      fnVariants: opts.fnVariants,
    }).sites) {
      if (!sizes.has(site.name)) {
        sizes.set(site.name, await sizeOf(site.name, path));
      }
    }
    return sizes;
  };

  return resolveSites(tree, new Set());
}

/**
 * Types stored as a column of the table itself, so a reference to one emits
 * nothing but its quoted name. An allowlist rather than a denylist of the
 * relational types on purpose: guessing "plain" wrong under-counts the leaf,
 * and under is the direction that lets an oversized query through. A type
 * missing from here just costs one `resolve`.
 */
const PHYSICAL_LEAF_UIDTS = new Set<UITypes>([
  UITypes.ID,
  UITypes.AutoNumber,
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.PhoneNumber,
  UITypes.Email,
  UITypes.URL,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Duration,
  UITypes.Rating,
  UITypes.Checkbox,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Time,
  UITypes.Year,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.JSON,
  UITypes.GeoData,
  UITypes.Geometry,
  UITypes.SpecificDBType,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
]);

/**
 * Exact plain-leaf size for the columns of the table being selected from:
 * `"alias"."column_name"`, so alias + name + 5. Everything reached through a
 * relation gets its alias generated mid-build and falls back to the constant.
 *
 * Returning a number is also the signal that a column needs no metadata read,
 * which is what keeps an ordinary formula off the metadata layer entirely.
 */
export function makePlainLeafSizer(
  columns: { id?: string; column_name?: string; uidt?: UITypes }[],
  alias: string | undefined,
): (columnId: string) => number | undefined {
  const aliasLength = (alias ?? '').length;
  const byId = new Map<string, number>();
  for (const col of columns) {
    if (!col?.id || !PHYSICAL_LEAF_UIDTS.has(col.uidt as UITypes)) continue;
    byId.set(col.id, aliasLength + (col.column_name?.length ?? 0) + 5);
  }
  return (columnId) => byId.get(columnId);
}
