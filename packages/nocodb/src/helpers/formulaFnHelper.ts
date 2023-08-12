import dayjs from 'dayjs';
import { UITypes } from 'nocodb-sdk';
import { convertDateFormat } from './convertDateFormat';
import Column from '~/models/Column';

// todo: tobe fixed
// import customParseFormat from 'dayjs/plugin/customParseFormat';
// extend(customParseFormat);

export function getWeekdayByText(v: string) {
  return {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  }[v?.toLowerCase() || 'monday'];
}

export function getWeekdayByIndex(idx: number): string {
  return {
    0: 'monday',
    1: 'tuesday',
    2: 'wednesday',
    3: 'thursday',
    4: 'friday',
    5: 'saturday',
    6: 'sunday',
  }[idx || 0];
}

export function validateDateWithUnknownFormat(v: string) {
  const dateFormats = [
    'DD-MM-YYYY',
    'MM-DD-YYYY',
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'YYYY/MM/DD',
    'DD MM YYYY',
    'MM DD YYYY',
    'YYYY MM DD',
  ];
  for (const format of dateFormats) {
    if (dayjs(v, format, true).isValid() as any) {
      return true;
    }
    for (const timeFormat of ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']) {
      if (dayjs(v, `${format} ${timeFormat}`, true).isValid() as any) {
        return true;
      }
    }
  }
  return false;
}

export async function convertDateFormatForConcat(
  o,
  columnIdToUidt,
  query,
  clientType,
) {
  if (
    o?.type === 'Identifier' &&
    o?.name in columnIdToUidt &&
    columnIdToUidt[o.name] === UITypes.Date
  ) {
    const meta = (
      await Column.get({
        colId: o.name,
      })
    ).meta;

    if (clientType === 'mysql2') {
      query = `DATE_FORMAT(${query}, '${convertDateFormat(
        meta.date_format,
        clientType,
      )}')`;
    } else if (clientType === 'pg') {
      query = `TO_CHAR(${query}, '${convertDateFormat(
        meta.date_format,
        clientType,
      )}')`;
    } else if (clientType === 'sqlite3') {
      query = `strftime('${convertDateFormat(
        meta.date_format,
        clientType,
      )}', ${query})`;
    } else if (clientType === 'mssql') {
      query = `FORMAT(${query}, '${convertDateFormat(
        meta.date_format,
        clientType,
      )}')`;
    }
  }
  return query;
}
