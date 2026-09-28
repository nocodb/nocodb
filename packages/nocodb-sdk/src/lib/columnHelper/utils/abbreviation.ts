import { SeparatorType } from './common';
import {
  formatNumberWithSeparator,
  getSeparatorChars,
  resolveColumnSeparator,
} from './separator';

/**
 * Airtable-style abbreviation for large numbers (1.2K, 3.4M, 1.5B, 2T).
 * Display-only, configured per column via `meta.abbreviate` — either 'auto'
 * (unit picked by magnitude) or a fixed unit (always that suffix).
 */
export enum NumberAbbreviationType {
  None = 'none',
  Auto = 'auto',
  Thousand = 'thousand',
  Million = 'million',
  Billion = 'billion',
  Trillion = 'trillion',
}

interface AbbreviationUnit {
  divisor: number;
  suffix: string;
}

const UNIT_THOUSAND: AbbreviationUnit = { divisor: 1e3, suffix: 'K' };
const UNIT_MILLION: AbbreviationUnit = { divisor: 1e6, suffix: 'M' };
const UNIT_BILLION: AbbreviationUnit = { divisor: 1e9, suffix: 'B' };
const UNIT_TRILLION: AbbreviationUnit = { divisor: 1e12, suffix: 'T' };

const ABBREVIATION_UNITS: Partial<
  Record<NumberAbbreviationType, AbbreviationUnit>
> = {
  [NumberAbbreviationType.Thousand]: UNIT_THOUSAND,
  [NumberAbbreviationType.Million]: UNIT_MILLION,
  [NumberAbbreviationType.Billion]: UNIT_BILLION,
  [NumberAbbreviationType.Trillion]: UNIT_TRILLION,
};

const AUTO_UNIT_ORDER: AbbreviationUnit[] = [
  UNIT_TRILLION,
  UNIT_BILLION,
  UNIT_MILLION,
  UNIT_THOUSAND,
];

const INPUT_UNIT_MULTIPLIERS: Record<string, number> = {
  K: UNIT_THOUSAND.divisor,
  M: UNIT_MILLION.divisor,
  B: UNIT_BILLION.divisor,
  T: UNIT_TRILLION.divisor,
};

/**
 * Split abbreviated input ("1.2M") into the text minus its unit and the magnitude
 * that unit names, leaving the caller's own separator/locale parsing to read the number.
 */
export function extractNumberAbbreviation(value: string): {
  text: string;
  multiplier: number;
} {
  // the unit must follow a digit and be the only letter there, so a unit-suffixed
  // amount ("1 234 Ft", "1.5 BTC", "1.2Mio") is left alone
  const match = /(\d)\s*([KMBT])(?![A-Za-z0-9])/.exec(value);

  if (!match) return { text: value, multiplier: 1 };

  return {
    text:
      value.slice(0, match.index + 1) +
      value.slice(match.index + match[0].length),
    multiplier: INPUT_UNIT_MULTIPLIERS[match[2]],
  };
}

/** Scale a parsed number by an extracted multiplier — 8580.69 * 1e6 otherwise lands on ...0000.000001. */
export function applyNumberAbbreviation(
  value: number,
  multiplier: number
): number {
  if (multiplier === 1) return value;

  return Number((value * multiplier).toPrecision(15));
}

/** Normalize `meta.abbreviate` — legacy boolean `true` maps to Auto. */
export function resolveNumberAbbreviation(
  meta: Record<string, any> | undefined | null
): NumberAbbreviationType {
  const value = meta?.abbreviate;

  if (value === true) return NumberAbbreviationType.Auto;

  if (
    typeof value === 'string' &&
    (Object.values(NumberAbbreviationType) as string[]).includes(value)
  ) {
    return value as NumberAbbreviationType;
  }

  return NumberAbbreviationType.None;
}

/** Whether abbreviation is enabled on a (parsed) column meta object. */
export function shouldAbbreviateNumber(
  meta: Record<string, any> | undefined | null
): boolean {
  return resolveNumberAbbreviation(meta) !== NumberAbbreviationType.None;
}

/**
 * Auto mode: pick the unit by magnitude, then re-check after rounding so a
 * boundary value promotes (999999 @ precision 1 → 1M, not 1000K).
 */
function pickAutoUnit(
  value: number,
  precision: number
): AbbreviationUnit | undefined {
  const index = AUTO_UNIT_ORDER.findIndex((u) => Math.abs(value) >= u.divisor);
  const unit = index === -1 ? undefined : AUTO_UNIT_ORDER[index];

  const rounded = Number(
    (unit ? value / unit.divisor : value).toFixed(precision)
  );
  if (Math.abs(rounded) < 1000) return unit;

  if (!unit) return UNIT_THOUSAND;
  return AUTO_UNIT_ORDER[index - 1] ?? unit;
}

/**
 * Abbreviate a number per the column meta's `abbreviate` mode, honouring the
 * column's thousands/decimal separator config for the scaled value
 * (e.g. Period-and-comma + Thousand → `1.234,6K`). Trailing zeros are dropped.
 */
export function abbreviateNumber(
  value: number,
  meta?: Record<string, any> | null,
  options?: { precision?: number; locale?: string }
): string {
  if (!isFinite(value)) return String(value);

  const precision = Math.min(Math.max(options?.precision ?? 1, 0), 4);
  const type = resolveNumberAbbreviation(meta);

  let unit = ABBREVIATION_UNITS[type];
  if (!unit && type === NumberAbbreviationType.Auto) {
    unit = pickAutoUnit(value, precision);
  }

  const scaled = unit ? value / unit.divisor : value;
  // Number() strips trailing zeros: 1.50 -> 1.5
  const rounded = Number(scaled.toFixed(precision));

  const separator = resolveColumnSeparator(meta ?? {});

  let formatted: string;
  if (separator === SeparatorType.Locale) {
    formatted = rounded.toLocaleString(options?.locale || undefined, {
      maximumFractionDigits: precision,
    });
  } else {
    const { thousandSeparator, decimalSeparator } = getSeparatorChars(
      separator,
      options?.locale
    );
    formatted = formatNumberWithSeparator(
      rounded,
      thousandSeparator,
      decimalSeparator
    );
  }

  return `${formatted}${unit?.suffix ?? ''}`;
}

/**
 * Format a currency value honouring the `abbreviate` meta. Abbreviated
 * currency drops trailing zeros and caps fraction digits so it reads as
 * e.g. `$1.2K` instead of `$1,234.00`.
 */
export function formatCurrencyValue(
  value: number,
  meta: Record<string, any> | undefined | null,
  options?: { skipAbbreviation?: boolean }
): string {
  const precision = meta?.precision ?? 2;
  const locale = meta?.currency_locale || 'en-US';
  const type = options?.skipAbbreviation
    ? NumberAbbreviationType.None
    : resolveNumberAbbreviation(meta);

  const currencyOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: meta?.currency_code || 'USD',
  };

  // non-finite can't be scaled — fall back to the plain currency format
  if (type === NumberAbbreviationType.None || !isFinite(value)) {
    return new Intl.NumberFormat(locale, {
      ...currencyOptions,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  }

  const fractionDigits = Math.min(precision, 2);

  // Auto uses the same K/M/B/T ladder as plain numbers — not Intl compact
  // notation, whose units vary by locale and contradict the dropdown label.
  const unit = ABBREVIATION_UNITS[type] ?? pickAutoUnit(value, fractionDigits);

  const parts = new Intl.NumberFormat(locale, {
    ...currencyOptions,
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).formatToParts(unit ? value / unit.divisor : value);

  if (!unit) return parts.map((p) => p.value).join('');

  // Attach the suffix to the numeric portion so postfix-symbol locales render
  // `1,23M €`, not `1,23 €M`.
  const numericTypes = ['integer', 'group', 'decimal', 'fraction'];
  let lastNumeric = -1;
  for (let i = 0; i < parts.length; i++) {
    if (numericTypes.includes(parts[i].type)) lastNumeric = i;
  }

  if (lastNumeric === -1) {
    return parts.map((p) => p.value).join('') + unit.suffix;
  }

  return parts
    .map((part, i) =>
      i === lastNumeric ? part.value + unit.suffix : part.value
    )
    .join('');
}
