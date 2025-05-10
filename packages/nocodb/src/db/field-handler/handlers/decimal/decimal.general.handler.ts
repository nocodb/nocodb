import { ncIsNull, ncIsNumber, ncIsUndefined } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import type { MetaService } from 'src/meta/meta.service';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class DecimalGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'gb_eq',
      'gb_null',
      'eq',
      'neq',
      'blank',
      'notblank',
      'is',
      'isnot',
      'gt',
      'lt',
      'gte',
      'lte',
      'ge',
      'le',
      'in',
      'empty',
      'notempty',
      'null',
      'notnull',
    ];
    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }

    if (
      !(
        typeof filter.value === 'undefined' ||
        filter.value === null ||
        typeof filter.value === 'number' ||
        ncIsNumber(Number(filter.value)) ||
        (filter.comparison_op === 'in' && Array.isArray(filter.value))
      )
    ) {
      return {
        isValid: false,
        errors: [
          `Value ${filter.value} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
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
  }): Promise<any> {
    if (!ncIsUndefined(params.value) && !ncIsNull(params.value)) {
      const numberValue = Number(params.value);
      if (!ncIsNumber(numberValue)) {
        NcError.invalidValueForField({
          value: params.value,
          column: params.column.title,
          type: params.column.uidt,
        });
      }
      return { value: numberValue };
    }
    return { value: params.value };
  }
}
