export function isTokenExpired(
  expires: string | number | Date | null | undefined,
): boolean {
  if (expires == null) return true;

  // SQLite stores JS Date parameters bound to a varchar column as the unix-ms
  // numeric cast to text ("1780250932317.0") — `new Date(numericString)` only
  // parses date-shaped strings, so it returns Invalid Date for those. Coerce
  // a digits/dot-only string to a number first so the genuine timestamp wins
  // over the NaN-from-invalid-Date branch below.
  const input =
    typeof expires === 'string' && /^\d+(\.\d+)?$/.test(expires)
      ? Number(expires)
      : expires;

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return true;
  return date < new Date();
}
