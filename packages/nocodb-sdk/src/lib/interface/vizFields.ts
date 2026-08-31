import { isInterfaceFilterGroup } from './elements';
import type {
  InterfaceFilterGroup,
  InterfaceRecordColorConfig,
} from './elements';
import { InterfaceVisualizationTypes } from './pageConfigs';
import type { InterfaceVisualizationConfig } from './pageConfigs';

/**
 * Viz types whose cards render the DISPLAY VALUE ONLY when `visible_field_ids`
 * is absent — grid/list render every column in that state.
 *
 * A security contract, not a rendering detail: the server's field allow-list
 * reads absent curation as "unrestricted", which for these types serves
 * columns the surface never draws. The renderer's `defaultShow` and the
 * builder's Fields summary are the other two halves — all three route here.
 *
 * The enum is read inside the body on purpose: a top-level SDK enum read can
 * hit an undefined enum object in the prod bundle.
 */
export function isMinimalCardInterfaceViz(
  type?: InterfaceVisualizationTypes | null
): boolean {
  return (
    type === InterfaceVisualizationTypes.KANBAN ||
    type === InterfaceVisualizationTypes.GALLERY ||
    type === InterfaceVisualizationTypes.TIMELINE ||
    type === InterfaceVisualizationTypes.GANTT
  );
}

/**
 * STRUCTURAL field ids of a visualization — columns the viz consumes as DATA
 * (grouping, coloring, date anchors, dedicated display slots), as opposed to
 * the card/record display fields the builder curates via `visible_field_ids`.
 *
 * Single source of truth for BOTH sides of the field-visibility boundary:
 * - backend `field-allowlist.ts` → what the data/meta endpoints may serialize
 * - frontend `buildInterfaceSyntheticMeta` → which columns survive on the
 *   synthetic meta
 * The two lists drifted three times (date ranges, color_by, group_by) when
 * they were maintained by hand — add new column-referencing viz config HERE.
 */
export function collectVizStructuralFieldIds(
  viz: InterfaceVisualizationConfig
): Set<string> {
  const ids = new Set<string>();

  const push = (...candidates: Array<string | null | undefined>) => {
    for (const id of candidates) {
      if (id) ids.add(id);
    }
  };

  const anyViz = viz as InterfaceVisualizationConfig & {
    theme?: string;
    group_by?: Array<{ fk_column_id: string }>;
    stacking_field_id?: string;
    image_field_id?: string | null;
    title_field_id?: string | null;
    secondary_field_id?: string | null;
    prefix_field_id?: string | null;
    label_field_ids?: string[];
    label_image_field_id?: string | null;
    date_ranges?: Array<{
      start_field_id: string;
      end_field_id?: string | null;
    }>;
    color_by?: InterfaceRecordColorConfig | null;
  };

  push(
    anyViz.stacking_field_id,
    anyViz.image_field_id,
    anyViz.title_field_id,
    // `simple` is the only gallery theme that renders a secondary field, and its
    // picker is hidden under every other theme — so a value left behind by a
    // theme switch would keep projecting a column nobody can see or clear.
    anyViz.theme === 'simple' ? anyViz.secondary_field_id : undefined,
    anyViz.prefix_field_id,
    anyViz.label_image_field_id
  );

  for (const entry of anyViz.group_by ?? []) push(entry.fk_column_id);

  for (const id of anyViz.label_field_ids ?? []) push(id);

  // Date-viz range anchors (calendar/timeline/gantt) — the stores resolve
  // start/end columns off the meta regardless of card display fields.
  for (const range of anyViz.date_ranges ?? []) {
    push(range.start_field_id, range.end_field_id);
  }

  // Record colouring evaluates column VALUES client-side — both the
  // select-field column and every column referenced by condition filters.
  const colorBy = anyViz.color_by;
  if (colorBy) {
    if (colorBy.mode === 'select_field') {
      push(colorBy.fk_column_id);
    } else if (colorBy.mode === 'conditions') {
      for (const condition of colorBy.conditions ?? []) {
        collectFilterColumnIds(ids, condition.filters);
      }
    }
  }

  return ids;
}

/**
 * Apply an explicit `field_order` to a list of column ids: listed ids first, in
 * that order, then everything unlisted in the order it came in. Ids in
 * `fieldOrder` that aren't in `ids` are dropped — the caller's list is the
 * authority on which columns exist at all (a curated `visible_field_ids`, the
 * consumer's allow-listed projection, …).
 *
 * Ordering NEVER widens what's visible or fetched: it only permutes the ids the
 * caller already decided on. That's why the allow-list collectors don't read
 * `field_order` at all.
 *
 * Takes the array rather than the config so leveled lists — whose PARENT levels
 * carry their own `field_order` — share one implementation with the viz level.
 */
export function applyFieldOrder(
  fieldOrder: string[] | null | undefined,
  ids: Array<string | undefined>
): string[] {
  const present = ids.filter((id): id is string => !!id);

  if (!fieldOrder?.length) return present;

  const presentSet = new Set(present);
  const listed = fieldOrder.filter((id) => presentSet.has(id));
  const listedSet = new Set(listed);

  return [...listed, ...present.filter((id) => !listedSet.has(id))];
}

/**
 * Apply a viz's `field_order` (written by the builder's Fields pane; on grids
 * the column header drag writes it too) to a list of column ids.
 *
 * Single source of truth for BOTH sides, like `collectVizStructuralFieldIds`:
 * - frontend `buildInterfaceSyntheticMeta` → the rendered column order
 * - backend `interfaceTableDataExport` → the CSV column order
 */
export function orderVizFieldIds(
  viz: InterfaceVisualizationConfig,
  ids: Array<string | undefined>
): string[] {
  return applyFieldOrder(viz.field_order, ids);
}

/** Column ids referenced anywhere in a config filter tree. */
export function collectFilterColumnIds(
  ids: Set<string>,
  node: InterfaceFilterGroup | null | undefined
): void {
  for (const child of node?.children ?? []) {
    if (isInterfaceFilterGroup(child)) collectFilterColumnIds(ids, child);
    else if (child.fk_column_id) ids.add(child.fk_column_id);
  }
}
