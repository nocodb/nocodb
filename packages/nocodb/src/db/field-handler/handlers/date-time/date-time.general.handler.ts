import dayjs from 'dayjs';
import { ClientType, parseDateTimeValue } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class DateTimeGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'gb_eq',
      'gb_null',
      'eq',
      'neq',
      'not',
      'empty',
      'notempty',
      'null',
      'notnull',
      'blank',
      'notblank',
      'gt',
      'lt',
      'gte',
      'lte',
      'ge',
      'le',
      'isnot',
      'is',
      'isWithin',
    ];
    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }
    if (filter.comparison_sub_op === 'exactDate' || !filter.comparison_sub_op) {
      // check if value is not null or empty
      if (
        !(
          filter.value === null ||
          typeof filter.value === 'undefined' ||
          filter.value === '' ||
          (filter.comparison_op === 'in' && Array.isArray(filter.value))
        )
      ) {
        const dateTimeValue = await parseDateTimeValue(filter.value, {
          col: column,
        });
        if (dateTimeValue === null || typeof dateTimeValue === 'undefined') {
          return {
            isValid: false,
            errors: [
              `Value ${filter.value} is not supported for type ${column.uidt} on column ${column.title}`,
            ],
          } as FilterVerificationResult;
        }
      }
    }
    return {
      isValid: true,
    } as FilterVerificationResult;
  }
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    const dbClientType = params.baseModel.dbDriver.client.config.client;
    const knex = params.baseModel.dbDriver;
    let dayjsUtcValue: dayjs.Dayjs;
    let val: any;
    if (
      params.value &&
      (params.value instanceof Date ||
        typeof params.value === 'string' ||
        typeof params.value === 'number')
    ) {
      if (params.value instanceof Date) {
        dayjsUtcValue = dayjs(params.value).utc();
      } else if (typeof params.value === 'string') {
        let strVal: any = params.value;
        if (
          strVal.indexOf('-') < 0 &&
          strVal.indexOf('+') < 0 &&
          strVal.slice(-1) !== 'Z'
        ) {
          // if no timezone is given,
          // then append +00:00 to make it as UTC
          strVal += '+00:00';
        }
        dayjsUtcValue = dayjs(strVal).utc();
      } else if (typeof params.value === 'number') {
        dayjsUtcValue = dayjs.unix(params.value).utc();
      }

      if (dbClientType === ClientType.MYSQL) {
        // first convert the value to utc
        // from UI
        // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
        // from API
        // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
        // if timezone info is not found - considered as utc
        // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
        // if timezone info is found
        // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
        // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
        // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
        // then we use CONVERT_TZ to convert that in the db timezone
        val = knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
          dayjsUtcValue.format('YYYY-MM-DD HH:mm:ss'),
        ]);
      } else if (dbClientType === ClientType.SQLITE) {
        // convert to UTC
        // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
        val = dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ');
      } else if (dbClientType === ClientType.PG) {
        // convert to UTC
        // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
        // then convert to db timezone
        val = knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
          dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ'),
        ]);
      } else if (dbClientType === ClientType.MSSQL) {
        // convert ot UTC
        // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
        // then convert to db timezone
        val = knex.raw(
          `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
          [dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ')],
        );
      } else {
        // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
        val = dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ');
      }
      return { value: val };
    }

    return { value: params.value };
  }
}
