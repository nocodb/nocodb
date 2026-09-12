export function addDummyRootAndNest(filters: any[]): any {
  // If empty, return undefined
  if (filters.length === 0) {
    return undefined;
  }

  // Create a map of filters by parent_id for easy lookup
  const filterMap = new Map<string | null, any[]>();
  filters.forEach((filter) => {
    const parentId = filter.parent_id || null;
    if (!filterMap.has(parentId)) {
      filterMap.set(parentId, []);
    }
    filterMap.get(parentId)!.push(filter);
  });

  // Helper function to determine group_operator for a group
  const getGroupOperatorFromFirstChild = (
    groupId: string | null,
  ): 'AND' | 'OR' | null => {
    const children = filterMap.get(groupId) || [];
    return children.length > 0 && children[0].logical_op
      ? // if the second child is a logical operator, return it or fallback to the first child
        // since in the current implementation, the first child logical op doesn't matter and it always and
        (children[1] || children[0]).logical_op?.toUpperCase()
      : null;
  };

  // Build a nested structure recursively
  const buildNestedStructure = (parentId: string | null): any[] => {
    const children = filterMap.get(parentId) || [];
    return children.map((child) => {
      const isGroup = !!child.is_group;
      const groupOperator = isGroup
        ? getGroupOperatorFromFirstChild(child.id)
        : undefined;
      const currentItem = {
        ...child,
        parent_id: undefined, // Root-level items have no parent_id
        group_operator: isGroup ? groupOperator : undefined, // Only groups get updated group_operator
        logical_op: undefined, // Remove logical_op from filters
        filters: isGroup ? buildNestedStructure(child.id) : undefined, // Recursively nest children for groups
        is_group: undefined,
      };

      if (!isGroup) {
        delete currentItem.logical_op; // Remove logical_op from non-groups
      }

      return currentItem;
    });
  };

  // Build the nested structure starting from the dummy root
  const nestedFilters = buildNestedStructure(null);

  // Add the dummy root group
  return {
    id: 'root',
    group_operator:
      nestedFilters.length > 0 ? getGroupOperatorFromFirstChild(null) : null,
    filters: nestedFilters,
  };
}
