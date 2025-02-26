import dayjs from 'dayjs';
import { ColumnType, SelectOptionsType } from '~/lib/Api';
import { getDateFormat, getDateTimeFormat } from '~/lib/dateTimeHelper';
import { convertDurationToSeconds } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsBoolean, ncIsNaN, ncIsNumber, ncIsString } from '~/lib/is';
import UITypes from '~/lib/UITypes';

export const serializeIntValue = (value: string | null | number) => {
  if (ncIsNumber(value)) {
    return parseInt(value.toString(), 10);
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = value.replace(/,/g, '').trim(); // Remove commas

    // Try converting the cleaned value to a number
    const numberValue = Number(cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return parseInt(numberValue.toString(), 10);
    }
  }

  return null; // Return null if it's not a valid number
};

export const serializeDecimalValue = (value: string | null | number) => {
  if (ncIsNumber(value)) {
    return Number(value);
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = value.replace(/,/g, '').trim(); // Remove commas

    // Try converting the cleaned value to a number
    const numberValue = Number(cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return numberValue;
    }
  }

  return null;
};

export const serializePercentValue = (value: string | null) => {
  if (ncIsNumber(value)) {
    return value;
  }
  // If it's a string, remove % and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = value.replace('%', ''); // Remove %

    // Try converting the cleaned value to a number
    const numberValue = Number(cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return numberValue;
    }
  }

  return null;
};

export const serializeDurationValue = (
  value: string | null,
  col: ColumnType
) => {
  // Check if the value is a pure number (interpreted as seconds)
  if (!ncIsNaN(value)) {
    return parseInt(value, 10); // Directly return seconds
  }

  const columnMeta = parseProp(col.meta);

  const res = convertDurationToSeconds(value, columnMeta.duration ?? 0);

  return res._isValid ? res._sec : null;
};

export const serializeCheckboxValue = (
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

export const serializeJsonValue = (value: any) => {
  try {
    return ncIsString(value)
      ? JSON.stringify(JSON.parse(value)) // Ensure it's a valid JSON string
      : JSON.stringify(value); // Convert object/array to JSON
  } catch {
    return null;
  }
};

export const serializeCurrencyValue = (value: any) => {
  if (ncIsNaN(value)) {
    return null;
  }

  return serializeDecimalValue(value);
};

export const serializeDateOrDateTimeValue = (
  value: string | null,
  col: ColumnType
) => {
  value = value?.toString().trim();

  let parsedDateOrDateTime = dayjs(value, getDateTimeFormat(value));

  if (!parsedDateOrDateTime.isValid()) {
    parsedDateOrDateTime = dayjs(value, getDateFormat(value));
  }

  return col.uidt === UITypes.Date
    ? parsedDateOrDateTime.format('YYYY-MM-DD')
    : parsedDateOrDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ');
};

export const serializeYearValue = (value: any) => {
  value = value?.toString().trim();

  if (!value) return null;

  const parsedDate = dayjs(value?.toString());

  return parsedDate.isValid() ? +parsedDate.format('YYYY') : null;
};

export const serialiseUserValue = (_value: any) => {
  // let data = value;
  // try {
  //   if (typeof value === 'string') {
  //     data = JSON.parse(value);
  //   }
  // } catch {}
};

export const serializeSelectValue = (value: any, col: ColumnType) => {
  value = value?.toString().trim();

  // return null if value is empty
  if (!value) return null;

  // Todo: discuss new value creation
  const availableOptions = (
    (col.colOptions as SelectOptionsType)?.options || []
  ).map((o) => o.title);

  const optionsSet = new Set(availableOptions);

  const vals = value.split(',');
  const invalidVals = vals.filter((v) => !optionsSet.has(v));

  // return null if no valid values
  if (invalidVals.length > 0) {
    return null;
    // throw new SelectTypeConversionError(vals, invalidVals);
  }

  return vals.join(',');
};
