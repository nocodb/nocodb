import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, FormulaColumn } from '~/models';

export interface FormulaDataMigrationDriver {
  dbDriverName: string;
  migrate(param: {
    baseModelSqlV2: BaseModelSqlv2;
    formulaColumn: Column<any>;
    destinationColumn: Column<any>;
    formulaColumnOption: FormulaColumn;
    offset?: number;
    limit?: number;
  }): Promise<{ primaryKeys: any; row: Record<string, any> }[]>;
}
