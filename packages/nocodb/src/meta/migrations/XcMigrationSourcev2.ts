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
    }
  }
}
