import type { FilterVeriicationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class NumberGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(_filter: Filter, _column: Column) {
    return {
      isValid: true,
    } as FilterVeriicationResult;
  }
}
