import * as nc_011 from './v2/nc_011';
import * as nc_012_alter_column_data_types from './v2/nc_012_alter_column_data_types';
import * as nc_013_sync_source from './v2/nc_013_sync_source';
import * as nc_014_alter_column_data_types from './v2/nc_014_alter_column_data_types';
import * as nc_015_add_meta_col_in_column_table from './v2/nc_015_add_meta_col_in_column_table';
import * as nc_016_alter_hooklog_payload_types from './v2/nc_016_alter_hooklog_payload_types';
import * as nc_017_add_user_token_version_column from './v2/nc_017_add_user_token_version_column';
import * as nc_018_add_meta_in_view from './v2/nc_018_add_meta_in_view';
import * as nc_019_add_meta_in_meta_tables from './v2/nc_019_add_meta_in_meta_tables';
import * as nc_020_kanban_view from './v2/nc_020_kanban_view';
import * as nc_021_add_fields_in_token from './v2/nc_021_add_fields_in_token';

// Create a custom migration source class
export default class XcMigrationSourcev2 {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'nc_011',
      'nc_012_alter_column_data_types',
      'nc_013_sync_source',
      'nc_014_alter_column_data_types',
      'nc_015_add_meta_col_in_column_table',
      'nc_016_alter_hooklog_payload_types',
      'nc_017_add_user_token_version_column',
      'nc_018_add_meta_in_view',
      'nc_019_add_meta_in_meta_tables',
      'nc_020_kanban_view',
      'nc_021_add_fields_in_token',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_011':
        return nc_011;
      case 'nc_012_alter_column_data_types':
        return nc_012_alter_column_data_types;
      case 'nc_013_sync_source':
        return nc_013_sync_source;
      case 'nc_014_alter_column_data_types':
        return nc_014_alter_column_data_types;
      case 'nc_015_add_meta_col_in_column_table':
        return nc_015_add_meta_col_in_column_table;
      case 'nc_016_alter_hooklog_payload_types':
        return nc_016_alter_hooklog_payload_types;
      case 'nc_017_add_user_token_version_column':
        return nc_017_add_user_token_version_column;
      case 'nc_018_add_meta_in_view':
        return nc_018_add_meta_in_view;
      case 'nc_019_add_meta_in_meta_tables':
        return nc_019_add_meta_in_meta_tables;
      case 'nc_020_kanban_view':
        return nc_020_kanban_view;
      case 'nc_021_add_fields_in_token':
        return nc_021_add_fields_in_token;
    }
  }
}
