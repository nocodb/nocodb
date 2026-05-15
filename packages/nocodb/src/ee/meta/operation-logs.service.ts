import { OperationLogsService as OperationLogsServiceCE } from 'src/meta/operation-logs.service';
import { Injectable, Optional } from '@nestjs/common';
import XcMigrationSourceOperationLogs from '~/meta/migrations/XcMigrationSourceOperationLogs';
import { NcConfig } from '~/utils/nc-config';
import { isWorker } from '~/utils';

@Injectable()
export class OperationLogsService extends OperationLogsServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    if (isWorker) {
      return true;
    }

    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourceOperationLogs(),
      tableName: 'xc_knex_migrations_operation_logs',
    });
    return true;
  }
}
