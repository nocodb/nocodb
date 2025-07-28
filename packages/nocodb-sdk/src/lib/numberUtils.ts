import type { ColumnType } from '~/lib/Api';
import { parseProp, roundUpToPrecision } from '~/lib/helperFunctions';

export const numberize = (value?: string | number) => {
  if (value === undefined || value === null) {
    return value as undefined;
  }
  if (typeof value === 'number') {
    return value as number;
  } else {
    const result = parseInt(value);
    if (isNaN(result)) {
      return undefined;
    }
    return result;
  }
};

export const roundTo = (num: unknown, precision = 1) => {
  if (!num || Number.isNaN(num)) return num;
  const factor = 10 ** precision;
  return Math.round(+num * factor) / factor;
};

export const getCurrencyValue = (
  modelValue: string | number | null | undefined,
  col: ColumnType
): string => {
  const currencyMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
    precision: 2,
    ...parseProp(col.meta),
  };
  try {
    if (
      modelValue === null ||
      modelValue === undefined ||
      Number.isNaN(modelValue)
    ) {
      return modelValue === null || modelValue === undefined
        ? ''
        : (modelValue as string);
    }

    const roundedValue = roundUpToPrecision(
      Number(modelValue),
      currencyMeta.precision ?? 2
    );

    return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.currency_code || 'USD',
      minimumFractionDigits: currencyMeta.precision ?? 2,
      maximumFractionDigits: currencyMeta.precision ?? 2,
    }).format(+roundedValue);
  } catch (e) {
    return modelValue as string;
  }
};
