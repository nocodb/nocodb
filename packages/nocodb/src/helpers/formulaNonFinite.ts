// PG returns float8 Infinity/-Infinity/NaN as JS numbers, but JSON.stringify
// collapses all three to null — indistinguishable from a real NULL. Convert to
// strings before serialization. Display path only; sort/filter/aggregation use
// the NULLIF form where these never occur.
export function mapNonFiniteToString(value: unknown): unknown {
  if (typeof value !== 'number' || Number.isFinite(value)) return value;
  if (Number.isNaN(value)) return 'NaN';
  return value > 0 ? 'Infinity' : '-Infinity';
}
