import * as nc_011 from '~/meta/migrations/v2/nc_011';
import * as nc_012_alter_column_data_types from '~/meta/migrations/v2/nc_012_alter_column_data_types';
import * as nc_013_sync_source from '~/meta/migrations/v2/nc_013_sync_source';
import * as nc_014_alter_column_data_types from '~/meta/migrations/v2/nc_014_alter_column_data_types';
import * as nc_015_add_meta_col_in_column_table from '~/meta/migrations/v2/nc_015_add_meta_col_in_column_table';
import * as nc_016_alter_hooklog_payload_types from '~/meta/migrations/v2/nc_016_alter_hooklog_payload_types';
import * as nc_017_add_user_token_version_column from '~/meta/migrations/v2/nc_017_add_user_token_version_column';
import * as nc_018_add_meta_in_view from '~/meta/migrations/v2/nc_018_add_meta_in_view';
import * as nc_019_add_meta_in_meta_tables from '~/meta/migrations/v2/nc_019_add_meta_in_meta_tables';
import * as nc_020_kanban_view from '~/meta/migrations/v2/nc_020_kanban_view';
import * as nc_021_add_fields_in_token from '~/meta/migrations/v2/nc_021_add_fields_in_token';
import * as nc_022_qr_code_column_type from '~/meta/migrations/v2/nc_022_qr_code_column_type';
import * as nc_023_multiple_source from '~/meta/migrations/v2/nc_023_multiple_source';
import * as nc_024_barcode_column_type from '~/meta/migrations/v2/nc_024_barcode_column_type';
import * as nc_025_add_row_height from '~/meta/migrations/v2/nc_025_add_row_height';
import * as nc_026_map_view from '~/meta/migrations/v2/nc_026_map_view';
import * as nc_027_add_comparison_sub_op from '~/meta/migrations/v2/nc_027_add_comparison_sub_op';
import * as nc_028_add_enable_scanner_in_form_columns_meta_table from '~/meta/migrations/v2/nc_028_add_enable_scanner_in_form_columns_meta_table';
import * as nc_029_webhook from '~/meta/migrations/v2/nc_029_webhook';
import * as nc_030_add_description_field from '~/meta/migrations/v2/nc_030_add_description_field';
import * as nc_031_remove_fk_and_add_idx from '~/meta/migrations/v2/nc_031_remove_fk_and_add_idx';
import * as nc_033_add_group_by from '~/meta/migrations/v2/nc_033_add_group_by';
import * as nc_034_erd_filter_and_notification from '~/meta/migrations/v2/nc_034_erd_filter_and_notification';
import * as nc_035_add_username_to_users from '~/meta/migrations/v2/nc_035_add_username_to_users';
import * as nc_036_base_deleted from '~/meta/migrations/v2/nc_036_base_deleted';
import * as nc_037_rename_project_and_base from '~/meta/migrations/v2/nc_037_rename_project_and_base';
import * as nc_038_formula_parsed_tree_column from '~/meta/migrations/v2/nc_038_formula_parsed_tree_column';
import * as nc_039_sqlite_alter_column_types from '~/meta/migrations/v2/nc_039_sqlite_alter_column_types';
import * as nc_040_form_view_alter_column_types from '~/meta/migrations/v2/nc_040_form_view_alter_column_types';
import * as nc_041_calendar_view from '~/meta/migrations/v2/nc_041_calendar_view';
import * as nc_042_user_block from '~/meta/migrations/v2/nc_042_user_block';
import * as nc_043_user_refresh_token from '~/meta/migrations/v2/nc_043_user_refresh_token';
import * as nc_044_view_column_index from '~/meta/migrations/v2/nc_044_view_column_index';
import * as nc_045_extensions from '~/meta/migrations/v2/nc_045_extensions';
import * as nc_046_comment_mentions from '~/meta/migrations/v2/nc_046_comment_mentions';
import * as nc_047_comment_migration from '~/meta/migrations/v2/nc_047_comment_migration';
import * as nc_048_view_links from '~/meta/migrations/v2/nc_048_view_links';
import * as nc_049_clear_notifications from '~/meta/migrations/v2/nc_049_clear_notifications';
import * as nc_050_tenant_isolation from '~/meta/migrations/v2/nc_050_tenant_isolation';
import * as nc_051_source_readonly_columns from '~/meta/migrations/v2/nc_051_source_readonly_columns';
import * as nc_052_field_aggregation from '~/meta/migrations/v2/nc_052_field_aggregation';
import * as nc_053_jobs from '~/meta/migrations/v2/nc_053_jobs';
import * as nc_054_id_length from '~/meta/migrations/v2/nc_054_id_length';
import * as nc_055_junction_pk from '~/meta/migrations/v2/nc_055_junction_pk';
import * as nc_056_integration from '~/meta/migrations/v2/nc_056_integration';
import * as nc_057_file_references from '~/meta/migrations/v2/nc_057_file_references';
import * as nc_058_button_colum from '~/meta/migrations/v2/nc_058_button_colum';
import * as nc_059_invited_by from '~/meta/migrations/v2/nc_059_invited_by';
import * as nc_060_descriptions from '~/meta/migrations/v2/nc_060_descriptions';
import * as nc_061_integration_is_default from '~/meta/migrations/v2/nc_061_integration_is_default';
import * as nc_062_integration_store from '~/meta/migrations/v2/nc_062_integration_store';
import * as nc_063_form_field_filter from '~/meta/migrations/v2/nc_063_form_field_filter';
import * as nc_064_pg_minimal_dbs from '~/meta/migrations/v2/nc_064_pg_minimal_dbs';
import * as nc_065_encrypt_flag from '~/meta/migrations/v2/nc_065_encrypt_flag';
import * as nc_066_ai_button from '~/meta/migrations/v2/nc_066_ai_button';
import * as nc_067_personal_view from '~/meta/migrations/v2/nc_067_personal_view';
import * as nc_068_user_delete from '~/meta/migrations/v2/nc_068_user_delete';
import * as nc_069_ai_prompt from '~/meta/migrations/v2/nc_069_ai_prompt';
import * as nc_070_data_reflection from '~/meta/migrations/v2/nc_070_data_reflection';
import * as nc_071_add_meta_in_users from '~/meta/migrations/v2/nc_071_add_meta_in_users';
import * as nc_072_col_button_pk from '~/meta/migrations/v2/nc_072_col_button_pk';
import * as nc_073_file_reference_indexes from '~/meta/migrations/v2/nc_073_file_reference_indexes';
import * as nc_074_missing_context_indexes from '~/meta/migrations/v2/nc_074_missing_context_indexes';
import * as nc_075_audit_refactor from '~/meta/migrations/v2/nc_075_audit_refactor';

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
      'nc_022_qr_code_column_type',
      'nc_023_multiple_source',
      'nc_024_barcode_column_type',
      'nc_025_add_row_height',
      'nc_026_map_view',
      'nc_027_add_comparison_sub_op',
      'nc_028_add_enable_scanner_in_form_columns_meta_table',
      'nc_029_webhook',
      'nc_030_add_description_field',
      'nc_031_remove_fk_and_add_idx',
      'nc_033_add_group_by',
      'nc_034_erd_filter_and_notification',
      'nc_035_add_username_to_users',
      'nc_036_base_deleted',
      'nc_037_rename_project_and_base',
      'nc_038_formula_parsed_tree_column',
      'nc_039_sqlite_alter_column_types',
      'nc_040_form_view_alter_column_types',
      'nc_041_calendar_view',
      'nc_042_user_block',
      'nc_043_user_refresh_token',
      'nc_044_view_column_index',
      'nc_045_extensions',
      'nc_046_comment_mentions',
      'nc_047_comment_migration',
      'nc_048_view_links',
      'nc_049_clear_notifications',
      'nc_050_tenant_isolation',
      'nc_051_source_readonly_columns',
      'nc_052_field_aggregation',
      'nc_053_jobs',
      'nc_054_id_length',
      'nc_055_junction_pk',
      'nc_056_integration',
      'nc_057_file_references',
      'nc_058_button_colum',
      'nc_059_invited_by',
      'nc_060_descriptions',
      'nc_061_integration_is_default',
      'nc_062_integration_store',
      'nc_063_form_field_filter',
      'nc_064_pg_minimal_dbs',
      'nc_065_encrypt_flag',
      'nc_066_ai_button',
      'nc_067_personal_view',
      'nc_068_user_delete',
      'nc_069_ai_prompt',
      'nc_070_data_reflection',
      'nc_071_add_meta_in_users',
      'nc_072_col_button_pk',
      'nc_073_file_reference_indexes',
      'nc_074_missing_context_indexes',
      'nc_075_audit_refactor',
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
      case 'nc_022_qr_code_column_type':
        return nc_022_qr_code_column_type;
      case 'nc_023_multiple_source':
        return nc_023_multiple_source;
      case 'nc_024_barcode_column_type':
        return nc_024_barcode_column_type;
      case 'nc_025_add_row_height':
        return nc_025_add_row_height;
      case 'nc_026_map_view':
        return nc_026_map_view;
      case 'nc_027_add_comparison_sub_op':
        return nc_027_add_comparison_sub_op;
      case 'nc_028_add_enable_scanner_in_form_columns_meta_table':
        return nc_028_add_enable_scanner_in_form_columns_meta_table;
      case 'nc_029_webhook':
        return nc_029_webhook;
      case 'nc_030_add_description_field':
        return nc_030_add_description_field;
      case 'nc_031_remove_fk_and_add_idx':
        return nc_031_remove_fk_and_add_idx;
      case 'nc_033_add_group_by':
        return nc_033_add_group_by;
      case 'nc_034_erd_filter_and_notification':
        return nc_034_erd_filter_and_notification;
      case 'nc_035_add_username_to_users':
        return nc_035_add_username_to_users;
      case 'nc_036_base_deleted':
        return nc_036_base_deleted;
      case 'nc_037_rename_project_and_base':
        return nc_037_rename_project_and_base;
      case 'nc_038_formula_parsed_tree_column':
        return nc_038_formula_parsed_tree_column;
      case 'nc_039_sqlite_alter_column_types':
        return nc_039_sqlite_alter_column_types;
      case 'nc_040_form_view_alter_column_types':
        return nc_040_form_view_alter_column_types;
      case 'nc_041_calendar_view':
        return nc_041_calendar_view;
      case 'nc_042_user_block':
        return nc_042_user_block;
      case 'nc_043_user_refresh_token':
        return nc_043_user_refresh_token;
      case 'nc_044_view_column_index':
        return nc_044_view_column_index;
      case 'nc_045_extensions':
        return nc_045_extensions;
      case 'nc_046_comment_mentions':
        return nc_046_comment_mentions;
      case 'nc_047_comment_migration':
        return nc_047_comment_migration;
      case 'nc_048_view_links':
        return nc_048_view_links;
      case 'nc_049_clear_notifications':
        return nc_049_clear_notifications;
      case 'nc_050_tenant_isolation':
        return nc_050_tenant_isolation;
      case 'nc_051_source_readonly_columns':
        return nc_051_source_readonly_columns;
      case 'nc_052_field_aggregation':
        return nc_052_field_aggregation;
      case 'nc_053_jobs':
        return nc_053_jobs;
      case 'nc_054_id_length':
        return nc_054_id_length;
      case 'nc_055_junction_pk':
        return nc_055_junction_pk;
      case 'nc_056_integration':
        return nc_056_integration;
      case 'nc_057_file_references':
        return nc_057_file_references;
      case 'nc_058_button_colum':
        return nc_058_button_colum;
      case 'nc_059_invited_by':
        return nc_059_invited_by;
      case 'nc_060_descriptions':
        return nc_060_descriptions;
      case 'nc_061_integration_is_default':
        return nc_061_integration_is_default;
      case 'nc_062_integration_store':
        return nc_062_integration_store;
      case 'nc_063_form_field_filter':
        return nc_063_form_field_filter;
      case 'nc_064_pg_minimal_dbs':
        return nc_064_pg_minimal_dbs;
      case 'nc_065_encrypt_flag':
        return nc_065_encrypt_flag;
      case 'nc_066_ai_button':
        return nc_066_ai_button;
      case 'nc_067_personal_view':
        return nc_067_personal_view;
      case 'nc_068_user_delete':
        return nc_068_user_delete;
      case 'nc_069_ai_prompt':
        return nc_069_ai_prompt;
      case 'nc_070_data_reflection':
        return nc_070_data_reflection;
      case 'nc_071_add_meta_in_users':
        return nc_071_add_meta_in_users;
      case 'nc_072_col_button_pk':
        return nc_072_col_button_pk;
      case 'nc_073_file_reference_indexes':
        return nc_073_file_reference_indexes;
      case 'nc_074_missing_context_indexes':
        return nc_074_missing_context_indexes;
      case 'nc_075_audit_refactor':
        return nc_075_audit_refactor;
    }
  }
}
