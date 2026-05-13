import * as nc_001_init from '~/meta/migrations/operation-logs/nc_001_init';

// Custom migration source for the NC_OP_LOG_DB satellite. The same
// schema runs against the meta DB via the v0 migration when the
// satellite is not configured.
export default class XcMigrationSourceOperationLogs {
  public getMigrations(): Promise<any> {
    return Promise.resolve(['nc_001_init']);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_init':
        return nc_001_init;
    }
  }
}
