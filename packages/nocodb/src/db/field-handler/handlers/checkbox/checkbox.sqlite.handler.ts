import { CheckboxGeneralHandler } from './checkbox.general.handler';
import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from 'src/models';

export class CheckboxSqliteHandler extends CheckboxGeneralHandler {
  override async parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
  }): Promise<{ value: any }> {
    if (params.value === 1) {
      return { value: true };
    } else if (params.value === 0) {
      return { value: false };
    } else {
      return { value: params.value };
    }
  }
}
