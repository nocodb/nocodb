import { ncIsNumber } from './is';

/**
 * Resolve the display symbol for a currency from its ISO code + locale.
 *
 * The symbol is a locale-dependent projection of `(currency_code,
 * currency_locale)` — the same pair the cell renderer feeds to
 * `Intl.NumberFormat` (see `parseCurrencyValue`). It is derived, never stored,
 * so consumers that only receive the code/locale (e.g. the v3 field schema, the
 * MCP connector) can surface a symbol without re-implementing the lookup.
 *
 * Falls back to the code itself when the environment lacks `formatToParts` or
 * the code/locale is invalid.
 */
export const getCurrencySymbol = (
  currencyCode = 'USD',
  currencyLocale = 'en-US'
): string => {
  try {
    const formatter = new Intl.NumberFormat(currencyLocale || 'en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
    });
    if (!(formatter as any).formatToParts) return currencyCode || 'USD';
    const parts = (formatter as any).formatToParts(0) as Array<{
      type: string;
      value: string;
    }>;
    return (
      parts.find((p) => p.type === 'currency')?.value || currencyCode || 'USD'
    );
  } catch {
    return currencyCode || 'USD';
  }
};

/**
 * A rendered example of a currency value — mirrors `parseCurrencyValue` exactly
 * (same `Intl.NumberFormat` options and precision handling) so the example a
 * schema consumer sees matches what the app displays. Useful as an unambiguous
 * formatting template for MCP/AI clients.
 */
export const getCurrencyFormatExample = (
  currencyCode = 'USD',
  currencyLocale = 'en-US',
  precision = 2,
  sampleValue = 1234.56
): string => {
  try {
    return new Intl.NumberFormat(currencyLocale || 'en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: precision ?? 2,
      maximumFractionDigits: precision ?? 2,
    }).format(sampleValue);
  } catch {
    return `${getCurrencySymbol(currencyCode, currencyLocale)}${sampleValue}`;
  }
};

export const getGroupDecimalSymbolFromLocale = (locale?: string) => {
  let group = ',';
  let decimal = '.';
  if (!locale) {
    return {
      group,
      decimal,
    };
  }

  const formatter = new Intl.NumberFormat(locale || 'en-US');
  if (!(formatter as any).formatToParts) {
    return {
      group,
      decimal,
    };
  }
  // Use formatToParts to extract the characters used for grouping (thousands) and decimal
  const parts = (formatter as any).formatToParts(12345.6) as Array<{
    type: string;
    value: string;
  }>;

  // Extract group separator (e.g., '.' in 'de-DE', ',' in 'en-US')
  group = parts.find((p) => p.type === 'group')?.value || group;

  // Extract decimal separator (e.g., ',' in 'de-DE', '.' in 'en-US')
  decimal = parts.find((p) => p.type === 'decimal')?.value || decimal;

  return {
    group,
    decimal,
  };
};

const currencySeparators = (currencyCode = 'USD', currencyLocale = 'en-US') => {
  try {
    const formatter = new Intl.NumberFormat(currencyLocale || 'en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
    });
    if (!(formatter as any).formatToParts) return { group: ',', decimal: '.' };
    const parts = (formatter as any).formatToParts(12345.5) as Array<{
      type: string;
      value: string;
    }>;
    return {
      group: parts.find((p) => p.type === 'group')?.value ?? '',
      decimal: parts.find((p) => p.type === 'decimal')?.value || '.',
    };
  } catch {
    return { group: ',', decimal: '.' };
  }
};

/**
 * The decimal separator a currency column actually renders with. Distinct from
 * `getGroupDecimalSymbolFromLocale`, which reads the plain number format — the
 * two disagree in several locales (fr-CH, en-FI, en-SE, en-BE).
 */
export const getCurrencyDecimalSymbol = (
  currencyCode = 'USD',
  currencyLocale = 'en-US'
): string => currencySeparators(currencyCode, currencyLocale).decimal;

/**
 * The group separator a currency column renders with, `''` when it has none.
 * Like the decimal, it can differ from the plain number format (de-AT groups
 * currency with '.' and plain numbers with a space).
 */
export const getCurrencyGroupSymbol = (
  currencyCode = 'USD',
  currencyLocale = 'en-US'
): string => currencySeparators(currencyCode, currencyLocale).group;

/**
 * Normalize a locale-formatted number into a dot-decimal string.
 *
 * Reads the string's own shape first and falls back to the locale only for the
 * genuinely ambiguous case, because pasted values routinely follow a different
 * convention than the column's locale.
 *
 * - Both `.` and `,` present: the later one separates the fraction and the other
 *   groups, whatever the locale says. `1.234.567,89` and `1,234,567.89` both
 *   read as 1234567.89.
 * - One of them, repeated: grouping (`1.234.567`).
 * - One of them, once, with three digits behind it and one to three digits
 *   (no leading zero) in front: ambiguous, so the locale decides. It is grouping
 *   only when it is the locale's group character — `1.234` is 1.234 in en-US
 *   and 1234 in de-DE, while `3116.500` or `0.500` can never be grouping.
 * - One of them, once, otherwise: a decimal point. `1234.56` in de-DE is
 *   1234.56, not the 123456 that deleting the character produced.
 *
 * Any other character is noise, so whitespace and apostrophe group separators
 * (U+202F in fr-*, U+00A0 in ru-RU, `'` in de-CH) drop out on their own.
 *
 * `decimalSeparator` must come from the same formatter that rendered the value.
 * A locale's plain and currency formats can disagree — fr-CH, en-FI, en-SE and
 * en-BE render plain numbers with `,` but currency with `.` — so deriving it
 * from the plain format misreads "3 116.500" at precision 3.
 *
 * Leaves `-` in place for the caller's sign pass.
 */
export const normalizeLocaleNumericString = (
  value: string,
  decimalSeparator = '.',
  groupSeparator?: string
): string => {
  const decimal = decimalSeparator;

  // Reduce to digits, the two candidate separators and the sign.
  const compact = value.replace(/[^\d.,-]/g, '');

  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');

  let decimalChar: string | null = null;

  if (lastDot !== -1 && lastComma !== -1) {
    decimalChar = lastDot > lastComma ? '.' : ',';
  } else if (lastDot !== -1 || lastComma !== -1) {
    const only = lastDot !== -1 ? '.' : ',';
    const at = lastDot !== -1 ? lastDot : lastComma;
    const repeated = compact.split(only).length > 2;
    const digitsBehind = (compact.slice(at + 1).match(/\d/g) || []).length;

    if (!repeated) {
      const lead = compact.slice(0, at).replace(/-/g, '');
      const couldGroup = digitsBehind === 3 && /^[1-9]\d{0,2}$/.test(lead);
      const isGroup =
        groupSeparator !== undefined
          ? only === groupSeparator
          : only !== decimal;

      decimalChar = couldGroup && isGroup ? null : only;
    }
  }

  if (!decimalChar) return compact.replace(/[.,]/g, '');

  // The decimal is by definition the last separator; everything before groups.
  const at = compact.lastIndexOf(decimalChar);

  return `${compact.slice(0, at).replace(/[.,]/g, '')}.${compact
    .slice(at + 1)
    .replace(/[.,-]/g, '')}`;
};

export const getNumericValue = (value: string, locale?: string) => {
  // accept valid decimal string as well, like '9.123', '9.1234', '9.123456789'
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return {
      value: value,
      pointDecimalValue: value,
      numericValue: parseFloat(value),
      isValid: true,
    };
  }

  const { group, decimal } = getGroupDecimalSymbolFromLocale(locale);
  const [integerString, decimalString] = value.split(decimal);

  // check if there's group after decimal symbol
  if (
    decimalString &&
    decimalString.length > 0 &&
    decimalString.indexOf(group) >= 0
  ) {
    return {
      value: value,
      pointDecimalValue: undefined,
      numericValue: undefined,
      isValid: false,
    };
  }
  const integerParts = integerString.split(group);
  // check if there's group that doesn't have 3 digit
  if (integerParts.slice(1).some((p) => p.length !== 3)) {
    return {
      value: value,
      pointDecimalValue: undefined,
      numericValue: undefined,
      isValid: false,
    };
  }

  const valueToParse = value
    .replace(new RegExp(`\\${group}`, 'g'), '')
    .replace(new RegExp(`\\${decimal}`, 'g'), '.')
    .replace(/[^\d.-]/g, '') // 3. Remove any non-digit, non-dot, non-minus characters (e.g., currency symbols, spaces)
    .trim();
  const numericValue = parseFloat(valueToParse);
  const isValid = ncIsNumber(numericValue);
  return {
    value: value,
    pointDecimalValue: isValid ? valueToParse : undefined,
    numericValue: isValid ? numericValue : undefined,
    isValid,
  };
};
