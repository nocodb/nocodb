import { MetaTable, MetaTableOld } from '../../utils/globals';
import { Knex } from 'knex';

/***
 * Rename v2 meta tables
 *
 * "nc_audit_v2" => "audit"
 * "nc_project_users_v2" => "auth_project_user"
 * "nc_users_v2" => "auth_users"
 * "nc_bases_v2" => "dbs"
 * "nc_col_formula_v2" => "db_col_formula"
 * "nc_col_lookup_v2" => "db_col_lookup"
 * "nc_col_qrcode_v2" => "db_col_qrcode"
 * "nc_col_relations_v2" => "db_col_relation"
 * "nc_col_rollup_v2" => "db_col_rollup"
 * "nc_col_select_options_v2" => "db_col_select_option"
 * "nc_columns_v2" => "db_col"
 * "nc_disabled_models_for_role_v2" => "db_disabled_models_for_role"
 * "nc_filter_exp_v2" => "db_filter_exp"
 * "nc_form_view_v2" => "db_form_view"
 * "nc_form_view_columns_v2" => "db_form_view_column"
 * "nc_gallery_view_v2" => "db_gallery_view"
 * "nc_gallery_view_columns_v2" => "db_gallery_view_column"
 * "nc_grid_view_v2" => "db_grid_view"
 * "nc_grid_view_columns_v2" => "db_grid_view_column"
 * "nc_hook_logs_v2" => "db_webhook_log"
 * "nc_hooks_v2" => "db_webhook"
 * "nc_kanban_view_v2" => "db_kanban_view"
 * "nc_kanban_view_columns_v2" => "db_kanban_view_column"
 * "nc_models_v2" => "db_model"
 * "nc_shared_views_v2" => "db_shared_view"
 * "nc_sort_v2" => "db_sort"
 * "nc_sync_logs_v2" => "db_sync_log"
 * "nc_sync_source_v2" => "db_sync_source"
 * "nc_views_v2" => "db_view"
 * "nc_plugins_v2" => "plugin"
 * "nc_projects_v2" => "project"
 * "nc_store" => "store"
 * "nc_api_tokens" => "api_token"
 *
 *****/

const up = async (knex: Knex) => {
  await knex.schema.renameTable(MetaTableOld.AUDIT, MetaTable.AUDIT);
  await knex.schema.renameTable(
    MetaTableOld.PROJECT_USERS,
    MetaTable.PROJECT_USER
  );
  await knex.schema.renameTable(MetaTableOld.USERS, MetaTable.USER);
  await knex.schema.renameTable(MetaTableOld.BASES, MetaTable.BASE);
  await knex.schema.renameTable(MetaTableOld.COL_LOOKUP, MetaTable.COL_LOOKUP);
  await knex.schema.renameTable(MetaTableOld.COL_ROLLUP, MetaTable.COL_ROLLUP);
  await knex.schema.renameTable(
    MetaTableOld.COL_FORMULA,
    MetaTable.COL_FORMULA
  );
  await knex.schema.renameTable(MetaTableOld.COL_QRCODE, MetaTable.COL_QRCODE);
  await knex.schema.renameTable(
    MetaTableOld.COL_RELATIONS,
    MetaTable.COL_RELATION
  );
  await knex.schema.renameTable(
    MetaTableOld.COL_SELECT_OPTIONS,
    MetaTable.COL_SELECT_OPTION
  );
  await knex.schema.renameTable(MetaTableOld.COLUMNS, MetaTable.COLUMN);
  await knex.schema.renameTable(
    MetaTableOld.MODEL_ROLE_VISIBILITY,
    MetaTable.MODEL_ROLE_VISIBILITY
  );
  await knex.schema.renameTable(MetaTableOld.FILTER_EXP, MetaTable.FILTER_EXP);
  await knex.schema.renameTable(MetaTableOld.FORM_VIEW, MetaTable.FORM_VIEW);
  await knex.schema.renameTable(
    MetaTableOld.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW_COLUMN
  );
  await knex.schema.renameTable(
    MetaTableOld.GALLERY_VIEW,
    MetaTable.GALLERY_VIEW
  );
  await knex.schema.renameTable(
    MetaTableOld.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW_COLUMN
  );
  await knex.schema.renameTable(MetaTableOld.GRID_VIEW, MetaTable.GRID_VIEW);
  await knex.schema.renameTable(
    MetaTableOld.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW_COLUMN
  );
  await knex.schema.renameTable(MetaTableOld.HOOK_LOGS, MetaTable.HOOK_LOG);
  await knex.schema.renameTable(MetaTableOld.HOOKS, MetaTable.HOOK);
  await knex.schema.renameTable(
    MetaTableOld.KANBAN_VIEW,
    MetaTable.KANBAN_VIEW
  );
  await knex.schema.renameTable(
    MetaTableOld.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW_COLUMN
  );

  await knex.schema.renameTable(MetaTableOld.MODELS, MetaTable.MODEL);
  await knex.schema.renameTable(
    MetaTableOld.SHARED_VIEWS,
    MetaTable.SHARED_VIEWS
  );
  await knex.schema.renameTable(MetaTableOld.SORT, MetaTable.SORT);
  await knex.schema.renameTable(MetaTableOld.SYNC_LOGS, MetaTable.SYNC_LOG);
  await knex.schema.renameTable(
    MetaTableOld.SYNC_SOURCE,
    MetaTable.SYNC_SOURCE
  );
  await knex.schema.renameTable(MetaTableOld.VIEWS, MetaTable.VIEW);
  await knex.schema.renameTable(MetaTableOld.PLUGIN, MetaTable.PLUGIN);
  await knex.schema.renameTable(MetaTableOld.PROJECT, MetaTable.PROJECT);
  await knex.schema.renameTable(MetaTableOld.STORE, MetaTable.STORE);

  await knex.schema.renameTable(MetaTableOld.API_TOKENS, MetaTable.API_TOKEN);
};

const down = async (knex: Knex) => {
  await knex.schema.renameTable(MetaTable.AUDIT, MetaTableOld.AUDIT);
  await knex.schema.renameTable(
    MetaTable.PROJECT_USER,
    MetaTableOld.PROJECT_USERS
  );
  await knex.schema.renameTable(MetaTable.USER, MetaTableOld.USERS);
  await knex.schema.renameTable(MetaTable.BASE, MetaTableOld.BASES);
  await knex.schema.renameTable(
    MetaTable.FORM_VIEW_COLUMN,
    MetaTableOld.FORM_VIEW_COLUMNS
  );
  await knex.schema.renameTable(MetaTable.COL_LOOKUP, MetaTableOld.COL_LOOKUP);
  await knex.schema.renameTable(MetaTable.COL_ROLLUP, MetaTableOld.COL_ROLLUP);
  await knex.schema.renameTable(
    MetaTable.COL_FORMULA,
    MetaTableOld.COL_FORMULA
  );
  await knex.schema.renameTable(MetaTable.COL_QRCODE, MetaTableOld.COL_QRCODE);
  await knex.schema.renameTable(
    MetaTable.COL_RELATION,
    MetaTableOld.COL_RELATIONS
  );
  await knex.schema.renameTable(
    MetaTable.COL_SELECT_OPTION,
    MetaTableOld.COL_SELECT_OPTIONS
  );
  await knex.schema.renameTable(MetaTable.COLUMN, MetaTableOld.COLUMNS);
  await knex.schema.renameTable(
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTableOld.MODEL_ROLE_VISIBILITY
  );
  await knex.schema.renameTable(MetaTable.FILTER_EXP, MetaTableOld.FILTER_EXP);
  await knex.schema.renameTable(MetaTable.FORM_VIEW, MetaTableOld.FORM_VIEW);
  await knex.schema.renameTable(
    MetaTable.FORM_VIEW_COLUMN,
    MetaTableOld.FORM_VIEW_COLUMNS
  );
  await knex.schema.renameTable(
    MetaTable.GALLERY_VIEW,
    MetaTableOld.GALLERY_VIEW
  );
  await knex.schema.renameTable(
    MetaTable.GALLERY_VIEW_COLUMN,
    MetaTableOld.GALLERY_VIEW_COLUMNS
  );
  await knex.schema.renameTable(MetaTable.GRID_VIEW, MetaTableOld.GRID_VIEW);
  await knex.schema.renameTable(
    MetaTable.GRID_VIEW_COLUMN,
    MetaTableOld.GRID_VIEW_COLUMNS
  );
  await knex.schema.renameTable(MetaTable.HOOK_LOG, MetaTableOld.HOOK_LOGS);
  await knex.schema.renameTable(MetaTable.HOOK, MetaTableOld.HOOKS);
  await knex.schema.renameTable(
    MetaTable.KANBAN_VIEW,
    MetaTableOld.KANBAN_VIEW
  );
  await knex.schema.renameTable(
    MetaTable.KANBAN_VIEW_COLUMN,
    MetaTableOld.KANBAN_VIEW_COLUMNS
  );

  await knex.schema.renameTable(MetaTable.MODEL, MetaTableOld.MODELS);
  await knex.schema.renameTable(
    MetaTable.SHARED_VIEWS,
    MetaTableOld.SHARED_VIEWS
  );
  await knex.schema.renameTable(MetaTable.SORT, MetaTableOld.SORT);
  await knex.schema.renameTable(MetaTable.SYNC_LOG, MetaTableOld.SYNC_LOGS);
  await knex.schema.renameTable(
    MetaTable.SYNC_SOURCE,
    MetaTableOld.SYNC_SOURCE
  );
  await knex.schema.renameTable(MetaTable.VIEW, MetaTableOld.VIEWS);
  await knex.schema.renameTable(MetaTable.PLUGIN, MetaTableOld.PLUGIN);
  await knex.schema.renameTable(MetaTable.PROJECT, MetaTableOld.PROJECT);
  await knex.schema.renameTable(MetaTable.STORE, MetaTableOld.STORE);
  await knex.schema.renameTable(MetaTable.API_TOKEN, MetaTableOld.API_TOKENS);
};

export { up, down };
