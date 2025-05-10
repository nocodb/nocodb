import { type NcContext, ncIsUndefined } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { FilterVerificationResult } from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class CheckboxGeneralHandler extends GenericFieldHandler {
  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'eq',
      'neq',
      'blank',
      'notblank',
      'checked',
      'notchecked',
      'is',
      'isnot',
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
      ['eq', 'neq'].includes(filter.comparison_op) &&
      ![null, true, false, 'true', 'false', '', 1, 0, '1', '0'].includes(
        filter.value,
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
    if (ncIsUndefined(params.value)) {
      return { value: params.value };
    }
    if (
      [1, '1', true].includes(params.value) ||
      (typeof params.value === 'string' &&
        ['true', 'yes', 'y'].includes(params.value.toLowerCase()))
    ) {
      return { value: true };
    } else if (
      [0, '0', false, null].includes(params.value) ||
      (typeof params.value === 'string' &&
        ['false', 'no', 'n'].includes(params.value.toLowerCase()))
    ) {
      return { value: false };
    } else {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
  }
}
