import { NcError } from 'src/helpers/catchError';
import { NC_MAX_TEXT_LENGTH } from 'src/constants';
import { isAIPromptCol, ncIsObject } from 'nocodb-sdk';
import type { AIRecordType, NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class LongTextGeneralHandler extends GenericFieldHandler {
  async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    let value = params.value;

    if (isAIPromptCol(params.column) && ncIsObject(value)) {
      value = (value as AIRecordType).value ?? '';
    }

    value = value?.toString() ?? '';

    // if (typeof params.value !== 'string') {
    //   NcError.invalidValueForField({
    //     value: params.value,
    //     column: params.column.title,
    //     type: params.column.uidt,
    //   });
    // }
    // if (
    //   Number(params.column.dtxp) > 0 &&
    //   params.value.length > Number(params.column.dtxp)
    // ) {
    //   NcError.invalidValueForField({
    //     value: params.value,
    //     column: params.column.title,
    //     type: params.column.uidt,
    //   });
    // }
    if (value.length > NC_MAX_TEXT_LENGTH) {
      NcError._.valueLengthExceedLimit({
        length: value.length,
        column: params.column.title,
        type: params.column.uidt,
        maxLength: NC_MAX_TEXT_LENGTH,
      });
    }

    // we return a string all the time to support any input (number, boolean, etc.) on text fields
    return { value: isAIPromptCol(params.column) ? params.value : value };
  }
}
