import { DocsContentService as DocsContentServiceCE } from 'src/meta/docs-content.service';
import { Injectable, Optional } from '@nestjs/common';
import XcMigrationSourceDocsContent from '~/meta/migrations/XcMigrationSourceDocsContent';
import { NcConfig } from '~/utils/nc-config';
import { isWorker } from '~/utils';

@Injectable()
export class DocsContentService extends DocsContentServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    if (isWorker) {
      return true;
    }

    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourceDocsContent(),
      tableName: 'xc_knex_migrations_docs_content',
    });
    return true;
  }
}
