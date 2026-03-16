import * as nc_001_init from '~/meta/migrations/chat-messages/nc_001_init';
import * as nc_002_base_id from '~/meta/migrations/chat-messages/nc_002_base_id';

export default class XcMigrationSourceChatMessages {
  public getMigrations(): Promise<any> {
    return Promise.resolve(['nc_001_init', 'nc_002_base_id']);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_init':
        return nc_001_init;
      case 'nc_002_base_id':
        return nc_002_base_id;
    }
  }
}
