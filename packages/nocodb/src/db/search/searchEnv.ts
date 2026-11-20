/**
 * A numeric search setting. Unset, empty or blank (a compose or helm template
 * often leaves `NAME=`), not a number, or below `min` reads as `fallback`.
 */
export function searchEnvNumber<T extends number | undefined>(
  name: string,
  fallback: T,
  min = 1,
): number | T {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

/** `searchEnvNumber`, rounded down. */
export function searchEnvInt<T extends number | undefined>(
  name: string,
  fallback: T,
  min = 1,
): number | T {
  const value = searchEnvNumber(name, fallback, min);
  return value === undefined ? value : Math.floor(value);
}
