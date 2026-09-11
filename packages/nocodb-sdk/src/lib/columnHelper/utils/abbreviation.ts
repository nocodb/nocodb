/**
 * Airtable-style abbreviation for large numbers (1.2K, 3.4M, 1.5B, 2T).
 * Display-only, enabled per column via `meta.abbreviate`.
 * Uses Intl compact notation so rounding, suffixes and locale are handled natively.
 */
export function abbreviateNumber(
  value: number,
  options?: { precision?: number; locale?: string }
): string {
  if (!isFinite(value)) return String(value);

  const precision = options?.precision ?? 1;

  return new Intl.NumberFormat(options?.locale || 'en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(Math.max(precision, 0), 4),
  }).format(value);
}

/** Whether abbreviation is enabled on a (parsed) column meta object. */
export function shouldAbbreviateNumber(
  meta: Record<string, any> | undefined | null
): boolean {
  return !!meta?.abbreviate;
}

/**
 * Build Intl.NumberFormat options for a currency column, honouring the
 * `abbreviate` meta flag. Abbreviated currency drops trailing zeros and caps
 * fraction digits so it reads as e.g. `$1.2K` instead of `$1,234.00`.
 */
export function getCurrencyFormatOptions(
  meta: Record<string, any> | undefined | null
): Intl.NumberFormatOptions {
  const precision = meta?.precision ?? 2;
  const abbreviate = shouldAbbreviateNumber(meta);

  return {
    style: 'currency',
    currency: meta?.currency_code || 'USD',
    notation: abbreviate ? 'compact' : 'standard',
    minimumFractionDigits: abbreviate ? 0 : precision,
    maximumFractionDigits: abbreviate ? Math.min(precision, 2) : precision,
  };
}
