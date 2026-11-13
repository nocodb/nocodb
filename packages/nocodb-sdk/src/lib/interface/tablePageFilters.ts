import type { InterfaceFilterGroup, InterfaceFilterNode } from './elements';

/** A filter group that reaches the query — absent and childless ones don't. */
export function isNonEmptyInterfaceFilterGroup(
  group: unknown
): group is InterfaceFilterGroup {
  const children = (group as { children?: unknown } | null | undefined)
    ?.children;
  return Array.isArray(children) && children.length > 0;
}

// Children joined only by AND can be spliced into another AND group as-is.
const isAndChain = (group: InterfaceFilterGroup) =>
  group.children.every((child, i) => i === 0 || child.logical_op !== 'or');

/**
 * Move every visualization filter of a TABLE page config into the page-level
 * `filters` (AND), clearing it on the viz. Returns the same object when no viz
 * carries a non-empty filter.
 */
export function hoistInterfaceTableVizFilters<T>(config: T): T {
  if (!config || typeof config !== 'object') return config;

  const { filters, visualizations } = config as {
    filters?: unknown;
    visualizations?: unknown;
  };
  if (!Array.isArray(visualizations)) return config;

  const vizGroups = visualizations
    .map((viz) => (viz as { filters?: unknown } | null)?.filters)
    .filter(isNonEmptyInterfaceFilterGroup);
  if (!vizGroups.length) return config;

  const parts: InterfaceFilterGroup[] = [];
  const seen = new Set<string>();
  for (const group of isNonEmptyInterfaceFilterGroup(filters)
    ? [filters, ...vizGroups]
    : vizGroups) {
    const key = JSON.stringify(group);
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(group);
  }

  const children: InterfaceFilterNode[] = parts.flatMap((group) =>
    isAndChain(group)
      ? group.children.map((child, i) =>
          i === 0 ? { ...child, logical_op: 'and' as const } : child
        )
      : [{ ...group, logical_op: 'and' as const }]
  );

  return {
    ...config,
    filters: { is_group: true, logical_op: 'and', children },
    visualizations: visualizations.map((viz) => {
      if (!viz || typeof viz !== 'object' || !('filters' in viz)) return viz;
      const { filters: _dropped, ...rest } = viz as Record<string, unknown>;
      return rest;
    }),
  };
}
