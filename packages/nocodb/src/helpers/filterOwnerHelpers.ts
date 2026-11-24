// Columns that tie a filter to what it filters.
export const FILTER_OWNER_KEYS = [
  'fk_view_id',
  'fk_row_color_condition_id',
  'fk_hook_id',
  'fk_link_col_id',
  'fk_parent_column_id',
  'fk_button_col_id',
  'fk_widget_id',
  'fk_rls_policy_id',
] as const;

export type FilterOwner = Partial<
  Record<(typeof FILTER_OWNER_KEYS)[number], string>
>;

/**
 * Sets a filter's owner from the route only: owner columns sent in the body
 * (here or in nested `children`) would attach it to another view, hook or widget.
 */
export function withFilterOwner<T extends object>(
  filter: T,
  owner: FilterOwner = {},
): T {
  const result = { ...filter } as Record<string, unknown>;
  for (const key of FILTER_OWNER_KEYS) {
    delete result[key];
  }
  Object.assign(result, owner);
  if (Array.isArray(result.children)) {
    result.children = result.children.map((child: object) =>
      withFilterOwner(child, owner),
    );
  }
  return result as T;
}
