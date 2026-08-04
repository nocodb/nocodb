import * as nc_001_init from '~/meta/migrations/chat-messages/nc_001_init';
import * as nc_002_base_id from '~/meta/migrations/chat-messages/nc_002_base_id';
import * as nc_003_created_files from '~/meta/migrations/chat-messages/nc_003_created_files';
import * as nc_004_ui_context_record from '~/meta/migrations/chat-messages/nc_004_ui_context_record';

export default class XcMigrationSourceChatMessages {
  public getMigrations(): Promise<any> {
    return Promise.resolve([
      'nc_001_init',
      'nc_002_base_id',
      'nc_003_created_files',
      'nc_004_ui_context_record',
    ]);
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
      case 'nc_003_created_files':
        return nc_003_created_files;
      case 'nc_004_ui_context_record':
        return nc_004_ui_context_record;
    }
  }
}
