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
