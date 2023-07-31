import { MetaService as MetaServiceCE } from 'src/meta/meta.service';
import { Injectable, Optional } from '@nestjs/common';
import XcMigrationSourcev3 from 'src/meta/migrations/XcMigrationSourcev3';
import { NcConfig } from '~/utils/nc-config';

@Injectable()
export class MetaService extends MetaServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    await super.init();
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev3(),
      tableName: 'xc_knex_migrationsv3',
    });
    return true;
  }
}

export * from 'src/meta/meta.service';
