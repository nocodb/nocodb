import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class SingleLineTextGeneralHandler extends GenericFieldHandler {
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
      'like',
      'nlike',
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
    return {
      isValid: true,
    } as FilterVerificationResult;
  }
}
