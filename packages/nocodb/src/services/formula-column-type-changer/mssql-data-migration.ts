import { ClientType } from 'nocodb-sdk';
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer/index';

const EE_ONLY = 'MSSQL is only available in the enterprise (EE) build';

export class MssqlDataMigration implements FormulaDataMigrationDriver {
  dbDriverName = ClientType.MSSQL;

  migrate(
    _param: Parameters<FormulaDataMigrationDriver['migrate']>[0],
  ): ReturnType<FormulaDataMigrationDriver['migrate']> {
    throw new Error(EE_ONLY);
  }
}
