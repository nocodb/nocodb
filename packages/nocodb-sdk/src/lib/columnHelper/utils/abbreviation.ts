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
    unit = AUTO_UNIT_ORDER.find((u) => Math.abs(value) >= u.divisor);
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
  meta: Record<string, any> | undefined | null
): string {
  const precision = meta?.precision ?? 2;
  const locale = meta?.currency_locale || 'en-US';
  const type = resolveNumberAbbreviation(meta);

  const currencyOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: meta?.currency_code || 'USD',
  };

  if (type === NumberAbbreviationType.None) {
    return new Intl.NumberFormat(locale, {
      ...currencyOptions,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  }

  const fractionOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(precision, 2),
  };

  const unit = ABBREVIATION_UNITS[type];

  if (!unit) {
    return new Intl.NumberFormat(locale, {
      ...currencyOptions,
      ...fractionOptions,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  }

  return `${new Intl.NumberFormat(locale, {
    ...currencyOptions,
    ...fractionOptions,
  }).format(value / unit.divisor)}${unit.suffix}`;
}
