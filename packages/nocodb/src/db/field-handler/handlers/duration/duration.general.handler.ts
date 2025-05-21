import { NumberGeneralHandler } from '../number/number.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class DurationGeneralHandler extends NumberGeneralHandler {
  override async parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    return super.parseValue(params);
  }
}
