import dayjs from 'dayjs';
import { ColumnType } from '~/lib/Api';
import { isDateMonthFormat } from '~/lib/dateTimeHelper';
import { convertDurationToSeconds } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsBoolean, ncIsNaN, ncIsNumber, ncIsString } from '~/lib/is';

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

export const serializeDateValue = (value: string | null, col: ColumnType) => {
  const dateFormat = parseProp(col.meta)?.date_format;

  if (dateFormat && isDateMonthFormat(dateFormat)) {
    // any date month format (e.g. YYYY-MM) couldn't be stored in database
    // with date type since it is not a valid date
    // therefore, we reformat the value here to display with the formatted one
    // e.g. 2023-06-03 -> 2023-06
    value = dayjs(value, dateFormat).format(dateFormat);
  } else {
    // e.g. 2023-06-03 (in DB) -> 03/06/2023 (in UI)
    value = dayjs(value, 'YYYY-MM-DD').format(dateFormat);
  }

  return value;
};

export const serializeYearValue = (value: any) => {
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
