import * as nc_001_init from './v0/nc_001_init';
import * as nc_002_teams from './v0/nc_002_teams';
import * as nc_003_alter_row_color_condition_nc_order_col from './v0/nc_003_alter_row_color_condition_nc_order_col';
import * as nc_004_workflows from './v0/nc_004_workflows';
import * as nc_005_add_user_specific_and_meta_column_in_sync_configs from './v0/nc_005_add_user_specific_and_meta_column_in_sync_configs';
import * as nc_006_dependency_slots from './v0/nc_006_dependency_slots';
import * as nc_007_workflow_draft from './v0/nc_007_workflow_draft';
import * as nc_008_license_server from './v0/nc_008_license_server';
import * as nc_009_dependency_tracker_timestamp from './v0/nc_009_dependency_tracker_timestamp';
import * as nc_010_add_constraints_col_in_column_table from './v0/nc_010_add_constraints_col_in_column_table';
import * as nc_011_merge_workflows_scripts from './v0/nc_011_merge_workflows_scripts';
import * as nc_012_workflow_delay from './v0/nc_012_workflow_delay';
import * as nc_013_composite_pk_missing_tables from './v0/nc_013_composite_pk_missing_tables';
import * as nc_014_sandboxes from './v0/nc_014_sandboxes';

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
      'nc_006_dependency_slots',
      'nc_007_workflow_draft',
      'nc_008_license_server',
      'nc_009_dependency_tracker_timestamp',
      'nc_010_add_constraints_col_in_column_table',
      'nc_011_merge_workflows_scripts',
      'nc_012_workflow_delay',
      'nc_013_composite_pk_missing_tables',
      'nc_014_sandboxes',
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
      case 'nc_006_dependency_slots':
        return nc_006_dependency_slots;
      case 'nc_007_workflow_draft':
        return nc_007_workflow_draft;
      case 'nc_008_license_server':
        return nc_008_license_server;
      case 'nc_009_dependency_tracker_timestamp':
        return nc_009_dependency_tracker_timestamp;
      case 'nc_010_add_constraints_col_in_column_table':
        return nc_010_add_constraints_col_in_column_table;
      case 'nc_011_merge_workflows_scripts':
        return nc_011_merge_workflows_scripts;
      case 'nc_012_workflow_delay':
        return nc_012_workflow_delay;
      case 'nc_013_composite_pk_missing_tables':
        return nc_013_composite_pk_missing_tables;
      case 'nc_014_sandboxes':
        return nc_014_sandboxes;
    }
  }
}
