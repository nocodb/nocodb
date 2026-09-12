import * as nc_001_init from '~/meta/migrations/docs-content/nc_001_init';
import * as nc_002_doc_revisions from '~/meta/migrations/docs-content/nc_002_doc_revisions';
import * as nc_003_yjs_state from '~/meta/migrations/docs-content/nc_003_yjs_state';

export default class XcMigrationSourceDocsContent {
  public getMigrations(): Promise<any> {
    return Promise.resolve([
      'nc_001_init',
      'nc_002_doc_revisions',
      'nc_003_yjs_state',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_init':
        return nc_001_init;
      case 'nc_002_doc_revisions':
        return nc_002_doc_revisions;
      case 'nc_003_yjs_state':
        return nc_003_yjs_state;
    }
  }
}
