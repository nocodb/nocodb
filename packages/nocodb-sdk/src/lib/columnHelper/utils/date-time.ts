import dayjs from 'dayjs';
import { ColumnType } from '~/lib/Api';
import { SerializerOrParserFnProps } from '~/lib/columnHelper/column.interface';
import {
  constructDateTimeFormat,
  getDateFormat,
  getDateTimeFormat,
} from '~/lib/dateTimeHelper';
import { parseProp } from '~/lib/helperFunctions';
import UITypes from '~/lib/UITypes';
import { isJalaliFormat, parseJalaliToGregorian } from '~/lib/jalali';

export const DATE_SCALE_LABEL_TO_DIFF_MAP = {
  Y: 'year',
  M: 'month',
  D: 'day',
  H: 'hour',
  m: 'minute',
  s: 'second',
};
export const DATE_DIFF_TO_SCALE_LABEL_MAP = {
  year: 'Y',
  month: 'M',
  day: 'D',
  hour: 'H',
  minute: 'm',
  second: 's',
};

/**
 * Parse a display string that may be in a Jalali (Persian) format into a
 * Gregorian dayjs. The Jalali dayjs plugin only makes `.format()` Jalali-aware —
 * parsing (`dayjs(str, format)`) still treats `j`-prefixed tokens as Gregorian,
 * so a Jalali display string like `1405/04/23` would otherwise be misread as the
 * Gregorian year 1405. For Jalali formats we convert the Jalali date portion to
 * Gregorian while preserving any time-of-day; for every other format we defer to
 * dayjs' normal parsing so behaviour is unchanged.
 */
export const parseDayjsWithJalaliSupport = (
  value: string,
  format: string
): dayjs.Dayjs => {
  if (!isJalaliFormat(format)) {
    return dayjs(value, format);
  }

  const gregorian = parseJalaliToGregorian(value, format);
  if (!gregorian) {
    return dayjs(NaN);
  }

  // Once the `j` prefixes are stripped, customParseFormat reads the time tokens
  // correctly; its (mis-read) date tokens are ignored since we take the date
  // from the Jalali conversion above.
  const gregorianFormat = format.replace(
    /j(YYYY|YY|MMMM|MMM|MM|M|DD|D)/g,
    '$1'
  );
  const timeParse = dayjs(value, gregorianFormat);
  const time = timeParse.isValid() ? timeParse.format('HH:mm:ss') : '00:00:00';

  const pad = (n: number) => String(n).padStart(2, '0');
  return dayjs(
    `${gregorian.y}-${pad(gregorian.m)}-${pad(gregorian.d)} ${time}`,
    'YYYY-MM-DD HH:mm:ss'
  );
};

export const parseDateValue = (
  value: string | null,
  col: ColumnType,
  isSystemCol?: boolean
) => {
  value = value?.toString().trim();
  const dateFormat = !isSystemCol
    ? parseProp(col.meta)?.date_format ?? 'YYYY-MM-DD'
    : 'YYYY-MM-DD HH:mm:ss';

  if (!value || !dayjs(value).isValid()) {
    return null;
  } else {
    value = value?.toString().trim();
    return dayjs(/^\d+$/.test(value) ? +value : value).format(dateFormat);
  }
};

export const parseDateTimeValue = (
  value: any,
  params: SerializerOrParserFnProps['params']
) => {
  // remove `"`
  // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
  value = value?.replace(/["']/g, '');
  if (!value) {
    return;
  }

  const isMySQL = params.isMysql?.(params.col.source_id);

  let d = dayjs(value);

  if (!d.isValid()) {
    // insert a datetime value, copy the value without refreshing
    // e.g. value = 2023-05-12T03:49:25.000Z
    // feed custom parse format
    d = dayjs(value, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ');
  }

  // users can change the datetime format in UI
  // `value` would be always in YYYY-MM-DD HH:mm:ss(Z / +xx:yy) format
  // therefore, here we reformat to the correct datetime format based on the meta
  value = d.format(constructDateTimeFormat(params.col));

  if (!d.isValid()) {
    // return empty string for invalid datetime
    return null;
  }

  return value;
};

export const serializeDateOrDateTimeValue = (
  value: string | null,
  params: SerializerOrParserFnProps['params']
) => {
  if (!value) return null;

  value = value?.toString().trim();
  let isDateOnly = false;
  if (typeof value === 'string' && value.length < 11) {
    isDateOnly = true;
  } else if (
    params.col.uidt === UITypes.Date &&
    isJalaliFormat(parseProp(params.col.meta)?.date_format)
  ) {
    // A Jalali date display string (esp. a Persian month name like
    // "23 تیر 1405") can exceed the length heuristic; a Date column is always
    // date-only, so parse it with the (Jalali) date_format.
    isDateOnly = true;
  }

  let parsedDateOrDateTime;

  // If clipboardItem column is date or datetime, then use the dbCellValue from clipboardItem
  if (
    [UITypes.Date, UITypes.DateTime].includes(
      params.clipboardItem?.column?.uidt as UITypes
    ) &&
    params.clipboardItem.dbCellValue
  ) {
    const formatting =
      params.clipboardItem?.column.uidt === UITypes.Date
        ? 'YYYY-MM-DD'
        : 'YYYY-MM-DD HH:mm:ssZ';

    parsedDateOrDateTime = dayjs(params.clipboardItem.dbCellValue, formatting);
  }

  // If clipboardItem not present or invalid, then use default method to parse the value
  if (!parsedDateOrDateTime || !parsedDateOrDateTime.isValid()) {
    const formatting = isDateOnly
      ? parseProp(params.col.meta).date_format ?? 'YYYY-MM-DD'
      : constructDateTimeFormat(params.col);

    // Jalali-aware: a Jalali display string (e.g. `1405/04/23`) must be
    // converted from Jalali, not misread as the Gregorian year 1405.
    parsedDateOrDateTime = parseDayjsWithJalaliSupport(value, formatting);
  }

  if (!parsedDateOrDateTime.isValid()) {
    parsedDateOrDateTime = dayjs(value, getDateTimeFormat(value));
    if (!parsedDateOrDateTime.isValid()) {
      parsedDateOrDateTime = dayjs(value, getDateFormat(value));
    }
  }

  if (!parsedDateOrDateTime.isValid()) {
    return null;
  }

  return params.col.uidt === UITypes.Date
    ? parsedDateOrDateTime.format('YYYY-MM-DD')
    : parsedDateOrDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ');
};
