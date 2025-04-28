import { type NcContext, parseProp } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import { DecimalGeneralHandler } from '../decimal/decimal.general.handler';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class RatingGeneralHandler extends DecimalGeneralHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    const value = (await super.parseUserInput(params))?.value;
    if (typeof value === 'number') {
      const max = parseFloat(parseProp(params.column.meta)?.max);
      if (value < 0 || value > max) {
        NcError.invalidValueForField({
          value: value.toString(),
          column: params.column.title,
          type: params.column.uidt,
        });
      }
    }
    return { value };
  }
}
