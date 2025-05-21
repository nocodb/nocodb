import {
  ClientType,
  ColumnHelper,
  parseDateTimeValue,
  SqlUiFactory,
} from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import type { MetaService } from 'src/meta/meta.service';
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
  override async parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    if (params.value instanceof Date) {
      return { value: params.value };
    } else if (typeof params.value === 'string') {
      const dbClientType = params.baseModel.dbDriver.client.config.client;
      const resultValue = ColumnHelper.parseValue(params.value, {
        col: params.column,
        abstractType: SqlUiFactory.create({
          client: dbClientType,
        }).getAbstractType(params.column),
        rowId: params.baseModel.extractPksValues(params.row, true),
        isMssql: (_sourceid) => dbClientType === ClientType.MSSQL,
        isMysql: (_sourceid) => dbClientType === ClientType.MYSQL,
        isPg: (_sourceid) => dbClientType === ClientType.PG,
      });
      return { value: resultValue };
    } else if (typeof params.value === 'number') {
      return { value: new Date(params.value) };
    }
    return { value: params.value };
  }
}
