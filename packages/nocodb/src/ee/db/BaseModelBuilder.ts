import type { NcContext } from 'nocodb-sdk';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

export class BaseModelBuilder {
  static async getBaseModel(context: NcContext, param: any) {
    return new BaseModelSqlv2({
      context,
      ...param,
    });
  }
  static async getBaseModelBatchable(context: NcContext, param: any) {
    // dynamic import of BatchableExtBaseModelSqlv2
    // to prevent circular dependency
    const { BatchableExtBaseModelSqlv2 } = await import(
      './BatchableExtBaseModelSqlv2'
    );
    return new BatchableExtBaseModelSqlv2({
      context,
      ...param,
    });
  }
}
