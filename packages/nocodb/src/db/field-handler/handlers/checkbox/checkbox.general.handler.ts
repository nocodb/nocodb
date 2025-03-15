import type { FilterVeriicationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class CheckboxGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'eq',
      'neq',
      'blank',
      'notblank',
      'is',
      'isnot',
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
      ![null, true, false, 'true', 'false', '', 1, 0, '1', '0'].includes(
        filter.value,
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
