import { AuditService as AuditServiceCE } from 'src/meta/audit.service';
import { Injectable, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import XcMigrationSourceAudit from '~/meta/migrations/XcMigrationSourceAudit';
import { NcConfig } from '~/utils/nc-config';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AuditService extends AuditServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourceAudit(),
      tableName: 'xc_knex_migrations_audit',
    });
    return true;
  }
}
