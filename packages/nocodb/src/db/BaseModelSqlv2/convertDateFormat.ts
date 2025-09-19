import dayjs from 'dayjs';
import { isCreatedOrLastModifiedTimeCol, UITypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { Column } from '~/models';

export class ConvertDateFormat {
  constructor(protected readonly baseModel: IBaseModelSqlV2) {}

  convertDateFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
    rollupColumns?: { column: Column; rollupColumn: Column }[],
  ) {
    // Show the date time in UTC format in API response
    // e.g. 2022-01-01 04:30:00+00:00
    if (data) {
      const columns = this.baseModel.model?.columns.concat(
        dependencyColumns ?? [],
      );
      const dateTimeColumns = columns.filter(
        (c) =>
          c.uidt === UITypes.DateTime ||
          c.uidt === UITypes.Date ||
          isCreatedOrLastModifiedTimeCol(c) ||
          c.uidt === UITypes.Formula,
      );
      if (dateTimeColumns.length) {
        if (Array.isArray(data)) {
          data = data.map((d) =>
            this.convertDateFormatSingle(dateTimeColumns, d, rollupColumns),
          );
        } else {
          data = this.convertDateFormatSingle(
            dateTimeColumns,
            data,
            rollupColumns,
          );
        }
      }
    }
    return data;
  }

  // TODO(timezone): retrieve the format from the corresponding column meta
  protected convertDateFormatSingle(
    dateTimeColumns: Record<string, any>[],
    d: Record<string, any>,
    rollupColumns?: {
      column: Record<string, any>;
      rollupColumn: Record<string, any>;
    }[],
  ) {
    if (!d) return d;

    // Cache timezone and regex patterns at the method level for better performance
    const cachedTimeZone = this.baseModel.isSqlite
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

    // Pre-compile regex patterns to avoid repeated compilation
    // the pre-compiled patterns have mutable `lastIndex` property that we use below, so it cannot be made global to avoid race condition
    const isoRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
    const datetimeRegex =
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?/g;
    const noTimezoneRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

    for (const col of dateTimeColumns.concat(rollupColumns ?? [])) {
      const colId = col.column ? col.column.id : col.id;
      const targetColumn = col.rollupColumn ? col.rollupColumn : col;

      if (!d[colId]) continue;
      if (targetColumn.uidt === UITypes.Formula) {
        if (!d[colId] || typeof d[colId] !== 'string') {
          continue;
        }

        // remove milliseconds
        if (this.baseModel.isMySQL) {
          d[colId] = d[colId].replace(/\.000000/g, '');
        }

        // Reset regex lastIndex for reuse
        isoRegex.lastIndex = 0;
        if (isoRegex.test(d[colId])) {
          // convert ISO string (e.g. in MSSQL) to YYYY-MM-DD hh:mm:ssZ
          // e.g. 2023-05-18T05:30:00.000Z -> 2023-05-18 11:00:00+05:30
          isoRegex.lastIndex = 0; // Reset for replace
          d[colId] = d[colId].replace(isoRegex, (dateStr: string) => {
            if (!dayjs(dateStr).isValid()) return dateStr;
            if (this.baseModel.isSqlite) {
              // e.g. DATEADD formula
              return dayjs(dateStr).utc().format('YYYY-MM-DD HH:mm:ssZ');
            }
            return dayjs(dateStr).utc(true).format('YYYY-MM-DD HH:mm:ssZ');
          });
          continue;
        }

        // convert all date time values to utc
        // the datetime is either YYYY-MM-DD hh:mm:ss (xcdb)
        // or YYYY-MM-DD hh:mm:ss+/-xx:yy (ext)
        datetimeRegex.lastIndex = 0; // Reset for replace
        d[colId] = d[colId].replace(datetimeRegex, (dateStr: string) => {
          if (!dayjs(dateStr).isValid()) {
            return dateStr;
          }

          if (this.baseModel.isSqlite) {
            // if there is no timezone info,
            // we assume the input is on NocoDB server timezone
            // then we convert to UTC from server timezone
            // example: datetime without timezone
            // we need to display 2023-04-27 10:00:00 (in HKT)
            // we convert d (e.g. 2023-04-27 18:00:00) to utc, i.e. 2023-04-27 02:00:00+00:00
            // if there is timezone info,
            // we simply convert it to UTC
            // example: datetime with timezone
            // e.g. 2023-04-27 10:00:00+05:30  -> 2023-04-27 04:30:00+00:00
            return dayjs(dateStr)
              .tz(cachedTimeZone)
              .utc()
              .format('YYYY-MM-DD HH:mm:ssZ');
          }

          // set keepLocalTime to true if timezone info is not found
          const keepLocalTime = noTimezoneRegex.test(dateStr);

          return dayjs(dateStr)
            .utc(keepLocalTime)
            .format('YYYY-MM-DD HH:mm:ssZ');
        });
        continue;
      }

      if (targetColumn.uidt === UITypes.Date) {
        d[colId] = dayjs(d[colId]).format('YYYY-MM-DD');
        continue;
      }

      let keepLocalTime = true;

      if (this.baseModel.isSqlite) {
        if (!targetColumn.cdf) {
          if (
            d[colId].indexOf('-') === -1 &&
            d[colId].indexOf('+') === -1 &&
            d[colId].slice(-1) !== 'Z'
          ) {
            // if there is no timezone info,
            // we assume the input is on NocoDB server timezone
            // then we convert to UTC from server timezone
            // e.g. 2023-04-27 10:00:00 (IST) -> 2023-04-27 04:30:00+00:00
            d[colId] = dayjs(d[colId])
              .tz(Intl.DateTimeFormat().resolvedOptions().timeZone)
              .utc()
              .format('YYYY-MM-DD HH:mm:ssZ');
            continue;
          } else {
            // otherwise, we convert from the given timezone to UTC
            keepLocalTime = false;
          }
        }
      }

      if (this.baseModel.isPg) {
        // postgres - timezone already attached to input
        // e.g. 2023-05-11 16:16:51+08:00
        keepLocalTime = false;
      }
      if (d[colId] instanceof Date) {
        // e.g. MSSQL
        // Wed May 10 2023 17:47:46 GMT+0800 (Hong Kong Standard Time)
        keepLocalTime = false;
      }
      // e.g. 01.01.2022 10:00:00+05:30 -> 2022-01-01 04:30:00+00:00
      // e.g. 2023-05-09 11:41:49 -> 2023-05-09 11:41:49+00:00
      d[colId] = dayjs(d[colId])
        // keep the local time
        .utc(keepLocalTime)
        // show the timezone even for Mysql
        .format('YYYY-MM-DD HH:mm:ssZ');
    }
    return d;
  }
}
