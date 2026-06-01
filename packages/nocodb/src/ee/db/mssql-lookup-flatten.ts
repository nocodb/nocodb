/**
 * MSSQL lookup post-parse helpers.
 *
 * SQL Server has no `json_agg(value)`, so the EE FOR JSON extract emits every
 * looked-up value wrapped in an `{_lkv:<value>}` sentinel. These helpers
 * normalize that wire shape back to the flat arrays pg's native json produces,
 * so the rest of the converter pipeline is dialect-agnostic. Pure functions —
 * no imports — kept in their own module so they can be unit-tested without
 * loading the BaseModel dependency graph.
 */

/** Unwrap the `{_lkv:…}` scalar-lookup sentinel; pass everything else through. */
export function unwrapLkv(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) && '_lkv' in v
    ? (v as { _lkv: unknown })._lkv
    : v;
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
