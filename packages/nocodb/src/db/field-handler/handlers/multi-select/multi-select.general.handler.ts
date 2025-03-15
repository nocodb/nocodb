import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class MultiSelectGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(_filter: Filter, _column: Column) {
    return {
      isValid: true,
    } as FilterVerificationResult;
  }
}
