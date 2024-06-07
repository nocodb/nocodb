import { UITypes } from 'nocodb-sdk';
import { convertDateFormat } from './convertDateFormat';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';

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

export async function convertDateFormatForConcat(
  context: NcContext,
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
      await Column.get(context, {
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
