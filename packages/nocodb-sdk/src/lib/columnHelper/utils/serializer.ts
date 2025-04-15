import dayjs from 'dayjs';
import { ColumnType, SelectOptionsType } from '~/lib/Api';
import { getDateFormat, getDateTimeFormat } from '~/lib/dateTimeHelper';
import { convertDurationToSeconds } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import {
  ncIsBoolean,
  ncIsFunction,
  ncIsNaN,
  ncIsNumber,
  ncIsString,
} from '~/lib/is';
import UITypes from '~/lib/UITypes';
import { SerializerOrParserFnProps } from '../column.interface';
import { SelectTypeConversionError } from '~/lib/error';

/**
 * Remove outer quotes & unescape
 */
export const serializeStringValue = (value: any) => {
  value = value?.toString() ?? null;

  if (!value) return null;

  if (value.match(/^"[\s\S]*"$/)) {
    value = value.slice(1, -1).replace(/\\"/g, '"');
  }

  return value;
};

export const serializeIntValue = (value: string | null | number) => {
  if (ncIsNumber(value)) {
    return parseInt(value.toString(), 10);
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = value.replace(/,/g, '').trim(); // Remove commas

    if (!cleanedValue) return null;

    // Try converting the cleaned value to a number
    const numberValue = Number(cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return parseInt(numberValue.toString(), 10);
    }
  }

  return null; // Return null if it's not a valid number
};

export const serializeDecimalValue = (
  value: string | null | number,
  callback?: (val: any) => any
) => {
  if (ncIsNumber(value)) {
    return Number(value);
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    const cleanedValue = ncIsFunction(callback)
      ? callback(value)
      : value.replace(/,/g, '').trim(); // Remove commas

    if (!cleanedValue) return null;

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

    if (!cleanedValue) return null;

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
  return serializeDecimalValue(value, (value) => {
    return value?.replace(/[^0-9.]/g, '')?.trim();
  });
};

export const serializeDateOrDateTimeValue = (
  value: string | null,
  col: ColumnType
) => {
  if (!value) return null;

  value = value?.toString().trim();

  let parsedDateOrDateTime = dayjs(value, getDateTimeFormat(value));

  if (!parsedDateOrDateTime.isValid()) {
    parsedDateOrDateTime = dayjs(value, getDateFormat(value));
  }

  if (!parsedDateOrDateTime.isValid()) {
    return null;
  }

  return col.uidt === UITypes.Date
    ? parsedDateOrDateTime.format('YYYY-MM-DD')
    : parsedDateOrDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ');
};

export const serializeTimeValue = (
  value: any,
  params: SerializerOrParserFnProps['params']
) => {
  value = value?.toString().trim();

  if (!value) return null;

  let parsedTime = dayjs(value);

  if (!parsedTime.isValid()) {
    parsedTime = dayjs(value, 'HH:mm:ss');
  }

  if (!parsedTime.isValid()) {
    parsedTime = dayjs(`1999-01-01 ${value}`);
  }

  if (!parsedTime.isValid()) {
    return null;
  }

  const dateFormat = params.isMysql?.(params.col.source_id)
    ? 'YYYY-MM-DD HH:mm:ss'
    : 'YYYY-MM-DD HH:mm:ssZ';

  return parsedTime.format(dateFormat);
};

export const serializeYearValue = (value: any) => {
  value = value?.toString().trim();

  if (!value) return null;

  const parsedDate = dayjs(value?.toString());

  return parsedDate.isValid() ? +parsedDate.format('YYYY') : null;
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

  let vals = value.split(',').map((val) => val.trim());
  const invalidVals = vals.filter((v) => !optionsSet.has(v));

  if (vals.length && col.uidt === UITypes.SingleSelect) {
    vals = [vals[0]];
  }

  // return null if no valid values
  if (invalidVals.length > 0) {
    throw new SelectTypeConversionError(vals, invalidVals);
  }

  return vals.join(',');
};

export const serializeEmail = (v: string) => {
  const matches = v.match(
    /(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})/i
  );
  return matches ? matches[0] : null;
};
