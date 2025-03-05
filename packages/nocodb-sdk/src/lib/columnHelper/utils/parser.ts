import { ColumnType } from '~/lib/Api';
import { convertMS2Duration } from '~/lib/durationUtils';
import { parseProp, roundUpToPrecision } from '~/lib/helperFunctions';
import { ncIsBoolean, ncIsNaN, ncIsString } from '~/lib/is';

export const parseIntValue = (
  value: string | null | number,
  col?: ColumnType
) => {
  if (ncIsNaN(value)) {
    return null;
  }

  value = parseInt(value.toString(), 10);

  const columnMeta = parseProp(col?.meta);

  if (columnMeta.isLocaleString) {
    return Number(value).toLocaleString();
  }

  return Number(value);
};

export const parseDecimalValue = (
  value: string | null | number,
  col: ColumnType
) => {
  if (ncIsNaN(value)) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  if (columnMeta.isLocaleString) {
    return Number(
      roundUpToPrecision(Number(value), columnMeta.precision ?? 1)
    ).toLocaleString(undefined, {
      minimumFractionDigits: columnMeta.precision ?? 1,
      maximumFractionDigits: columnMeta.precision ?? 1,
    });
  }

  return roundUpToPrecision(Number(value), columnMeta.precision ?? 1);
};

export const parsePercentValue = (value: string | null) => {
  if (ncIsNaN(value)) {
    return null;
  }

  return `${Number(value)}%`;
};

export const parseDurationValue = (value: string | null, col: ColumnType) => {
  const durationType = parseProp(col.meta)?.duration || 0;
  return convertMS2Duration(value, durationType);
};

export const parseCheckboxValue = (
  value: boolean | string | number | '0' | '1'
) => {
  if (ncIsBoolean(value)) return value;

  if (ncIsString(value)) {
    const strval = value.trim().toLowerCase();
    if (strval === 'true' || strval === '1') return true;
    if (strval === 'false' || strval === '0' || strval === '') return false;
  }

  return null;
};

export const parseJsonValue = (value) => {
  try {
    return ncIsString(value)
      ? JSON.stringify(JSON.parse(value)) // Ensure it's a valid JSON string
      : JSON.stringify(value); // Convert object/array to JSON
  } catch {
    return null;
  }
};

export const parseCurrencyValue = (value: any, col: ColumnType) => {
  if (ncIsNaN(value)) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  return new Intl.NumberFormat(columnMeta.currency_locale || 'en-US', {
    style: 'currency',
    currency: columnMeta.currency_code || 'USD',
  }).format(+value);
};
