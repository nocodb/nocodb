import type { Filter } from '~/models';
import { pickFields } from '~/utils/tsUtils';

/**
 * Fields the inverse needs to recreate a filter row. Mirrors the body
 * fields in `_schemas/filter.ts` minus system-set columns (`base_id`,
 * `source_id`, `fk_workspace_id`, `created_at`, `updated_at`) which the
 * forward path re-derives from context.
 */
const FILTER_TREE_FIELDS = [
  'id',
  'comparison_op',
  'comparison_sub_op',
  'logical_op',
  'fk_column_id',
  'fk_widget_id',
  'fk_parent_id',
  'is_group',
  'value',
  'enabled',
  'fk_level_id',
  'fk_view_id',
  'fk_hook_id',
  'fk_link_col_id',
  'fk_value_col_id',
  'fk_parent_column_id',
  'fk_row_color_condition_id',
  'fk_button_col_id',
  'fk_rls_policy_id',
  'order',
  'meta',
] as const satisfies readonly (keyof Filter)[];

export function pickFilterTreeFields(
  filter: Filter,
  children?: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const picked = pickFields(filter, FILTER_TREE_FIELDS);
  const node: Record<string, unknown> = {};
  for (const k of FILTER_TREE_FIELDS) {
    const v = picked[k];
    if (v !== undefined) node[k] = v;
  }
  if (children?.length) node.children = children;
  return node;
}
