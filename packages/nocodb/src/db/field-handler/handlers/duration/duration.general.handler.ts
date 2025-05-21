import { NcError } from 'src/helpers/catchError';
import { NumberGeneralHandler } from '../number/number.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class DurationGeneralHandler extends NumberGeneralHandler {
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
    const { value } = (await super.parseUserInput(params)) ?? {};
    if (typeof value === 'number' && value < 0) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return { value };
  }
}
