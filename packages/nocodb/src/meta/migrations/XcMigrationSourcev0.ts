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
import * as nc_015_managed_apps from './v0/nc_015_managed_apps';
import * as nc_016_automation_error_notifications from './v0/nc_016_automation_error_notifications';
import * as nc_017_add_canonical_email_to_users from './v0/nc_017_add_canonical_email_to_users';
import * as nc_018_add_enabled_to_filter_exp_v2 from './v0/nc_018_add_enabled_to_filter_exp_v2';
import * as nc_019_sandboxes from './v0/nc_019_sandboxes';
import * as nc_020_add_cell_coloring_fields_to_row_color_conditions from './v0/nc_020_add_cell_coloring_fields_to_row_color_conditions';
import * as nc_021_scim_support from './v0/nc_021_scim_support';
import * as nc_022_record_templates from './v0/nc_022_record_templates';
import * as nc_023_rls_policies from './v0/nc_023_rls_policies';
import * as nc_202601010000_placeholder from './v0/nc_202601010000_placeholder';
import * as nc_202602250000_outline_view from './v0/nc_202602250000_outline_view';
import * as nc_202602250001_button_filter from './v0/nc_202602250001_button_filter';
import * as nc_202602260000_rename_outline_to_list_view from './v0/nc_202602260000_rename_outline_to_list_view';
import * as nc_202602260636_view_sections from './v0/nc_202602260636_view_sections';
import * as nc_202602251401_links_v2 from './v0/nc_202602251401_links_v2';
import * as nc_202602270448_map_view_columns_add_source_id from './v0/nc_202602270448_map_view_columns_add_source_id';
import * as nc_202602270729_timeline_view from './v0/nc_202602270729_timeline_view';
import * as nc_202602260000_unify_ce_roles from './v0/nc_202602260000_unify_ce_roles';
import * as nc_202603020000_hook_error_notifications from './v0/nc_202603020000_hook_error_notifications';
import * as nc_202603020001_teams_hierarchy from './v0/nc_202603020001_teams_hierarchy';
import * as nc_202603020002_chat from './v0/nc_202603020002_chat';
import * as nc_202603060621_form_page_breaks from './v0/nc_202603060621_form_page_breaks';
import * as nc_202603050000_docs from './v0/nc_202603050000_docs';
import * as nc_202603050001_file_ref_doc_idx from './v0/nc_202603050001_file_ref_doc_idx';
import * as nc_202603090001_chat_session_meta from './v0/nc_202603090001_chat_session_meta';
import * as nc_202603110001_chat_session_base_id from './v0/nc_202603110001_chat_session_base_id';
import * as nc_202603170000_form_view_expires_at from './v0/nc_202603170000_form_view_expires_at';
import * as nc_202603170001_workflow_draft_reminder from './v0/nc_202603170001_workflow_draft_reminder';
import * as nc_202603180000_user_mfa from './v0/nc_202603180000_user_mfa';
import * as nc_202603090002_date_dependency from './v0/nc_202603090002_date_dependency';
import * as nc_202603230000_subscription_last_paid_seat_count from './v0/nc_202603230000_subscription_last_paid_seat_count';
import * as nc_202603301109_fine_grained_api_tokens from './v0/nc_202603301109_fine_grained_api_tokens';
import * as nc_202603310000_integration_links from './v0/nc_202603310000_integration_links';
import * as nc_202604030000_installations_add_fk_user_id from './v0/nc_202604030000_installations_add_fk_user_id';
import * as nc_202604040000_gcp_marketplace from './v0/nc_202604040000_gcp_marketplace';
import * as nc_202604071200_default_org from './v0/nc_202604071200_default_org';
import * as nc_202604071201_scim_config_default_role from './v0/nc_202604071201_scim_config_default_role';
import * as nc_202604100000_audit_org_id from './v0/nc_202604100000_audit_org_id';
import * as nc_202604160000_docs_in_data from './v0/nc_202604160000_docs_in_data';
import * as nc_202604200002_trash_cleanup_due_at from './v0/nc_202604200002_trash_cleanup_due_at';

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
      'nc_015_managed_apps',
      'nc_016_automation_error_notifications',
      'nc_017_add_canonical_email_to_users',
      'nc_018_add_enabled_to_filter_exp_v2',
      'nc_019_sandboxes',
      'nc_020_add_cell_coloring_fields_to_row_color_conditions',
      'nc_021_scim_support',
      'nc_022_record_templates',
      'nc_023_rls_policies',
      'nc_202601010000_placeholder',
      'nc_202602250000_outline_view',
      'nc_202602250001_button_filter',
      'nc_202602260000_rename_outline_to_list_view',
      'nc_202602260636_view_sections',
      'nc_202602251401_links_v2',
      'nc_202602270448_map_view_columns_add_source_id',
      'nc_202602270729_timeline_view',
      'nc_202602260000_unify_ce_roles',
      'nc_202603020000_hook_error_notifications',
      'nc_202603020001_teams_hierarchy',
      'nc_202603020002_chat',
      'nc_202603060621_form_page_breaks',
      'nc_202603050000_docs',
      'nc_202603050001_file_ref_doc_idx',
      'nc_202603090001_chat_session_meta',
      'nc_202603110001_chat_session_base_id',
      'nc_202603170000_form_view_expires_at',
      'nc_202603170001_workflow_draft_reminder',
      'nc_202603090002_date_dependency',
      'nc_202603230000_subscription_last_paid_seat_count',
      'nc_202603301109_fine_grained_api_tokens',
      'nc_202603310000_integration_links',
      'nc_202604030000_installations_add_fk_user_id',
      'nc_202604040000_gcp_marketplace',
      'nc_202604071200_default_org',
      'nc_202604071201_scim_config_default_role',
      'nc_202604100000_audit_org_id',
      'nc_202604160000_docs_in_data',
      'nc_202604200002_trash_cleanup_due_at',
      'nc_202603180000_user_mfa',
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
      case 'nc_015_managed_apps':
        return nc_015_managed_apps;
      case 'nc_016_automation_error_notifications':
        return nc_016_automation_error_notifications;
      case 'nc_017_add_canonical_email_to_users':
        return nc_017_add_canonical_email_to_users;
      case 'nc_018_add_enabled_to_filter_exp_v2':
        return nc_018_add_enabled_to_filter_exp_v2;
      case 'nc_019_sandboxes':
        return nc_019_sandboxes;
      case 'nc_020_add_cell_coloring_fields_to_row_color_conditions':
        return nc_020_add_cell_coloring_fields_to_row_color_conditions;
      case 'nc_021_scim_support':
        return nc_021_scim_support;
      case 'nc_022_record_templates':
        return nc_022_record_templates;
      case 'nc_023_rls_policies':
        return nc_023_rls_policies;
      case 'nc_202601010000_placeholder':
        return nc_202601010000_placeholder;
      case 'nc_202602250000_outline_view':
        return nc_202602250000_outline_view;
      case 'nc_202602250001_button_filter':
        return nc_202602250001_button_filter;
      case 'nc_202602260000_rename_outline_to_list_view':
        return nc_202602260000_rename_outline_to_list_view;
      case 'nc_202602260636_view_sections':
        return nc_202602260636_view_sections;
      case 'nc_202602251401_links_v2':
        return nc_202602251401_links_v2;
      case 'nc_202602270448_map_view_columns_add_source_id':
        return nc_202602270448_map_view_columns_add_source_id;
      case 'nc_202602270729_timeline_view':
        return nc_202602270729_timeline_view;
      case 'nc_202602260000_unify_ce_roles':
        return nc_202602260000_unify_ce_roles;
      case 'nc_202603020000_hook_error_notifications':
        return nc_202603020000_hook_error_notifications;
      case 'nc_202603020001_teams_hierarchy':
        return nc_202603020001_teams_hierarchy;
      case 'nc_202603020002_chat':
        return nc_202603020002_chat;
      case 'nc_202603060621_form_page_breaks':
        return nc_202603060621_form_page_breaks;
      case 'nc_202603050000_docs':
        return nc_202603050000_docs;
      case 'nc_202603050001_file_ref_doc_idx':
        return nc_202603050001_file_ref_doc_idx;
      case 'nc_202603090001_chat_session_meta':
        return nc_202603090001_chat_session_meta;
      case 'nc_202603110001_chat_session_base_id':
        return nc_202603110001_chat_session_base_id;
      case 'nc_202603170000_form_view_expires_at':
        return nc_202603170000_form_view_expires_at;
      case 'nc_202603170001_workflow_draft_reminder':
        return nc_202603170001_workflow_draft_reminder;
      case 'nc_202603090002_date_dependency':
        return nc_202603090002_date_dependency;
      case 'nc_202603230000_subscription_last_paid_seat_count':
        return nc_202603230000_subscription_last_paid_seat_count;
      case 'nc_202603301109_fine_grained_api_tokens':
        return nc_202603301109_fine_grained_api_tokens;
      case 'nc_202603310000_integration_links':
        return nc_202603310000_integration_links;
      case 'nc_202604030000_installations_add_fk_user_id':
        return nc_202604030000_installations_add_fk_user_id;
      case 'nc_202604040000_gcp_marketplace':
        return nc_202604040000_gcp_marketplace;
      case 'nc_202604071200_default_org':
        return nc_202604071200_default_org;
      case 'nc_202604071201_scim_config_default_role':
        return nc_202604071201_scim_config_default_role;
      case 'nc_202604100000_audit_org_id':
        return nc_202604100000_audit_org_id;
      case 'nc_202604160000_docs_in_data':
        return nc_202604160000_docs_in_data;
      case 'nc_202604200002_trash_cleanup_due_at':
        return nc_202604200002_trash_cleanup_due_at;
      case 'nc_202603180000_user_mfa':
        return nc_202603180000_user_mfa;
    }
  }
}
