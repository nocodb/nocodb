import * as nc_001_add_type_to_project from './v3/nc_001_add_type_to_project';
import * as nc_002_create_books from './v3/nc_002_create_books';
import * as nc_003_workspace from './v3/nc_003_workspace';
import * as nc_004_profile_account from './v3/nc_004_profile_account';
import * as nc_005_cowriter from './v3/nc_005_cowriter';
import * as nc_006_shared_erd from './v3/nc_006_shared_erd';
import * as nc_007_add_last_snapshot_at_and_content_html_to_page from './v3/nc_007_add_last_snapshot_at_and_content_html_to_page';
import * as nc_008_dashboard from './v3/nc_008_dashboard';
import * as nc_009_add_last_snapshot_to_page from './v3/nc_009_add_last_snapshot_to_page';
import * as nc_010_add_appearance_config_to_layouts from './v3/nc_010_add_appearance_config_to_layouts';
import * as nc_011_workspace_infra_cols from './v3/nc_011_workspace_infra_cols';
import * as nc_012_pg_minimal_dbs from './v3/nc_012_pg_minimal_dbs';
import * as nc_013_remove_fk_and_add_idx from './v3/nc_013_remove_fk_and_add_idx';
import * as nc_014_notification from './v3/nc_014_notification';
import * as nc_015_filter_value from './v3/nc_015_filter_value';
import * as nc_016_rename_project_and_base from './v3/nc_016_rename_project_and_base';
import * as nc_017_model_stat from './v3/nc_017_model_stat';
import * as nc_018_sql_executor from './v3/nc_018_sql_executor';

// Create a custom migration source class
export default class XcMigrationSourcev3 {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'nc_001_add_type_to_project',
      'nc_002_create_books',
      'nc_003_workspace',
      'nc_004_profile_account',
      'nc_005_cowriter',
      'nc_006_shared_erd',
      'nc_007_add_last_snapshot_at_and_content_html_to_page',
      'nc_008_dashboard',
      'nc_009_add_last_snapshot_to_page',
      'nc_010_add_appearance_config_to_layouts',
      'nc_011_workspace_infra_cols',
      'nc_012_pg_minimal_dbs',
      'nc_013_remove_fk_and_add_idx',
      'nc_014_notification',
      'nc_015_filter_value',
      'nc_016_rename_project_and_base',
      'nc_017_model_stat',
      'nc_018_sql_executor',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'nc_001_add_type_to_project':
        return nc_001_add_type_to_project;
      case 'nc_002_create_books':
        return nc_002_create_books;
      case 'nc_003_workspace':
        return nc_003_workspace;
      case 'nc_004_profile_account':
        return nc_004_profile_account;
      case 'nc_005_cowriter':
        return nc_005_cowriter;
      case 'nc_006_shared_erd':
        return nc_006_shared_erd;
      case 'nc_007_add_last_snapshot_at_and_content_html_to_page':
        return nc_007_add_last_snapshot_at_and_content_html_to_page;
      case 'nc_008_dashboard':
        return nc_008_dashboard;
      case 'nc_009_add_last_snapshot_to_page':
        return nc_009_add_last_snapshot_to_page;
      case 'nc_010_add_appearance_config_to_layouts':
        return nc_010_add_appearance_config_to_layouts;
      case 'nc_011_workspace_infra_cols':
        return nc_011_workspace_infra_cols;
      case 'nc_012_pg_minimal_dbs':
        return nc_012_pg_minimal_dbs;
      case 'nc_013_remove_fk_and_add_idx':
        return nc_013_remove_fk_and_add_idx;
      case 'nc_014_notification':
        return nc_014_notification;
      case 'nc_015_filter_value':
        return nc_015_filter_value;
      case 'nc_016_rename_project_and_base':
        return nc_016_rename_project_and_base;
      case 'nc_017_model_stat':
        return nc_017_model_stat;
      case 'nc_018_sql_executor':
        return nc_018_sql_executor;
    }
  }
}
