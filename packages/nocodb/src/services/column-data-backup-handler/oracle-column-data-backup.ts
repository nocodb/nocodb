import { ClientType } from 'nocodb-sdk';
import type { ColumnDataBackupDriver } from '~/services/column-data-backup-handler';

const EE_ONLY = 'Oracle is only available in the enterprise (EE) build';

export class OracleColumnDataBackup implements ColumnDataBackupDriver {
  dbDriverName = ClientType.ORACLE;

  backupColumnData(
    _param: Parameters<ColumnDataBackupDriver['backupColumnData']>[0],
  ): ReturnType<ColumnDataBackupDriver['backupColumnData']> {
    throw new Error(EE_ONLY);
  }

  restoreBackupData(
    _param: Parameters<ColumnDataBackupDriver['restoreBackupData']>[0],
  ): ReturnType<ColumnDataBackupDriver['restoreBackupData']> {
    throw new Error(EE_ONLY);
  }

  dropBackup(
    _param: Parameters<ColumnDataBackupDriver['dropBackup']>[0],
  ): ReturnType<ColumnDataBackupDriver['dropBackup']> {
    throw new Error(EE_ONLY);
  }
}
