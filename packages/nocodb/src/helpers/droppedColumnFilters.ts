interface FilterNode {
  id?: string;
  fk_parent_id?: string | null;
  fk_column_id?: string | null;
  fk_parent_column_id?: string | null;
  is_group?: boolean | number | null;
  logical_op?: string | null;
}

const ROOT = Symbol('root');

/**
 * Ids of the filters (in a flat list) to leave out because they reference a
 * dropped column. Removing a filter must only widen what the set matches, so
 * a leaf in an OR-joined set (or one that narrows under a `not` group) takes
 * its enclosing group with it; at the top level that means every filter.
 */
export function getFilterIdsToDrop(
  filters: FilterNode[],
  droppedColumnIds: Set<string>,
): Set<string> {
  const drop = new Set<string>();
  if (!filters?.length || !droppedColumnIds?.size) return drop;

  const byId = new Map(filters.map((f) => [f.id, f]));
  const parentOf = (f: FilterNode) =>
    f.fk_parent_id && byId.has(f.fk_parent_id)
      ? byId.get(f.fk_parent_id)
      : undefined;
  // Form-field conditions share the view's list; each field's set is its own root.
  const setKey = (f: FilterNode) =>
    parentOf(f)?.id ?? `root:${f.fk_parent_column_id ?? ''}`;
  const sets = new Map<string, FilterNode[]>();
  for (const f of filters) {
    const key = setKey(f);
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(f);
  }
  const isNot = (f: FilterNode) => f.logical_op?.toLowerCase() === 'not';
  const isOrSet = (f: FilterNode) =>
    sets.get(setKey(f)).some((s) => s.logical_op?.toLowerCase() === 'or');

  // Lowest ancestor-or-self whose removal widens the result; ROOT = drop all.
  const removable = (node: FilterNode): FilterNode | typeof ROOT => {
    for (let x = node; x; x = parentOf(x)) {
      let negations = 0;
      for (let p = parentOf(x); p; p = parentOf(p)) if (isNot(p)) negations++;
      if (isOrSet(x) === (negations % 2 === 1)) return x;
    }
    return ROOT;
  };

  const dropSubtree = (node: FilterNode) => {
    drop.add(node.id);
    for (const child of sets.get(node.id) ?? []) dropSubtree(child);
  };
  const remove = (node: FilterNode) => {
    const target = removable(node);
    if (target === ROOT) {
      let top = node;
      while (parentOf(top)) top = parentOf(top);
      for (const f of sets.get(setKey(top))) dropSubtree(f);
    } else {
      dropSubtree(target);
    }
  };

  for (const f of filters) {
    if (drop.has(f.id)) continue;
    if (f.fk_parent_column_id && droppedColumnIds.has(f.fk_parent_column_id)) {
      dropSubtree(f);
    } else if (
      !f.is_group &&
      f.fk_column_id &&
      droppedColumnIds.has(f.fk_column_id)
    ) {
      remove(f);
    }
  }

  // A group left with no children counts as dropped too.
  let changed = drop.size > 0;
  while (changed) {
    changed = false;
    for (const f of filters) {
      const children = sets.get(f.id);
      if (
        f.is_group &&
        !drop.has(f.id) &&
        children?.length &&
        children.every((c) => drop.has(c.id))
      ) {
        remove(f);
        changed = true;
      }
    }
  }

  return drop;
}
