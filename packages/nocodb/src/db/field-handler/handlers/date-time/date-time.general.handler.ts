import dayjs from 'dayjs';
import { parseDateTimeValue } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
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

  protected parseDateTime(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }) {
    let dayjsUtcValue: dayjs.Dayjs;
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
        if (!dayjsUtcValue.isValid() && params.column.meta?.date_format) {
          dayjsUtcValue = dayjs(strVal, params.column.meta?.date_format).utc();
        }
      } else if (typeof params.value === 'number') {
        dayjsUtcValue = dayjs.unix(params.value).utc();
      }
    }
    if (!dayjsUtcValue.isValid()) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return { value: dayjsUtcValue };
  }

  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    return {
      value: this.parseDateTime(params).value.format('YYYY-MM-DD HH:mm:ssZ'),
    };
  }
}
