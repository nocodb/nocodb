import { isInterfaceFilterGroup } from './elements';
import type {
  InterfaceFilterGroup,
  InterfaceRecordColorConfig,
} from './elements';
import type { InterfaceVisualizationConfig } from './pageConfigs';

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
    group_by?: Array<{ fk_column_id: string }>;
    stacking_field_id?: string;
    image_field_id?: string | null;
    title_field_id?: string | null;
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
 * Apply a viz's `field_order` (written by the grid's header drag) to a list of
 * column ids: listed ids first, in that order, then everything unlisted in the
 * order it came in. Ids in `field_order` that aren't in `ids` are dropped — the
 * caller's list is the authority on which columns exist at all (a curated
 * `visible_field_ids`, the consumer's allow-listed projection, …).
 *
 * Single source of truth for BOTH sides, like `collectVizStructuralFieldIds`:
 * - frontend `buildInterfaceSyntheticMeta` → the rendered column order
 * - backend `interfaceTableDataExport` → the CSV column order
 */
export function orderVizFieldIds(
  viz: InterfaceVisualizationConfig,
  ids: Array<string | undefined>
): string[] {
  const present = ids.filter((id): id is string => !!id);

  const fieldOrder = viz.field_order;
  if (!fieldOrder?.length) return present;

  const presentSet = new Set(present);
  const listed = fieldOrder.filter((id) => presentSet.has(id));
  const listedSet = new Set(listed);

  return [...listed, ...present.filter((id) => !listedSet.has(id))];
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
