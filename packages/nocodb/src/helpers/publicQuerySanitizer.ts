// Response-shape keys a public/shared-view caller must not control:
// `getHiddenColumn` bypasses the getAst `allowedCols` gate and emits every
// non-system column's values; `nested` drives caller-controlled LTAR expansion.
//
// Deliberately does NOT touch `where` / `sort` / `filter` / `groupBy` references
// to view-hidden columns — those stay queryable. See the DESIGN NOTE in
// public-datas.service.ts.
export const PUBLIC_QUERY_BLOCKED_KEYS = ['getHiddenColumn', 'nested'] as const;

export function sanitizePublicQuery<T extends Record<string, any>>(
  query: T,
): T {
  if (!query) return query;
  const sanitized = { ...query };
  for (const key of PUBLIC_QUERY_BLOCKED_KEYS) {
    delete (sanitized as Record<string, any>)[key];
  }
  return sanitized;
}
