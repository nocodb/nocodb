import dayjs from 'dayjs';
import { ColumnType, SelectOptionsType } from '~/lib/Api';
import { convertDurationToSeconds } from '~/lib/durationUtils';
import { parseProp } from '~/lib/helperFunctions';
import {
  ncIsBoolean,
  ncIsFunction,
  ncIsNaN,
  ncIsNull,
  ncIsNumber,
  ncIsString,
  ncIsUndefined,
} from '~/lib/is';
import UITypes from '~/lib/UITypes';
import { SerializerOrParserFnProps } from '../column.interface';
import { SelectTypeConversionError } from '~/lib/error';
import { checkboxTypeMap } from '~/lib/columnHelper/utils/common';
import { getGroupDecimalSymbolFromLocale } from '~/lib/currencyHelpers';
import { getSeparatorChars, resolveColumnSeparator } from './separator';

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

export const serializeDecimalValue = (
  value: string | null | number,
  callback?: (val: any) => any,
  params?: SerializerOrParserFnProps['params']
) => {
  // If we have clipboard data with a raw numeric value, use it directly
  // regardless of separator differences — the dbCellValue is the canonical
  // number and doesn't need re-interpretation.
  if (
    params?.clipboardItem?.dbCellValue !== undefined &&
    params?.clipboardItem?.dbCellValue !== null &&
    ncIsNumber(params.clipboardItem.dbCellValue)
  ) {
    return params.clipboardItem.dbCellValue;
  }

  if (ncIsNumber(value)) {
    return Number(value);
  }

  // If it's a string, remove commas and check if it's a valid number
  if (ncIsString(value)) {
    // For LTAR multi-field search: only accept pure numbers, don't strip non-numeric chars
    // e.g., "station 1" should NOT be converted to 1
    if (params?.serializeLinkRecordSearchQuery) {
      return ncIsNaN(value) ? null : Number(value);
    }

    // Intl.NumberFormat renders negatives with U+2212 MINUS SIGN in 36 locales
    // (sv, fi, nb, nn, hr, et, sl, lt, eu, fo, gsw, se, ksh), so copying one of
    // our own cells and pasting it back dropped the sign. Normalize to ASCII '-'
    // before the strips below, which treat U+2212 as noise.
    value = value.replace(/\u2212/g, '-');

    let cleanedValue: string;
    if (ncIsFunction(callback)) {
      cleanedValue = callback(value);
    } else if (params?.col) {
      const separator = resolveColumnSeparator(parseProp(params.col.meta));
      const { thousandSeparator, decimalSeparator } =
        getSeparatorChars(separator);

      cleanedValue = value;
      // Remove thousand separators
      if (thousandSeparator) {
        cleanedValue = cleanedValue.replace(
          new RegExp('\\' + thousandSeparator, 'g'),
          ''
        );
      }
      // Truncate at the second occurrence of the decimal separator
      const firstIdx = cleanedValue.indexOf(decimalSeparator);
      if (firstIdx !== -1) {
        const secondIdx = cleanedValue.indexOf(decimalSeparator, firstIdx + 1);
        if (secondIdx !== -1) {
          cleanedValue = cleanedValue.substring(0, secondIdx);
        }
      }
      // Remove anything that's not a digit, the decimal separator, or a minus
      cleanedValue = cleanedValue.replace(
        new RegExp(`[^\\d\\${decimalSeparator}-]`, 'g'),
        ''
      );
      // Replace decimal separator with dot
      if (decimalSeparator !== '.') {
        cleanedValue = cleanedValue.replace(
          new RegExp('\\' + decimalSeparator),
          '.'
        );
      }
      // Remove duplicate dots — keep only the first one
      const dotIdx = cleanedValue.indexOf('.');
      if (dotIdx !== -1) {
        cleanedValue =
          cleanedValue.substring(0, dotIdx + 1) +
          cleanedValue.substring(dotIdx + 1).replace(/\./g, '');
      }
    } else {
      cleanedValue = value.replace(/[^\d.-]/g, '');
    }

    // Phase two — the strips above keep every '-', so the sign is resolved here,
    // the same way extractDecimalFromString does it for the cell editor: a minus
    // ahead of the digits is the sign ("-$1", "$-1"); any later one is noise
    // ("100-50" -> 10050).
    const isNegative = cleanedValue.startsWith('-');
    cleanedValue = cleanedValue.replace(/-/g, '');

    if (!cleanedValue) return null;

    // Try converting the cleaned value to a number
    const numberValue = Number(isNegative ? `-${cleanedValue}` : cleanedValue);

    // If it's a valid number, return it
    if (!isNaN(numberValue)) {
      return numberValue;
    }
  }

  return null;
};

export const serializeIntValue = (
  value: string | null | number,
  params?: SerializerOrParserFnProps['params']
) => {
  value = serializeDecimalValue(value, undefined, params);

  if (ncIsNumber(value)) {
    return parseInt(value.toString(), 10);
  }

  return null; // Return null if it's not a valid number
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
    const parsedValue = checkboxTypeMap[strval];
    if (!ncIsNull(parsedValue) && !ncIsUndefined(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
};

/**
 * Coerce a raw imported cell value (a CSV string or pasted text) into the value
 * the destination column expects before it is written to the DB.
 *
 * Single source of truth shared by the server-side file-import job
 * (`DataImportProcessor`) and the client-side CSV-upload extension, so both
 * import paths produce identical rows. Previously these were two hand-synced
 * `switch` statements that drifted (the client copy was missing `Duration` and
 * used a different checkbox parser) — change coercion behaviour here only.
 *
 * Link/LTAR columns are intentionally NOT handled here: importers resolve those
 * by display value in a separate link phase.
 */
export const serializeImportValue = (raw: any, col: ColumnType) => {
  const value = raw === '' || raw === undefined || raw === null ? null : raw;

  switch (col?.uidt as UITypes) {
    case UITypes.Checkbox:
      return serializeCheckboxValue(value);
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      return (value ?? '').toString().trim() || null;
    case UITypes.Decimal:
    case UITypes.Percent:
      return serializeDecimalValue(value, undefined, { col });
    case UITypes.Number:
    case UITypes.Rating:
      return serializeIntValue(value, { col });
    case UITypes.Duration:
      return value === null
        ? null
        : serializeDurationValue(value as string, col);
    default:
      return value;
  }
};

/**
 * Convert an Excel date *serial* into the string a date column expects.
 *
 * Excel stores dates as numbers — days since 1899-12-30 (the epoch includes the
 * historical 1900 leap-year bug). When a spreadsheet cell holding a date is NOT
 * formatted as a date (General / numeric format), the xlsx parser hands us the
 * raw serial instead of a `Date`. Forwarding that integer to a typed date
 * column then fails at the DB (`column ... is of type date but expression is of
 * type integer`).
 *
 * This is Excel-specific and intentionally NOT wired into `serializeImportValue`
 * (which stays format-agnostic and is shared with the CSV-upload extension). It
 * is invoked only from the Excel import path — see `DataImportProcessor`. Only a
 * numeric `value` is treated as a serial; anything else (a Date, an already-
 * formatted date string) is returned untouched for the normal path to handle.
 *
 * The importer bulk-inserts with `raw: true`, so `_convertDateFormat` is skipped
 * — the returned string must already be DB-ready:
 *   - `Date`     → `YYYY-MM-DD`
 *   - `DateTime` → `YYYY-MM-DD HH:mm:ssZ` (UTC; Excel serials carry no timezone)
 */
export const serializeExcelDateValue = (value: any, col: ColumnType) => {
  if (value === null || value === undefined || value === '') return null;

  // Only numeric Excel serials need conversion; leave everything else alone.
  if (!ncIsNumber(value)) return value;

  // 25569 = the serial of 1970-01-01 in the Excel 1900 date system.
  const ms = Math.round((value - 25569) * 86400000);
  const date = new Date(ms);
  if (ncIsNaN(date.getTime())) return null;

  const iso = date.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ (UTC)

  return (col?.uidt as UITypes) === UITypes.DateTime
    ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00:00`
    : iso.slice(0, 10);
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

export const serializeCurrencyValue = (
  value: any,
  params: SerializerOrParserFnProps['params']
) => {
  // If we have clipboard data, use it
  if (
    params?.clipboardItem?.dbCellValue !== undefined &&
    params?.clipboardItem?.dbCellValue !== null &&
    ncIsNumber(params.clipboardItem.dbCellValue)
  ) {
    return params.clipboardItem.dbCellValue;
  }

  return serializeDecimalValue(
    value,
    (value) => {
      const columnMeta = parseProp(params.col.meta);
      // Create a number formatter for the target locale (e.g., 'de-DE', 'en-US')
      const formatter = new Intl.NumberFormat(
        columnMeta?.currency_locale || 'en-US'
      );

      // If the locale is not set or is 'en-US', or the formatter does not support formatToParts, use the default behavior
      if (
        !columnMeta?.currency_locale ||
        columnMeta.currency_locale === 'en-US' ||
        typeof (formatter as any).formatToParts !== 'function'
      ) {
        // keep '-' for the sign pass in serializeDecimalValue to resolve
        return value?.replace(/[^0-9.-]/g, '');
      }

      const { group, decimal } = getGroupDecimalSymbolFromLocale(
        columnMeta?.currency_locale
      );

      return value
        .replace(new RegExp('\\' + group, 'g'), '') // 1. Remove all group (thousands) separators
        .replace(new RegExp('\\' + decimal), '.') // 2. Replace the locale-specific decimal separator with a dot (.)
        .replace(/[^\d.-]/g, ''); // 3. Remove any non-digit, non-dot, non-minus characters (e.g., currency symbols, spaces) — the minus is resolved into a sign by serializeDecimalValue
    },
    params
  );
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

  value = serializeIntValue(value);

  const parsedDate = dayjs(value?.toString());

  return parsedDate.isValid() ? +parsedDate.format('YYYY') : null;
};

export const serializeSelectValue = (value: any, col: ColumnType) => {
  // Always trim values for select fields to prevent creating options with leading/trailing spaces
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
