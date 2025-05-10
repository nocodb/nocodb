import { NcError } from 'src/helpers/catchError';
import { DecimalGeneralHandler } from '../decimal/decimal.general.handler';
import type { Column } from 'src/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from 'src/meta/meta.service';

export class NumberGeneralHandler extends DecimalGeneralHandler {
  override async parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<any> {
    const value = await super.parseValue(params);
    if (parseInt(value) !== value) {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
    return value;
  }
}
