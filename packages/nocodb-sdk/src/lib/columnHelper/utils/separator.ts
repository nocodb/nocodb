import { parseProp } from '~/lib/helperFunctions';
import { SeparatorType } from './common';

/**
 * Resolve the effective separator from column meta.
 * Handles backward compat: reads isLocaleString when separator is absent.
 */
export function resolveColumnSeparator(
  meta: Record<string, any> | string | undefined
): SeparatorType {
  const parsed = typeof meta === 'string' ? parseProp(meta) : meta ?? {};
  if (
    parsed.separator &&
    Object.values(SeparatorType).includes(parsed.separator)
  ) {
    return parsed.separator;
  }
  return parsed.isLocaleString
    ? SeparatorType.CommaPeriod
    : SeparatorType.NonePeriod;
}

/**
 * Get the actual thousand/decimal separator characters for a SeparatorType.
 * For Locale, uses Intl.NumberFormat to detect from runtime environment.
 */
export function getSeparatorChars(separator: SeparatorType): {
  thousandSeparator: string | null;
  decimalSeparator: string;
} {
  switch (separator) {
    case SeparatorType.Locale: {
      const formatter = new Intl.NumberFormat();
      const parts = formatter.formatToParts(12345.6);
      const group =
        parts.find((p) => p.type === 'group')?.value || null;
      const decimal =
        parts.find((p) => p.type === 'decimal')?.value || '.';
      return { thousandSeparator: group, decimalSeparator: decimal };
    }
    case SeparatorType.NonePeriod:
      return { thousandSeparator: null, decimalSeparator: '.' };
    case SeparatorType.NoneComma:
      return { thousandSeparator: null, decimalSeparator: ',' };
    case SeparatorType.CommaPeriod:
      return { thousandSeparator: ',', decimalSeparator: '.' };
    case SeparatorType.PeriodComma:
      return { thousandSeparator: '.', decimalSeparator: ',' };
    case SeparatorType.SpacePeriod:
      return { thousandSeparator: '\u00A0', decimalSeparator: '.' };
    case SeparatorType.SpaceComma:
      return { thousandSeparator: '\u00A0', decimalSeparator: ',' };
    default:
      return { thousandSeparator: null, decimalSeparator: '.' };
  }
}

/**
 * Format a numeric value using the given separator characters.
 * @param value - The raw numeric value
 * @param thousandSeparator - Character for thousands grouping (null = no grouping)
 * @param decimalSeparator - Character for decimal point
 * @param precision - Number of decimal places (undefined = no rounding for integers)
 */
export function formatNumberWithSeparator(
  value: number,
  thousandSeparator: string | null,
  decimalSeparator: string,
  precision?: number
): string {
  // Round to precision if specified
  let numStr: string;
  if (precision !== undefined && precision !== null) {
    numStr = value.toFixed(precision);
  } else {
    numStr = String(value);
  }

  const isNegative = numStr.startsWith('-');
  if (isNegative) {
    numStr = numStr.slice(1);
  }

  const [intPart, decPart] = numStr.split('.');

  // Add thousand separators
  let formattedInt = intPart;
  if (thousandSeparator) {
    formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  }

  let result = formattedInt;
  if (decPart !== undefined) {
    result += decimalSeparator + decPart;
  }

  return isNegative ? '-' + result : result;
}
