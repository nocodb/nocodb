import * as nc_001_init from '~/meta/migrations/chat-messages/nc_001_init';

export default class XcMigrationSourceChatMessages {
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
