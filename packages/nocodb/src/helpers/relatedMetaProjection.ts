import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { BoolType } from 'nocodb-sdk';
import type {
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
  RollupColumn,
} from '~/models';

/**
 * Related-table metadata projection for consumers that may only see a
 * restricted slice of a linked table — interface pages and shared views.
 *
 * `extractRelatedMetas` attaches the FULL column set of every foreign/junction
 * table a surviving link/lookup column reaches — which would leak hidden
 * foreign column names/types/options to consumers. A linked cell only renders
 * the related row's display value, so these helpers cut each related model down
 * to the minimum its allowed references need.
 */

/**
 * Column ids on FOREIGN tables that the base model's allowed columns actually
 * pull — those must survive related-meta projection so the lookup/rollup can
 * still render and a link cell can still show its display value, but nothing
 * else on the foreign table needs to be exposed as metadata.
 */
export function collectRelatedNeededColumnIds(
  columns: Model['columns'],
): Set<string> {
  const needed = new Set<string>();
  for (const col of columns ?? []) {
    if (col.uidt === UITypes.Lookup) {
      const id = (col.colOptions as LookupColumn | undefined)
        ?.fk_lookup_column_id;
      if (id) needed.add(id);
    } else if (col.uidt === UITypes.Rollup) {
      const id = (col.colOptions as RollupColumn | undefined)
        ?.fk_rollup_column_id;
      if (id) needed.add(id);
    } else if (isLinksOrLTAR(col.uidt)) {
      const colOptions = col.colOptions as
        | LinkToAnotherRecordColumn
        | undefined;

      // A link may render a CUSTOM display value instead of the related table's
      // pv. That column lives on the far table, so like a lookup's target it must
      // survive projection — else the cell renders blank while the data path
      // (which honours `fk_display_value_column_id`) returns the value.
      if (colOptions?.fk_display_value_column_id) {
        needed.add(colOptions.fk_display_value_column_id);
      }

      // The relation's own STRUCTURAL columns. Each lives on one side of the
      // link, and `projectRelatedModelColumns` keeps only the ids belonging to
      // the model it is projecting — so listing all four is safe and lets the
      // junction table keep its two FKs.
      //
      // Needed because the frontend resolves a BT value through them, e.g.
      // `nc-gui/utils/dataUtils.ts` dereferences the related meta's
      // `fk_parent_column_id` column non-null. That is usually the related pk
      // (kept anyway), but a link over a custom/external FK can point at a
      // non-pk column, which would otherwise be projected away and throw.
      for (const id of [
        colOptions?.fk_child_column_id,
        colOptions?.fk_parent_column_id,
        colOptions?.fk_mm_child_column_id,
        colOptions?.fk_mm_parent_column_id,
      ]) {
        if (id) needed.add(id);
      }
    }
  }
  return needed;
}

type RelatedColumn = Model['columns'][number];

/**
 * Same-model column ids that `column` depends on to render/resolve — the whole
 * point of keeping the dependency closure rather than a flat pk/pv list.
 *
 * A virtual column (lookup/rollup/LTAR/barcode/QR/formula/…) is meaningless
 * without the columns its config points at: a lookup needs its relation
 * column, a barcode its value column, a formula its referenced columns, an
 * LTAR its FK / custom-display column. We find them generically — any
 * `colOptions`/`meta` value that IS a column id on this same model counts, plus
 * formula column-id references embedded in the formula string. Cross-table
 * references (e.g. a lookup's `fk_lookup_column_id`, which lives on the FAR
 * table) are naturally excluded because they aren't in `sameModelIds`.
 */
export function sameModelColumnDeps(
  column: RelatedColumn,
  sameModelIds: Set<string>,
): string[] {
  const deps: string[] = [];

  const scan = (bag: unknown) => {
    if (!bag || typeof bag !== 'object') return;
    for (const value of Object.values(bag)) {
      if (typeof value === 'string' && sameModelIds.has(value))
        deps.push(value);
    }
  };

  scan(column.colOptions);
  scan(column.meta);

  // Formulas reference columns by id inside the (id-substituted) formula
  // string rather than as a discrete `*_column_id` field.
  if (column.uidt === UITypes.Formula) {
    const formula = (column.colOptions as { formula?: string } | undefined)
      ?.formula;
    if (typeof formula === 'string' && formula) {
      for (const id of sameModelIds) {
        if (formula.includes(id)) deps.push(id);
      }
    }
  }

  return deps;
}

/**
 * Project a related (foreign/junction) model's metadata to only the columns an
 * interface consumer legitimately needs: primary key(s) + display value (the
 * linked-cell render) + any column an allowed lookup/rollup pulls
 * (`neededColIds`), plus the TRANSITIVE same-model dependency closure of those
 * (so a lookup/rollup/LTAR/formula display value keeps the columns it resolves
 * through). Everything genuinely unreferenced on the foreign table stays
 * hidden. Returns a COPY — the underlying Model is cache-shared, so its
 * `columns`/`columnsById` must never be mutated in place.
 */
export function projectRelatedModelColumns(
  related: Model,
  neededColIds: Set<string>,
): Model {
  if (!related?.columns) return related;

  const sameModelIds = new Set(related.columns.map((c) => c.id));
  const byId = new Map(related.columns.map((c) => [c.id, c]));

  // Seed: pk(s) + display value + the columns base lookups/rollups pull.
  const keep = new Set<string>();
  for (const column of related.columns) {
    if (column.pk || column.pv) keep.add(column.id);
  }
  for (const id of neededColIds) {
    if (sameModelIds.has(id)) keep.add(id);
  }

  // Transitively pull in each kept column's same-model dependencies.
  const queue = [...keep];
  while (queue.length) {
    const column = byId.get(queue.pop()!);
    if (!column) continue;
    for (const depId of sameModelColumnDeps(column, sameModelIds)) {
      if (!keep.has(depId)) {
        keep.add(depId);
        queue.push(depId);
      }
    }
  }

  return withColumns(related, keep);
}

function withColumns(model: Model, keep: Set<string>): Model {
  const columns = model.columns.filter((column) => keep.has(column.id));
  const columnsById = Object.fromEntries(
    columns.map((column) => [column.id, column]),
  );

  return Object.assign(Object.create(Object.getPrototypeOf(model)), model, {
    columns,
    columnsById,
    columnsHash: undefined,
  });
}

/**
 * The shared table's own entry, reached through a self-link or a lookup back
 * to it: unlike a linked table it keeps no pk/pv seed or dependency closure,
 * only what the view exposes, needed columns the view doesn't hide (link FKs
 * are system columns, kept so the frontend can resolve the link) and the
 * display value of a shown self-link.
 */
function projectSharedModelColumns(
  shared: Model,
  neededColIds: Set<string>,
  { exposedColumnIds, hiddenColumnIds }: SharedModelVisibility,
): Model {
  if (!shared?.columns) return shared;

  const keep = new Set<string>();
  for (const column of shared.columns) {
    if (
      exposedColumnIds.has(column.id) ||
      (neededColIds.has(column.id) &&
        (column.system || !hiddenColumnIds.has(column.id)))
    ) {
      keep.add(column.id);
    }

    // A shown self-link's cell renders the linked rows' display value.
    if (
      isLinksOrLTAR(column.uidt) &&
      exposedColumnIds.has(column.id) &&
      !hiddenColumnIds.has(column.id)
    ) {
      const colOptions = column.colOptions as
        | LinkToAnotherRecordColumn
        | undefined;
      if (colOptions?.fk_related_model_id !== shared.id) continue;
      const displayId =
        colOptions.fk_display_value_column_id ??
        shared.columns.find((c) => c.pv)?.id;
      if (displayId) keep.add(displayId);
    }
  }
  return withColumns(shared, keep);
}

export function getSharedModelVisibility(
  modelId: string,
  exposedColumns: Model['columns'],
  viewColumns: { fk_column_id?: string; show?: BoolType }[] = [],
): SharedModelVisibility {
  return {
    modelId,
    exposedColumnIds: new Set((exposedColumns ?? []).map((c) => c.id)),
    hiddenColumnIds: new Set(
      viewColumns.filter((vc) => !vc.show).map((vc) => vc.fk_column_id),
    ),
  };
}

export interface SharedModelVisibility {
  modelId: string;
  /** Columns of the shared model the share exposes itself. */
  exposedColumnIds: Set<string>;
  /** Columns the view hides. */
  hiddenColumnIds: Set<string>;
}

// Tables only reached through a link display value chain, per relatedMetas map, with the
// columns each keeps besides pk + display value (the override of the link that enters it).
const displayValueHops = new WeakMap<object, Map<string, Set<string>>>();

/** Marks a related meta as only reached through a display value chain. */
export function markDisplayValueHop(
  relatedMetas: Record<string, Model>,
  modelId: string,
  keepColumnIds: Iterable<string> = [],
) {
  const hops = displayValueHops.get(relatedMetas) ?? new Map();
  hops.set(modelId, new Set(keepColumnIds));
  displayValueHops.set(relatedMetas, hops);
}

/** A table a column reaches directly is projected like any related meta. */
export function unmarkDisplayValueHop(
  relatedMetas: Record<string, Model>,
  modelId: string,
) {
  displayValueHops.get(relatedMetas)?.delete(modelId);
}

/** Safety bound on the fixpoint below — chains are short in practice. */
const RELATED_PROJECTION_MAX_PASSES = 6;

/**
 * Project every entry of a `relatedMetas` map down to what `baseColumns`
 * legitimately reference, replacing each entry with a projected COPY.
 *
 * The needed-column set must reach a FIXPOINT across the chain: base pulls
 * `B.L2`, and `L2` itself pulls a column on a deeper table `C`, so a single
 * base-only pass would trim `C` to pk+pv and strip the chain's terminal column.
 * Hence: re-collect from every KEPT related column until nothing new appears.
 *
 * `extraNeededColIds` keeps related-table columns the consumer renders directly
 * (e.g. a List view level's visible fields).
 *
 * Mutates the map (the caller owns it); the Models inside are cache-shared, so
 * they are replaced, never edited in place.
 */
export function projectRelatedMetas(
  relatedMetas: Record<string, Model>,
  baseColumns: Model['columns'],
  extraNeededColIds: Iterable<string> = [],
  sharedModel?: SharedModelVisibility,
): void {
  const neededColIds = collectRelatedNeededColumnIds(baseColumns);
  for (const id of extraNeededColIds) neededColIds.add(id);
  const unprojected = { ...relatedMetas };
  const hops = new Map(displayValueHops.get(relatedMetas));
  // the shared table keeps the view's own visibility, even as a hop
  if (sharedModel) hops.delete(sharedModel.modelId);

  // A hop only renders its display value: pk + display value, without the dependency
  // columns the projection below would pull in for them.
  for (const [key, keep] of hops) {
    const hop = unprojected[key];
    if (!hop?.columns) continue;
    relatedMetas[key] = withColumns(
      hop,
      new Set(
        hop.columns
          .filter((c) => c.pk || c.pv || keep.has(c.id))
          .map((c) => c.id),
      ),
    );
  }

  for (let pass = 0; pass < RELATED_PROJECTION_MAX_PASSES; pass++) {
    for (const key of Object.keys(relatedMetas)) {
      if (sharedModel && key === sharedModel.modelId) {
        relatedMetas[key] = projectSharedModelColumns(
          unprojected[key],
          neededColIds,
          sharedModel,
        );
        continue;
      }
      if (hops.has(key)) continue;
      relatedMetas[key] = projectRelatedModelColumns(
        unprojected[key],
        neededColIds,
      );
    }

    const before = neededColIds.size;
    for (const [key, related] of Object.entries(relatedMetas)) {
      if (hops.has(key)) continue;
      for (const id of collectRelatedNeededColumnIds(related?.columns)) {
        neededColIds.add(id);
      }
    }
    if (neededColIds.size === before) break;
  }
}
