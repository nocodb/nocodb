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
import * as nc_019_model_stat_extra from './v3/nc_019_model_stat_extra';
import * as nc_020_sso_client from './v3/nc_020_sso_client';
import * as nc_021_org from './v3/nc_021_org';
import * as nc_o22_org_image from './v3/nc_022_org_image';
import * as nc_023_tenant_isolation from './v3/nc_023_tenant_isolation';
import * as nc_024_junction_pk from './v3/nc_024_junction_pk';
import * as nc_025_integration from './v3/nc_025_integration';
import * as nc_026_button_column from './v3/nc_026_button_column';
import * as nc_027_invited_by from './v3/nc_027_invited_by';
import * as nc_028_integration_is_default from './v3/nc_028_integration_is_default';
import * as nc_029_encrypt_flag from './v3/nc_029_encrypt_flag';
import * as nc_030_integration_is_global from './v3/nc_030_integration_is_global';
import * as nc_031_snapshot from './v3/nc_031_snapshot';
import * as nc_032_attachment_mode from './v3/nc_032_attachment_mode';
import * as nc_033_custom_url from './v3/nc_033_custom_url';
import * as nc_034_custom_url_pk from './v3/nc_034_custom_url_pk';
import * as nc_035_missing_context_indexes from './v3/nc_035_missing_context_indexes';
import * as nc_036_scripts from './v3/nc_036_scripts';
import * as nc_037_rename_source from './v3/nc_037_rename_source';
import * as nc_038_plans_and_subscriptions from './v3/nc_038_plans_and_subscriptions';
import * as nc_039_plans_and_subscriptions_limits from './v3/nc_039_plans_and_subscriptions_limits';
import * as nc_040_workspace_sso from './v3/nc_040_workspace_sso';
import * as nc_041_loyal_workspace from './v3/nc_041_loyal_workspace';
import * as nc_042_api_automation_grace_period from './v3/nc_042_api_automation_grace_period';
import * as nc_043_subscription_schedules from './v3/nc_043_subscription_schedules';
import * as nc_044_script_col_rename from './v3/nc_044_script_col_rename';

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
      'nc_019_model_stat_extra',
      'nc_020_sso_client',
      'nc_021_org',
      'nc_o22_org_image',
      'nc_023_tenant_isolation',
      'nc_024_junction_pk',
      'nc_025_integration',
      'nc_026_button_column',
      'nc_027_invited_by',
      'nc_028_integration_is_default',
      'nc_029_encrypt_flag',
      'nc_030_integration_is_global',
      'nc_031_snapshot',
      'nc_032_attachment_mode',
      'nc_033_custom_url',
      'nc_034_custom_url_pk',
      'nc_035_missing_context_indexes',
      'nc_036_scripts',
      'nc_037_rename_source',
      'nc_038_plans_and_subscriptions',
      'nc_039_plans_and_subscriptions_limits',
      'nc_040_workspace_sso',
      'nc_041_loyal_workspace',
      'nc_042_api_automation_grace_period',
      'nc_043_subscription_schedules',
      'nc_044_script_col_rename',
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
      case 'nc_019_model_stat_extra':
        return nc_019_model_stat_extra;
      case 'nc_020_sso_client':
        return nc_020_sso_client;
      case 'nc_021_org':
        return nc_021_org;
      case 'nc_o22_org_image':
        return nc_o22_org_image;
      case 'nc_023_tenant_isolation':
        return nc_023_tenant_isolation;
      case 'nc_024_junction_pk':
        return nc_024_junction_pk;
      case 'nc_025_integration':
        return nc_025_integration;
      case 'nc_026_button_column':
        return nc_026_button_column;
      case 'nc_027_invited_by':
        return nc_027_invited_by;
      case 'nc_028_integration_is_default':
        return nc_028_integration_is_default;
      case 'nc_029_encrypt_flag':
        return nc_029_encrypt_flag;
      case 'nc_030_integration_is_global':
        return nc_030_integration_is_global;
      case 'nc_031_snapshot':
        return nc_031_snapshot;
      case 'nc_032_attachment_mode':
        return nc_032_attachment_mode;
      case 'nc_033_custom_url':
        return nc_033_custom_url;
      case 'nc_034_custom_url_pk':
        return nc_034_custom_url_pk;
      case 'nc_035_missing_context_indexes':
        return nc_035_missing_context_indexes;
      case 'nc_036_scripts':
        return nc_036_scripts;
      case 'nc_037_rename_source':
        return nc_037_rename_source;
      case 'nc_038_plans_and_subscriptions':
        return nc_038_plans_and_subscriptions;
      case 'nc_039_plans_and_subscriptions_limits':
        return nc_039_plans_and_subscriptions_limits;
      case 'nc_040_workspace_sso':
        return nc_040_workspace_sso;
      case 'nc_041_loyal_workspace':
        return nc_041_loyal_workspace;
      case 'nc_042_api_automation_grace_period':
        return nc_042_api_automation_grace_period;
      case 'nc_043_subscription_schedules':
        return nc_043_subscription_schedules;
      case 'nc_044_script_col_rename':
        return nc_044_script_col_rename;
    }
  }
}
