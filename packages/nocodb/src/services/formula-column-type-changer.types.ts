import type { BaseModelSqlv2 } from 'src/db/BaseModelSqlv2';
import type { ColumnReqType, NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type { Column } from '~/models';
import type { ReusableParams } from '~/services/columns.service.type';

export interface IFormulaColumnTypeChanger {
  startChangeFormulaColumnType(
    context: NcContext,
    params: {
      req: NcRequest;
      formulaColumn: Column;
      user: UserType;
      reuse?: ReusableParams;
      newColumnRequest: ColumnReqType & { colOptions?: any };
    },
  ): Promise<void>;

  startMigrateData(
    context: NcContext,
    {
      formulaColumn,
      destinationColumn,
      baseModel,
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
      baseModel?: BaseModelSqlv2;
    },
  ): Promise<void>;
}
