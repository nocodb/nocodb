import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { type NcContext } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column, Filter } from 'src/models';
import type {
  FilterOptions,
  FilterVerificationResult,
} from '~/db/field-handler/field-handler.interface';
import type CustomKnex from '~/db/CustomKnex';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

dayjs.extend(utc);

export class TimeGeneralHandler extends GenericFieldHandler {
  getTimeFormat() {
    return 'YYYY-MM-DD HH:mm:ssZ';
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
    if (
      params.value === null ||
      params.value === undefined ||
      params.value === ''
    ) {
      return { value: null };
    }

    let parsedTime: dayjs.Dayjs;
    const value = params.value?.toString().trim();

    // Try parsing as full datetime first (e.g., "1999-01-01 01:00:00+05:30")
    parsedTime = dayjs(value);

    // If not valid, try parsing as time only with HH:mm:ss format
    if (!parsedTime.isValid()) {
      parsedTime = dayjs(value, 'HH:mm:ss');
    }

    // If still not valid, prepend a date to help parse the time
    if (!parsedTime.isValid()) {
      parsedTime = dayjs(`1999-01-01 ${value}`);
    }

    // If still invalid, throw an error
    if (!parsedTime.isValid()) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }

    return { value: parsedTime.format(this.getTimeFormat()) };
  }

  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
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
      'btw',
      'nbtw',
      'gb_eq',
      'gb_null',
    ];

    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }

    // For comparison operations that need a value, validate the time format
    if (
      [
        'eq',
        'neq',
        'not',
        'gt',
        'lt',
        'gte',
        'lte',
        'ge',
        'le',
        'gb_eq',
      ].includes(filter.comparison_op) &&
      filter.value
    ) {
      // Try to parse the filter value as time
      let parsedTime = dayjs(filter.value);
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(filter.value, 'HH:mm:ss');
      }
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(`1999-01-01 ${filter.value}`);
      }

      if (!parsedTime.isValid()) {
        return {
          isValid: false,
          errors: [
            `Value ${filter.value} is not a valid time for column ${column.title}`,
          ],
        } as FilterVerificationResult;
      }
    }

    return {
      isValid: true,
    } as FilterVerificationResult;
  }

  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const { alias } = options;
    const val = filter.value;
    const field =
      options.customWhereClause ??
      (alias ? `${alias}.${column.column_name}` : column.column_name);

    // Parse the filter value to ensure it's in the correct format
    let parsedVal = val;
    if (val && typeof val === 'string') {
      let parsedTime = dayjs(val);
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(val, 'HH:mm:ss');
      }
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(`1999-01-01 ${val}`);
      }

      if (parsedTime.isValid()) {
        parsedVal = parsedTime.format(this.getTimeFormat());
      }
    }

    return await this.handleFilter(
      { val: parsedVal, sourceField: field },
      { knex, filter, column },
      options,
    );
  }
}
