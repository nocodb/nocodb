import { ncIsNumber } from 'nocodb-sdk';
import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
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
}
