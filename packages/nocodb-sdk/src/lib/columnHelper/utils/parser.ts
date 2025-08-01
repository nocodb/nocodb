import dayjs from 'dayjs';
import { ColumnType } from '~/lib/Api';
import { convertMS2Duration } from '~/lib/durationUtils';
import { parseProp, roundUpToPrecision } from '~/lib/helperFunctions';
import {
  ncIsArray,
  ncIsBoolean,
  ncIsNaN,
  ncIsNull,
  ncIsNumber,
  ncIsObject,
  ncIsString,
  ncIsUndefined,
} from '~/lib/is';
import { SerializerOrParserFnProps } from '../column.interface';
import { constructTimeFormat } from '~/lib/dateTimeHelper';
import { checkboxTypeMap } from '~/lib/columnHelper/utils/common';

export const parseDefault = (value: any) => {
  try {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    } else {
      return value?.toString() ?? null;
    }
  } catch {
    return null;
  }
};

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
    const parsedValue = checkboxTypeMap[strval];
    if (!ncIsNull(parsedValue) && !ncIsUndefined(parsedValue)) {
      return parsedValue;
    }
  }

  if (ncIsNumber(value)) {
    if (value === 1) return true;
    if (value === 0) return false;
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

  try {
    // Round the value to the specified precision
    const roundedValue = roundUpToPrecision(
      Number(value),
      columnMeta.precision ?? 2
    );

    return new Intl.NumberFormat(columnMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: columnMeta.currency_code || 'USD',
      minimumFractionDigits: columnMeta.precision ?? 2,
      maximumFractionDigits: columnMeta.precision ?? 2,
    }).format(+roundedValue);
  } catch {
    return value;
  }
};

export const parseTimeValue = (
  value: any,
  params: SerializerOrParserFnProps['params']
) => {
  value = value?.toString().trim();

  if (!value) return null;

  // remove `"`
  // e.g. "2023-05-12T08:03:53.000Z" -> 2023-05-12T08:03:53.000Z
  value = value.replace(/["']/g, '');

  const isMySQL = params.isMysql?.(params.col.source_id);
  const isPostgres = params.isPg?.(params.col.source_id);

  let d = dayjs(value);

  if (!d.isValid()) {
    // insert a datetime value, copy the value without refreshing
    // e.g. value = 2023-05-12T03:49:25.000Z
    // feed custom parse format
    d = dayjs(value, isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ');
  }

  if (!d.isValid()) {
    // MySQL and Postgres store time in HH:mm:ss format so we need to feed custom parse format
    d = isMySQL || isPostgres ? dayjs(value, 'HH:mm:ss') : dayjs(value);
  }

  if (!d.isValid()) {
    d = dayjs(`1999-01-01 ${value}`);
  }

  if (!d.isValid()) {
    // return empty string for invalid time
    return null;
  }

  return d.format(constructTimeFormat(params.col));
};

export const parseYearValue = (value: any) => {
  value = value?.toString().trim();

  if (!value || !dayjs(value).isValid()) {
    return null;
  }

  value = dayjs(value, 'YYYY').format('YYYY');

  return value ? +value : value;
};

export const parseUserValue = (value: any, withDisplayName = false) => {
  let data = value;
  try {
    if (typeof value === 'string') {
      data = JSON.parse(value);
    }
  } catch {}

  return (ncIsArray(data) ? data : ncIsObject(data) ? [data] : [])
    .map((user) =>
      withDisplayName && user.display_name
        ? `${user.display_name}<${user.email}>`
        : `${user.email}`
    )
    .join(', ');
};

export const parseLinksValue = (
  value: any,
  params: SerializerOrParserFnProps['params']
) => {
  const { col, t } = params;

  const columnMeta = parseProp(col.meta);

  const parsedValue = +value || 0;
  if (!parsedValue) {
    return `0 ${columnMeta.plural || (t?.('general.links') ?? 'Links')}`;
  } else if (parsedValue === 1) {
    return `1 ${columnMeta.singular || (t?.('general.link') ?? 'Link')}`;
  } else {
    return `${parsedValue} ${
      columnMeta.plural || (t('general.links') ?? 'Links')
    }`;
  }
};
