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
  col: ColumnType
) => {
  if (!value) return null;

  value = value?.toString().trim();
  let isDateOnly = false;
  if (typeof value === 'string' && value.length < 11) {
    isDateOnly = true;
  }
  const formatting = isDateOnly
    ? parseProp(col.meta).date_format ?? 'YYYY-MM-DD'
    : constructDateTimeFormat(col);

  let parsedDateOrDateTime = dayjs(value, formatting);

  if (!parsedDateOrDateTime.isValid()) {
    parsedDateOrDateTime = dayjs(value, getDateTimeFormat(value));
    if (!parsedDateOrDateTime.isValid()) {
      parsedDateOrDateTime = dayjs(value, getDateFormat(value));
    }
  }

  if (!parsedDateOrDateTime.isValid()) {
    return null;
  }

  return col.uidt === UITypes.Date
    ? parsedDateOrDateTime.format('YYYY-MM-DD')
    : parsedDateOrDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ');
};
