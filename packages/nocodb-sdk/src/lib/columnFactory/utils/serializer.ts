import { ColumnType } from '~/lib/Api';
import { convertMS2Duration } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsNaN, ncIsNumber, ncIsString } from '~/lib/is';

export const serializeIntValue = (value: string | null | number) => {
  if (ncIsNumber(value)) {
    return value;
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = value.replace(/,/g, ''); // Remove commas

    // Try converting the cleaned value to a number
    const numberValue = Number(cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return numberValue;
    }
  }

  return null; // Return null if it's not a valid number
};

export const serializeDecimalValue = (
  value: null | number,
  col: ColumnType
) => {
  if (ncIsNaN(value)) {
    return null;
  }

  const columnMeta = parseProp(col.meta);

  return Number(value).toFixed(columnMeta?.precision ?? 1);
};

export const serializePercentValue = (value: string | null) => {
  if (!value || isNaN(Number(value))) {
    return null;
  }

  return `${value}%`;
};

export const serializeDurationValue = (
  value: string | null,
  col: ColumnType
) => {
  const columnMeta = parseProp(col.meta);

  if (columnMeta.duration === undefined) {
    return value;
  }

  return convertMS2Duration(value, columnMeta.duration);
};
