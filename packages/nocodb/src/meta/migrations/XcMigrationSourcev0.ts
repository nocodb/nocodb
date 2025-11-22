import * as nc_001_init from './v0/nc_001_init';
import * as nc_002_teams from './v0/nc_002_teams';
import * as nc_003_alter_row_color_condition_nc_order_col from './v0/nc_003_alter_row_color_condition_nc_order_col';
import * as nc_004_workflows from './v0/nc_004_workflows';
import * as nc_005_add_user_specific_and_meta_column_in_sync_configs from './v0/nc_005_add_user_specific_and_meta_column_in_sync_configs';

// Create a custom migration source class
export default class XcMigrationSourcev0 {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'nc_001_init',
      'nc_002_teams',
      'nc_003_alter_row_color_condition_nc_order_col',
      'nc_004_workflows',
      'nc_005_add_user_specific_and_meta_column_in_sync_configs',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_init':
        return nc_001_init;
      case 'nc_002_teams':
        return nc_002_teams;
      case 'nc_003_alter_row_color_condition_nc_order_col':
        return nc_003_alter_row_color_condition_nc_order_col;
      case 'nc_004_workflows':
        return nc_004_workflows;
      case 'nc_005_add_user_specific_and_meta_column_in_sync_configs':
        return nc_005_add_user_specific_and_meta_column_in_sync_configs;
    }
  }
}
