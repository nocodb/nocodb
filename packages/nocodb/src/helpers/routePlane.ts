export const ROUTE_PLANE = 'nc:route-plane';

export type RoutePlane = 'operator' | 'deploy';

// One prefix per trust level: see "Route namespaces" in packages/nocodb/CLAUDE.md.
const RESERVED_PREFIXES: ReadonlyArray<[string, RoutePlane]> = [
  ['/api/internal', 'operator'],
  ['/internal', 'deploy'],
];

export function routePlaneForPath(path: string): RoutePlane | undefined {
  // Express matches routes case-insensitively.
  const lower = path.toLowerCase();
  return RESERVED_PREFIXES.find(
    ([prefix]) => lower === prefix || lower.startsWith(`${prefix}/`),
  )?.[1];
}
