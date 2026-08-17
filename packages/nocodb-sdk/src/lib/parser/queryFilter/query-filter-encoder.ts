// Encoder counterpart to the query-filter parser.
//
// The `where` query DSL is `(field,op,value)`. Its grammar treats `(` `)` `,`
// `'` `"` as structural, so any of those appearing inside a field name or value
// must be wrapped in a quote pair. The parser strips only the OUTER quote pair
// (see `trimQuote` in common-cst-parser) and does NOT process backslash
// escapes — so the wrapping quote must be a character the token does not itself
// contain. This encoder builds tokens that round-trip through the parser.

const STRUCTURAL = /[()'",]/;

/**
 * Encode a field name or value as a single query-filter token that parses back
 * to the exact input.
 *
 * - No structural/whitespace-sensitive characters → returned as-is.
 * - Contains structural chars → wrapped in a quote the value doesn't contain
 *   (double preferred, single as fallback).
 * - Contains BOTH quote types → double-quoted; the parser keeps the value
 *   verbatim, so this pathological case is best-effort.
 */
export function encodeQueryFilterToken(input: string | number): string {
  const s = String(input);

  const needsWrapping = s === '' || STRUCTURAL.test(s) || s.trim() !== s;
  if (!needsWrapping) return s;

  if (!s.includes('"')) return `"${s}"`;
  if (!s.includes("'")) return `'${s}'`;
  return `"${s}"`;
}

/** Build a single `(field,op,value)` clause with both sides safely encoded. */
export function encodeQueryFilterClause(
  field: string,
  op: string,
  value?: string | number
): string {
  const parts = [encodeQueryFilterToken(field), op];
  if (value !== undefined) parts.push(encodeQueryFilterToken(value));
  return `(${parts.join(',')})`;
}
