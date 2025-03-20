import { ncIsNumber } from 'nocodb-sdk';
import type { FilterVeriicationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class DecimalGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
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
    ];
    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt}`,
        ],
      } as FilterVeriicationResult;
    }
    if (
      !(
        typeof filter.value === 'undefined' ||
        filter.value === null ||
        typeof filter.value === 'number' ||
        ncIsNumber(Number(filter.value))
      )
    ) {
      return {
        isValid: false,
        errors: [
          `Value ${filter.value} is not supported for type ${column.uidt}`,
        ],
      } as FilterVeriicationResult;
    }
    return {
      isValid: true,
    } as FilterVeriicationResult;
  }
}
