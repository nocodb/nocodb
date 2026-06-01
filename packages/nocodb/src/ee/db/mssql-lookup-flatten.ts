/**
 * MSSQL lookup post-parse helpers.
 *
 * SQL Server has no `json_agg(value)`, so the EE FOR JSON extract emits every
 * looked-up value wrapped in an `{_lkv:<value>}` sentinel. These helpers strip
 * that sentinel so the rest of the converter pipeline is dialect-agnostic:
 *   • unwrapLkv          — one-level unwrap of a single `{_lkv:…}`.
 *   • deepUnwrapLkv      — recursive strip, used for a row's own Lookup columns
 *                          and for Lookups nested inside field-expanded linked
 *                          records (preProcessMssqlRows).
 *   • flattenNestedLookup — collapses a nested (array-of-arrays) lookup payload
 *                          to the single-level array pg's native json produces.
 *
 * Pure functions — no imports — kept in their own module so they can be
 * unit-tested without loading the BaseModel dependency graph.
 */

/** Unwrap the `{_lkv:…}` scalar-lookup sentinel; pass everything else through. */
export function unwrapLkv(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) && '_lkv' in v
    ? (v as { _lkv: unknown })._lkv
    : v;
}

/**
 * Recursively strip the `_lkv` sentinel wherever it occurs in a value.
 *
 * Used by `preProcessMssqlRows` for two cases:
 *   1. a row's OWN Lookup columns — `{_lkv:v}` (scalar) or `[{_lkv:v},…]`
 *      (array) — where it replaces the per-case inline unwrap;
 *   2. a Lookup that lives on a *field-expanded linked record*
 *      (`nested[Link][fields]=…`), which arrives at depth ≥ 2 still wrapped and
 *      would otherwise leak to the API (the top-level passes never reach it).
 *
 * Since `_lkv` is a reserved sentinel key that never appears as real data,
 * unwrapping it wherever it occurs is unambiguous. Mutates in place and returns
 * the node; no-ops cheaply when no `_lkv` is present (the default pk+pv link
 * expansion, where it is just a shallow walk).
 *
 * Note: a *nested* lookup (lookup-whose-target-is-array-shaped) sitting inside
 * an expanded child stays array-of-arrays here rather than being flattened the
 * way `flattenNestedLookup` flattens a top-level nested lookup — the sentinel
 * is still removed (no leak), only the depth-≥3 shape differs.
 */
export function deepUnwrapLkv(node: any): any {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = deepUnwrapLkv(node[i]);
    return node;
  }
  if (node && typeof node === 'object') {
    if ('_lkv' in node) return deepUnwrapLkv((node as { _lkv: unknown })._lkv);
    for (const k in node) node[k] = deepUnwrapLkv(node[k]);
    return node;
  }
  return node;
}

/**
 * Deep-flatten a nested-lookup payload into the single-level array pg's
 * `json_array_elements` produces.
 *
 * A lookup whose target column is itself array-shaped (LTAR-multi /
 * lookup-through-multi) arrives — per the FOR JSON extract — as an array of
 * `{_lkv:<value>}` sentinels, one per related row, where `<value>` is the
 * looked-up column's own (array-shaped) payload:
 *
 *   lookup-of-LTAR     → `[{_lkv:[{id,title},…]}, {_lkv:null}, …]`
 *   lookup-of-lookup   → `[{_lkv:[{_lkv:v},…]}, {_lkv:null}, …]`
 *
 * pg flattens every hop, so its shape is always a single flat array. We mirror
 * that: unwrap each `_lkv`, recurse into the array it wraps, and collect the
 * leaves (scalars, or LTAR objects kept intact for
 * substituteColumnIdsWithColumnTitles).
 *
 * Null handling matches `json_array_elements`: at an *intermediate* level
 * (siblings wrap further arrays) a `{_lkv:null}` is an empty related set and is
 * dropped; at a *leaf* level (siblings are scalars) a null is a real value and
 * is kept.
 */
export function flattenNestedLookup(arr: any[]): any[] {
  const out: any[] = [];
  const walk = (items: any[]) => {
    // Unwrap `_lkv` before classifying — the array members are `{_lkv:…}`
    // sentinels, not bare arrays/values.
    const isIntermediate = items.some((e) => Array.isArray(unwrapLkv(e)));
    for (const el of items) {
      const v = unwrapLkv(el);
      if (Array.isArray(v)) {
        walk(v);
      } else if (v == null) {
        if (!isIntermediate) out.push(null);
      } else {
        out.push(v);
      }
    }
  };
  walk(arr);
  return out;
}
