import { OnDeleteAction } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // We avoid init for existing instances
  // They will be unified via packages/nocodb/src/meta/migrations/v2/nc_079_unify_schema.ts
  if (await knex.schema.hasTable('xc_knex_migrations')) {
    console.log('Skipping v0 migration for existing instance.');
    return;
  }

  await knex.schema.createTable(MetaTable.API_TOKENS, (table) => {
    table.increments('id').primary();
    table.string('base_id', 20);
    table.string('db_alias', 255);
    table.string('description', 255);
    table.text('permissions');
    table.text('token');
    table.string('expiry', 255);
    table.boolean('enabled').defaultTo(true);
    table.string('fk_user_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps();
  });

  await knex.schema.createTable(MetaTable.AUDIT, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('user', 255);
    table.string('ip', 255);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('row_id', 255);
    table.string('op_type', 255);
    table.string('op_sub_type', 255);
    table.string('status', 255);
    table.text('description');
    table.text('details');
    table.specificType('version', 'smallint').defaultTo(0);
    table.string('fk_user_id', 20);
    table.string('fk_ref_id', 20);
    table.string('fk_parent_id', 20);
    table.text('user_agent');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.PROJECT_USERS, (table) => {
    table.string('base_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.text('roles');
    table.boolean('starred');
    table.boolean('pinned');
    table.string('group', 255);
    table.string('color', 255);
    table.float('order');
    table.float('hidden');
    table.timestamp('opened_date');
    table.string('invited_by', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    // Composite primary key
    table.primary(['base_id', 'fk_user_id']);
  });

  await knex.schema.createTable(MetaTable.PROJECT, (table) => {
    table.string('id', 128);
    table.string('title', 255);
    table.string('prefix', 255);
    table.string('status', 255);
    table.text('description');
    table.text('meta');
    table.string('color', 255);
    table.string('uuid', 255);
    table.string('password', 255);
    table.string('roles', 255);
    table.boolean('deleted').defaultTo(false);
    table.boolean('is_meta');
    table.float('order');
    table.string('type', 200);
    table.string('fk_workspace_id', 20);
    table.boolean('is_snapshot').defaultTo(false);
    table.string('fk_custom_url_id', 20);
    table.timestamps(true, true);

    if (['pg', 'postgres'].includes(knex.client.config.client)) {
      table.primary(['id'], { constraintName: 'nc_projects_v2_pkey' });
    } else {
      table.primary(['id']);
    }
  });

  await knex.schema.createTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('show');
    table.boolean('bold');
    table.boolean('underline');
    table.boolean('italic');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.CALENDAR_VIEW_RANGE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_view_id', 20);
    table.string('fk_to_column_id', 20);
    table.string('label', 40);
    table.string('fk_from_column_id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.CALENDAR_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('title', 255);
    table.string('fk_cover_image_col_id', 20);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps();
  });

  await knex.schema.createTable(MetaTable.COL_BARCODE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.string('fk_barcode_value_column_id', 20);
    table.string('barcode_format', 15);
    table.boolean('deleted');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_BUTTON, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('type', 255);
    table.text('label');
    table.string('theme', 255);
    table.string('color', 255);
    table.string('icon', 255);
    table.text('formula');
    table.text('formula_raw');
    table.string('error', 255);
    table.text('parsed_tree');
    table.string('fk_webhook_id', 20);
    table.string('fk_column_id', 20);
    table.string('fk_integration_id', 20);
    table.string('model', 255);
    table.text('output_column_ids');
    table.string('fk_workspace_id', 20);
    table.string('fk_script_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_FORMULA, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.text('formula').notNullable();
    table.text('formula_raw');
    table.text('error');
    table.boolean('deleted');
    table.float('order');
    table.text('parsed_tree');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_LONG_TEXT, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('fk_column_id', 20);
    table.string('fk_integration_id', 20);
    table.string('model', 255);
    table.text('prompt');
    table.text('prompt_raw');
    table.text('error');
    table.timestamps(true, true);
  });

  // 14) nc_col_lookup_v2
  await knex.schema.createTable(MetaTable.COL_LOOKUP, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.string('fk_relation_column_id', 20);
    table.string('fk_lookup_column_id', 20);
    table.boolean('deleted');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_QRCODE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.string('fk_qr_value_column_id', 20);
    table.boolean('deleted');
    table.float('order');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('ref_db_alias', 255);
    table.string('type', 255);
    table.boolean('virtual');
    table.string('db_type', 255);
    table.string('fk_column_id', 20);
    table.string('fk_related_model_id', 20);
    table.string('fk_child_column_id', 20);
    table.string('fk_parent_column_id', 20);
    table.string('fk_mm_model_id', 20);
    table.string('fk_mm_child_column_id', 20);
    table.string('fk_mm_parent_column_id', 20);
    table.string('ur', 255);
    table.string('dr', 255);
    table.string('fk_index_name', 255);
    table.boolean('deleted');
    table.string('fk_target_view_id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_related_base_id', 20);
    table.string('fk_mm_base_id', 20);
    table.string('fk_related_source_id', 20);
    table.string('fk_mm_source_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_ROLLUP, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.string('fk_relation_column_id', 20);
    table.string('fk_rollup_column_id', 20);
    table.string('rollup_function', 255);
    table.boolean('deleted');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_column_id', 20);
    table.string('title', 255);
    table.string('color', 255);
    table.float('order');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('title', 255);
    table.string('column_name', 255);
    table.string('uidt', 255);
    table.string('dt', 255);
    table.string('np', 255);
    table.string('ns', 255);
    table.string('clen', 255);
    table.string('cop', 255);
    table.boolean('pk');
    table.boolean('pv');
    table.boolean('rqd');
    table.boolean('un');
    table.text('ct');
    table.boolean('ai');
    table.boolean('unique');
    table.text('cdf');
    table.text('cc');
    table.string('csn', 255);
    table.string('dtx', 255);
    table.text('dtxp');
    table.string('dtxs', 255);
    table.boolean('au');
    table.text('validate');
    table.boolean('virtual');
    table.boolean('deleted');
    table.boolean('system').defaultTo(false);
    table.float('order');
    table.text('meta');
    table.text('description');
    table.boolean('readonly').defaultTo(false);
    table.string('fk_workspace_id', 20);
    table.string('custom_index_name', 64);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COMMENTS_REACTIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('row_id', 255);
    table.string('comment_id', 20);
    table.string('source_id', 20);
    table.string('fk_model_id', 20);
    table.string('base_id', 20);
    table.string('reaction', 255);
    table.string('created_by', 255);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COMMENTS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('row_id', 255);
    table.text('comment');
    table.string('created_by', 20);
    table.string('created_by_email', 255);
    table.string('resolved_by', 20);
    table.string('resolved_by_email', 255);
    table.string('parent_comment_id', 20);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.boolean('is_deleted');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.CUSTOM_URLS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('view_id', 20);
    table.string('original_path', 255);
    table.string('custom_path', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.DATA_REFLECTION, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_workspace_id', 20);
    table.string('username', 255);
    table.string('password', 255);
    table.string('database', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('role', 45);
    table.boolean('disabled').defaultTo(true);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.EXTENSIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('fk_user_id', 20);
    table.string('extension_id', 255);
    table.string('title', 255);
    table.text('kv_store');
    table.text('meta');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('storage', 255);
    table.text('file_url');
    table.integer('file_size');
    table.string('fk_user_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('fk_model_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('is_external').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FILTER_EXP, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_hook_id', 20);
    table.string('fk_column_id', 20);
    table.string('fk_parent_id', 20);
    table.string('logical_op', 255);
    table.string('comparison_op', 255);
    table.text('value');
    table.boolean('is_group');
    table.float('order');
    table.string('comparison_sub_op', 255);
    table.string('fk_link_col_id', 20);
    table.string('fk_value_col_id', 20);
    table.string('fk_parent_column_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FOLLOWER, (table) => {
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_follower_id', 20).notNullable();
    table.timestamps(true, true);
    table.primary(['fk_user_id', 'fk_follower_id']);
  });

  await knex.schema.createTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('uuid', 255);
    table.text('label');
    table.text('help');
    table.text('description');
    table.boolean('required');
    table.boolean('show');
    table.float('order');
    table.text('meta');
    table.boolean('enable_scanner');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FORM_VIEW, (table) => {
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20).notNullable().primary();
    table.string('heading', 255);
    table.text('subheading');
    table.text('success_msg');
    table.text('redirect_url');
    table.string('redirect_after_secs', 255);
    table.string('email', 255);
    table.boolean('submit_another_form');
    table.boolean('show_blank_form');
    table.string('uuid', 255);
    table.text('banner_image_url');
    table.text('logo_url');
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('uuid', 255);
    table.string('label', 255);
    table.string('help', 255);
    table.boolean('show');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.GALLERY_VIEW, (table) => {
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20).notNullable().primary();
    table.boolean('next_enabled');
    table.boolean('prev_enabled');
    table.integer('cover_image_idx');
    table.string('fk_cover_image_col_id', 20);
    table.string('cover_image', 255);
    table.string('restrict_types', 255);
    table.string('restrict_size', 255);
    table.string('restrict_number', 255);
    table.boolean('public');
    table.string('dimensions', 255);
    table.string('responsive_columns', 255);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('uuid', 255);
    table.string('label', 255);
    table.string('help', 255);
    table.string('width', 255).defaultTo('200px');
    table.boolean('show');
    table.float('order');
    table.boolean('group_by');
    table.float('group_by_order');
    table.string('group_by_sort', 255);
    table.string('aggregation', 30).nullable().defaultTo(null);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.GRID_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('uuid', 255);
    table.text('meta');
    table.integer('row_height');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.HOOK_LOGS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_hook_id', 20);
    table.string('type', 255);
    table.string('event', 255);
    table.string('operation', 255);
    table.boolean('test_call').defaultTo(true);
    table.text('payload');
    table.text('conditions');
    table.text('notification');
    table.string('error_code', 255);
    table.string('error_message', 255);
    table.text('error');
    table.integer('execution_time');
    table.text('response');
    table.string('triggered_by', 255);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.HOOKS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('title', 255);
    table.string('description', 255);
    table.string('env', 255).defaultTo('all');
    table.string('type', 255);
    table.string('event', 255);
    table.string('operation', 255);
    table.boolean('async').defaultTo(false);
    table.boolean('payload').defaultTo(true);
    table.text('url');
    table.text('headers');
    table.boolean('condition').defaultTo(false);
    table.text('notification');
    table.integer('retries').defaultTo(0);
    table.integer('retry_interval').defaultTo(60000);
    table.integer('timeout').defaultTo(60000);
    table.boolean('active').defaultTo(true);
    table.string('version', 255);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.INTEGRATIONS_STORE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_integration_id', 20);
    table.string('type', 20);
    table.string('sub_type', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_user_id', 20);
    table.timestamps(true, true);
    table.text('slot_0');
    table.text('slot_1');
    table.text('slot_2');
    table.text('slot_3');
    table.text('slot_4');
    table.integer('slot_5');
    table.integer('slot_6');
    table.integer('slot_7');
    table.integer('slot_8');
    table.integer('slot_9');
  });

  await knex.schema.createTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 128);
    table.text('config');
    table.text('meta');
    table.string('type', 20);
    table.string('sub_type', 20);
    table.string('fk_workspace_id', 20);
    table.boolean('is_private').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.string('created_by', 20);
    table.float('order');
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_encrypted').defaultTo(false);
    table.boolean('is_global').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.JOBS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('job', 255);
    table.string('status', 20);
    table.text('result');
    table.string('fk_user_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('uuid', 255);
    table.string('label', 255);
    table.string('help', 255);
    table.boolean('show');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.KANBAN_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.boolean('show');
    table.float('order');
    table.string('uuid', 255);
    table.string('title', 255);
    table.boolean('public');
    table.string('password', 255);
    table.boolean('show_all_fields');
    table.string('fk_grp_col_id', 20);
    table.string('fk_cover_image_col_id', 20);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('project_id', 128);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('uuid', 255);
    table.string('label', 255);
    table.string('help', 255);
    table.boolean('show');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MAP_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('uuid', 255);
    table.string('title', 255);
    table.string('fk_geo_data_col_id', 20);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps();
  });

  await knex.schema.createTable(MetaTable.MCP_TOKENS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 512);
    table.string('base_id', 20);

    table.string('token', 32);

    table.string('fk_workspace_id', 20);
    table.float('order');

    table.string('fk_user_id', 20);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MODEL_STAT, (table) => {
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_model_id', 20).notNullable();
    table.integer('row_count').defaultTo(0);
    table.boolean('is_external').defaultTo(false);
    table.string('base_id', 20);
    table.timestamps(true, true);
    table.primary(['fk_workspace_id', 'fk_model_id']);
  });

  await knex.schema.createTable(MetaTable.MODELS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('table_name', 255);
    table.string('title', 255);
    table.string('type', 255).defaultTo('table');
    table.text('meta');
    table.text('schema');
    table.boolean('enabled').defaultTo(true);
    table.boolean('mm').defaultTo(false);
    table.string('tags', 255);
    table.boolean('pinned');
    table.boolean('deleted');
    table.float('order');
    table.text('description');
    table.boolean('synced').defaultTo(false);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORG, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 255);
    table.string('slug', 255);
    table.string('fk_user_id', 20);
    table.text('meta');
    table.string('image', 255);
    table.boolean('is_share_enabled').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.float('order');
    table.string('stripe_customer_id', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORG_DOMAIN, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_org_id', 20);
    table.string('fk_user_id', 20);
    table.string('domain', 255);
    table.boolean('verified');
    table.string('txt_value', 255);
    table.timestamp('last_verified');
    table.boolean('deleted').defaultTo(false);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORG_USERS, (table) => {
    table.string('fk_org_id', 20).notNullable().primary();
    table.string('fk_user_id', 20);
    table.string('roles', 255);
    table.timestamps(true, true);
    table.primary(['fk_org_id']); // original had pkey on fk_org_id. Adjust if you need a composite PK.
  });

  await knex.schema.createTable(MetaTable.PLUGIN, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 45);
    table.text('description');
    table.boolean('active').defaultTo(false);
    table.float('rating');
    table.string('version', 255);
    table.string('docs', 255);
    table.string('status', 255).defaultTo('install');
    table.string('status_details', 255);
    table.string('logo', 255);
    table.string('icon', 255);
    table.string('tags', 255);
    table.string('category', 255);
    table.text('input_schema');
    table.text('input');
    table.string('creator', 255);
    table.string('creator_website', 255);
    table.string('price', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SCRIPTS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.text('title');
    table.text('description');
    table.text('meta');
    table.float('order');
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.text('script');
    table.text('config');
    table.string('created_by', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SNAPSHOT, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 512);
    table.string('base_id', 20);
    table.string('snapshot_base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('created_by', 20);
    table.string('status', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SORT, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.string('direction', 255).defaultTo('false');
    table.float('order');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SOURCES, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('alias', 255);
    table.text('config');
    table.text('meta');
    table.boolean('is_meta');
    table.string('type', 255);
    table.string('inflection_column', 255);
    table.string('inflection_table', 255);
    table.boolean('enabled').defaultTo(true);
    table.float('order');
    table.string('description', 255);
    table.string('erd_uuid', 255);
    table.boolean('deleted').defaultTo(false);
    table.boolean('is_schema_readonly').defaultTo(false);
    table.boolean('is_data_readonly').defaultTo(false);
    table.boolean('is_local').defaultTo(false);
    table.string('fk_sql_executor_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_integration_id', 20);
    table.boolean('is_encrypted').defaultTo(false);
    table.timestamps(true, true);

    if (['pg', 'postgres'].includes(knex.client.config.client)) {
      table.primary(['id'], { constraintName: 'nc_bases_v2_pkey' });
    } else {
      table.primary(['id']);
    }
  });

  await knex.schema.createTable(MetaTable.DB_MUX, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('domain', 50);
    table.string('status', 20);
    table.integer('priority');
    table.integer('capacity');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SSO_CLIENT, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('type', 20);
    table.string('title', 255);
    table.boolean('enabled').defaultTo(true);
    table.text('config');
    table.string('fk_user_id', 20);
    table.string('fk_org_id', 20);
    table.boolean('deleted').defaultTo(false);
    table.float('order');
    table.string('domain_name', 255);
    table.boolean('domain_name_verified');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SSO_CLIENT_DOMAIN, (table) => {
    table.string('fk_sso_client_id', 20).notNullable();
    table.string('fk_org_domain_id', 20);
    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
    table.primary(['fk_sso_client_id']); // composite?
  });

  await knex.schema.createTable(MetaTable.STORE, (table) => {
    table.increments('id').primary();
    table.string('base_id', 255);
    table.string('db_alias', 255).defaultTo('db');
    table.string('key', 255);
    table.text('value');
    table.string('type', 255);
    table.string('env', 255);
    table.string('tag', 255);
    table.timestamps();
  });

  await knex.schema.createTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_integration_id', 20);
    table.string('fk_model_id', 20);
    table.string('sync_type', 255);
    table.string('sync_trigger', 255);
    table.string('sync_trigger_cron', 255);
    table.string('sync_trigger_secret', 255);
    table.string('sync_job_id', 255);
    table.datetime('last_sync_at');
    table.datetime('next_sync_at');

    table.string('title', 255);
    table.string('sync_category', 255);
    table.string('fk_parent_sync_config_id', 20);
    table.string('on_delete_action', 255).defaultTo(OnDeleteAction.MarkDeleted); // delete, mark_deleted

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SYNC_LOGS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('base_id', 20);
    table.string('fk_sync_source_id', 20);
    table.integer('time_taken');
    table.string('status', 255);
    table.text('status_details');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SYNC_MAPPINGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('fk_sync_config_id', 20);

    table.string('target_table', 255);
    table.string('fk_model_id', 20); // target model id

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SYNC_SOURCE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 255);
    table.string('type', 255);
    table.text('details');
    table.boolean('deleted');
    table.boolean('enabled').defaultTo(true);
    table.float('order');
    table.string('base_id', 20);
    table.string('fk_user_id', 20);
    table.string('source_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.string('id', 20).notNullable().primary();
      table.string('row_id', 255);
      table.string('user_id', 20);
      table.string('fk_model_id', 20);
      table.string('source_id', 20);
      table.string('base_id', 20);
      table.string('preferences', 255);
      table.string('fk_workspace_id', 20);
      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable(MetaTable.USER_REFRESH_TOKENS, (table) => {
    table.string('fk_user_id', 20);
    table.string('token', 255);
    table.text('meta');
    table.timestamp('expires_at');
    table.timestamps(true, true);
    // no explicit PK, if you need one:
    // table.primary(['fk_user_id','token']);
  });

  await knex.schema.createTable(MetaTable.USERS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('email', 255);
    table.string('password', 255);
    table.string('salt', 255);
    table.string('invite_token', 255);
    table.string('invite_token_expires', 255);
    table.timestamp('reset_password_expires');
    table.string('reset_password_token', 255);
    table.string('email_verification_token', 255);
    table.boolean('email_verified');
    table.string('roles', 255).defaultTo('editor');
    table.string('token_version', 255);
    table.boolean('blocked').defaultTo(false);
    table.string('blocked_reason', 255);
    table.datetime('deleted_at');
    table.boolean('is_deleted').defaultTo(false);
    table.text('meta');
    table.string('display_name', 255);
    table.string('user_name', 255);
    table.string('bio', 255);
    table.string('location', 255);
    table.string('website', 255);
    table.string('avatar', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.VIEWS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('title', 255);
    table.integer('type');
    table.boolean('is_default');
    table.boolean('show_system_fields');
    table.string('lock_type', 255).defaultTo('collaborative');
    table.string('uuid', 255);
    table.string('password', 255);
    table.boolean('show');
    table.float('order');
    table.text('meta');
    table.text('description');
    table.string('created_by', 20);
    table.string('owned_by', 20);
    table.string('fk_workspace_id', 20);
    table.string('attachment_mode_column_id', 20);
    table.string('expanded_record_mode', 255);
    table.string('fk_custom_url_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.NOTIFICATION, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('type', 40);
    table.text('body');
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('fk_user_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.WORKSPACE, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 255);
    table.text('description');
    table.text('meta');
    table.string('fk_user_id', 20);
    table.boolean('deleted').defaultTo(false);
    table.timestamp('deleted_at');
    table.float('order');
    table.specificType('status', 'smallint').defaultTo(0);
    table.string('message', 256);
    table.string('plan', 20).defaultTo('free');
    table.text('infra_meta');
    table.string('fk_org_id', 20);
    table.string('stripe_customer_id', 255);
    table.timestamp('grace_period_start_at');
    table.timestamp('api_grace_period_start_at');
    table.timestamp('automation_grace_period_start_at');
    table.boolean('loyal').defaultTo(false);
    table.boolean('loyalty_discount_used').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.WORKSPACE_USER, (table) => {
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('roles', 255);
    table.string('invite_token', 255);
    table.boolean('invite_accepted').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.timestamp('deleted_at');
    table.float('order');
    table.string('invited_by', 20);
    table.timestamps(true, true);
    // Composite PK
    table.primary(['fk_workspace_id', 'fk_user_id']);
  });

  await knex.schema.createTable(MetaTable.PLANS, (table) => {
    table.string('id', 20).primary();
    table.string('title', 255);
    table.text('description');
    table.string('stripe_product_id', 255).notNullable();
    table.boolean('is_active').defaultTo(true);

    // limits
    table.text('prices'); // JSON
    table.text('meta'); // JSON

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.string('fk_plan_id', 20).notNullable();

    // user created subscription
    table.string('fk_user_id', 20);

    table.string('stripe_subscription_id', 255);
    table.string('stripe_price_id', 255);

    table.integer('seat_count').notNullable().defaultTo(1);

    table.string('status', 255); // active, canceled, paused, trial

    table.timestamp('billing_cycle_anchor');
    table.timestamp('start_at');
    table.timestamp('trial_end_at'); // when trial ends - otherwise null
    table.timestamp('canceled_at'); // when canceled - otherwise null

    table.string('period', 255); // month, year

    table.timestamp('upcoming_invoice_at');
    table.timestamp('upcoming_invoice_due_at');
    table.integer('upcoming_invoice_amount');
    table.string('upcoming_invoice_currency');

    table.string('stripe_schedule_id', 255);
    table.timestamp('schedule_phase_start');
    table.string('schedule_stripe_price_id', 255);
    table.string('schedule_fk_plan_id', 20);
    table.string('schedule_period', 255);
    table.string('schedule_type', 255);

    table.text('meta'); // JSON - limits override

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.USAGE_STATS, (table) => {
    table.string('fk_workspace_id', 20);
    table.string('usage_type', 255); // 'api', 'automation', 'storage', 'webhook'

    table.timestamp('period_start');

    table.integer('count').defaultTo(0);

    table.timestamps(true, true);

    table.primary(['fk_workspace_id', 'usage_type', 'period_start']);
  });

  // ----- CREATE INDEX statements -----
  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.index('stripe_product_id', 'nc_plans_stripe_product_idx');
  });

  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.index('fk_workspace_id', 'nc_subscriptions_ws_idx');
    table.index('fk_org_id', 'nc_subscriptions_org_idx');
    table.index(
      'stripe_subscription_id',
      'nc_subscriptions_stripe_subscription_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.USAGE_STATS, (table) => {
    table.index(
      ['fk_workspace_id', 'period_start'],
      'nc_usage_stats_ws_period_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.index(['fk_user_id'], 'nc_api_tokens_fk_user_id_index');
  });

  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_audit_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_model_id'], 'nc_audit_v2_fk_model_id_index');
    table.index(['row_id'], 'nc_audit_v2_row_id_index');
  });

  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_base_users_v2_base_id_fk_workspace_id_index',
    );
    table.index(['invited_by'], 'nc_base_users_v2_invited_by_index');
    table.index(['fk_user_id'], 'nc_project_users_v2_fk_user_id_index');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['fk_custom_url_id'], 'nc_bases_v2_fk_custom_url_id_index');
    table.index(['fk_workspace_id'], 'nc_bases_v2_fk_workspace_id_index');
  });

  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_calendar_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_calendar_view_columns_v2_fk_view_id_fk_column_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_RANGE, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_calendar_view_range_v2_base_id_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_calendar_view_v2_base_id_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.COL_BARCODE, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_barcode_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_barcode_v2_fk_column_id_index');
  });

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    // The question’s list calls it "nc_col_button_context" for (base_id, fk_workspace_id)
    table.index(['base_id', 'fk_workspace_id'], 'nc_col_button_context');
    table.index(['fk_column_id'], 'nc_col_button_v2_fk_column_id_index');
  });

  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_formula_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_formula_v2_fk_column_id_index');
  });

  await knex.schema.alterTable(MetaTable.COL_LONG_TEXT, (table) => {
    // The question’s list calls it "nc_col_long_text_context"
    table.index(['base_id', 'fk_workspace_id'], 'nc_col_long_text_context');
    table.index(['fk_column_id'], 'nc_col_long_text_v2_fk_column_id_index');
  });

  await knex.schema.alterTable(MetaTable.COL_LOOKUP, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_lookup_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_lookup_v2_fk_column_id_index');
    table.index(
      ['fk_lookup_column_id'],
      'nc_col_lookup_v2_fk_lookup_column_id_index',
    );
    table.index(
      ['fk_relation_column_id'],
      'nc_col_lookup_v2_fk_relation_column_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.COL_QRCODE, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_qrcode_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_qrcode_v2_fk_column_id_index');
  });

  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_relations_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_child_column_id'],
      'nc_col_relations_v2_fk_child_column_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_relations_v2_fk_column_id_index');
    table.index(
      ['fk_mm_child_column_id'],
      'nc_col_relations_v2_fk_mm_child_column_id_index',
    );
    table.index(['fk_mm_model_id'], 'nc_col_relations_v2_fk_mm_model_id_index');
    table.index(
      ['fk_mm_parent_column_id'],
      'nc_col_relations_v2_fk_mm_parent_column_id_index',
    );
    table.index(
      ['fk_parent_column_id'],
      'nc_col_relations_v2_fk_parent_column_id_index',
    );
    table.index(
      ['fk_related_model_id'],
      'nc_col_relations_v2_fk_related_model_id_index',
    );
    table.index(
      ['fk_target_view_id'],
      'nc_col_relations_v2_fk_target_view_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_rollup_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_col_rollup_v2_fk_column_id_index');
    table.index(
      ['fk_relation_column_id'],
      'nc_col_rollup_v2_fk_relation_column_id_index',
    );
    table.index(
      ['fk_rollup_column_id'],
      'nc_col_rollup_v2_fk_rollup_column_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_col_select_options_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_column_id'],
      'nc_col_select_options_v2_fk_column_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_model_id'], 'nc_columns_v2_fk_model_id_index');
  });

  await knex.schema.alterTable(MetaTable.COMMENTS_REACTIONS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_comment_reactions_base_id_fk_workspace_id_index',
    );
    table.index(['comment_id'], 'nc_comment_reactions_comment_id_index');
    table.index(['row_id'], 'nc_comment_reactions_row_id_index');
  });

  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_comments_base_id_fk_workspace_id_index',
    );
    table.index(
      ['row_id', 'fk_model_id'],
      'nc_comments_row_id_fk_model_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_custom_urls_context');
    table.index(['custom_path'], 'nc_custom_urls_v2_custom_path_index');
  });

  await knex.schema.alterTable(MetaTable.DATA_REFLECTION, (table) => {
    table.index(
      ['fk_workspace_id'],
      'nc_data_reflection_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_disabled_models_for_role_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_view_id'],
      'nc_disabled_models_for_role_v2_fk_view_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.EXTENSIONS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_extensions_base_id_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_filter_exp_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_filter_exp_v2_fk_column_id_index');
    table.index(['fk_hook_id'], 'nc_filter_exp_v2_fk_hook_id_index');
    table.index(['fk_link_col_id'], 'nc_filter_exp_v2_fk_link_col_id_index');
    table.index(
      ['fk_parent_column_id'],
      'nc_filter_exp_v2_fk_parent_column_id_index',
    );
    table.index(['fk_parent_id'], 'nc_filter_exp_v2_fk_parent_id_index');
    table.index(['fk_value_col_id'], 'nc_filter_exp_v2_fk_value_col_id_index');
    table.index(['fk_view_id'], 'nc_filter_exp_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.FOLLOWER, (table) => {
    table.index(['fk_follower_id'], 'nc_follower_fk_follower_id_index');
    table.index(['fk_user_id'], 'nc_follower_fk_user_id_index');
  });

  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_form_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_form_view_columns_v2_fk_column_id_index');
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_form_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_form_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_form_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_form_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_fr_context');
  });

  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gallery_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_column_id'],
      'nc_gallery_view_columns_v2_fk_column_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_gallery_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_gallery_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gallery_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_gallery_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_grid_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_grid_view_columns_v2_fk_column_id_index');
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_grid_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_grid_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_grid_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_grid_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_hook_logs_v2_base_id_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_hooks_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_model_id'], 'nc_hooks_v2_fk_model_id_index');
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS_STORE, (table) => {
    table.index(
      ['fk_integration_id'],
      'nc_integrations_store_v2_fk_integration_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.index(['created_by'], 'nc_integrations_v2_created_by_index');
    table.index(
      ['fk_workspace_id'],
      'nc_integrations_v2_fk_workspace_id_index',
    );
    table.index(['type'], 'nc_integrations_v2_type_index');
  });

  await knex.schema.alterTable(MetaTable.JOBS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_jobs_context');
  });

  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_kanban_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_column_id'],
      'nc_kanban_view_columns_v2_fk_column_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_kanban_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_kanban_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_kanban_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_grp_col_id'], 'nc_kanban_view_v2_fk_grp_col_id_index');
    table.index(['fk_view_id'], 'nc_kanban_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_map_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_map_view_columns_v2_fk_column_id_index');
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_map_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_map_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_map_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_geo_data_col_id'],
      'nc_map_view_v2_fk_geo_data_col_id_index',
    );
    table.index(['fk_view_id'], 'nc_map_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.MCP_TOKENS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_mc_tokens_context');
  });

  await knex.schema.alterTable(MetaTable.MODEL_STAT, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_model_stats_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_workspace_id'], 'nc_model_stats_v2_fk_workspace_id_index');
  });

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_models_v2_base_id_fk_workspace_id_index',
    );
    table.index(['source_id'], 'nc_models_v2_source_id_index');
  });

  await knex.schema.alterTable(MetaTable.ORG_DOMAIN, (table) => {
    table.index(['domain'], 'nc_org_domain_domain_index');
    table.index(['fk_org_id'], 'nc_org_domain_fk_org_id_index');
    table.index(['fk_user_id'], 'nc_org_domain_fk_user_id_index');
    table.index(['fk_workspace_id'], 'org_domain_fk_workspace_id_idx');
  });

  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.index(['fk_user_id'], 'nc_org_fk_user_id_index');
    table.index(['slug'], 'nc_org_slug_index');
  });

  await knex.schema.alterTable(MetaTable.SCRIPTS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_scripts_context');
  });

  await knex.schema.alterTable(MetaTable.SNAPSHOT, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_snapshot_context');
  });

  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_sort_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_column_id'], 'nc_sort_v2_fk_column_id_index');
    table.index(['fk_view_id'], 'nc_sort_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_source_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_integration_id'], 'nc_source_v2_fk_integration_id_index');
    table.index(
      ['fk_sql_executor_id'],
      'nc_source_v2_fk_sql_executor_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.SSO_CLIENT, (table) => {
    table.index(['domain_name'], 'nc_sso_client_domain_name_index');
    table.index(['fk_user_id'], 'nc_sso_client_fk_user_id_index');
    table.index(['fk_org_id'], 'nc_sso_client_fk_workspace_id_index');
    table.index(['fk_workspace_id'], 'sso_client_fk_workspace_id_idx');
  });

  await knex.schema.alterTable(MetaTable.STORE, (table) => {
    table.index(['key'], 'nc_store_key_index');
  });

  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_sync_configs_context');
    table.index(
      ['fk_model_id', 'fk_integration_id'],
      'sync_configs_integration_model',
    );
    table.index('fk_parent_sync_config_id', 'nc_sync_configs_parent_idx');
  });

  await knex.schema.alterTable(MetaTable.SYNC_LOGS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_sync_logs_v2_base_id_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.SYNC_MAPPINGS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_sync_mappings_context');
    table.index('fk_sync_config_id', 'nc_sync_mappings_sync_config_idx');
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_sync_source_v2_base_id_fk_workspace_id_index',
    );
    table.index(['source_id'], 'nc_sync_source_v2_source_id_index');
  });

  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.index(
        ['base_id', 'fk_workspace_id'],
        'nc_user_comment_notifications_preference_base_id_fk_workspace_i',
      );
      table.index(
        ['user_id', 'row_id', 'fk_model_id'],
        'user_comments_preference_index',
      );
    },
  );

  await knex.schema.alterTable(MetaTable.USER_REFRESH_TOKENS, (table) => {
    table.index(['expires_at'], 'nc_user_refresh_tokens_expires_at_index');
    table.index(['fk_user_id'], 'nc_user_refresh_tokens_fk_user_id_index');
    table.index(['token'], 'nc_user_refresh_tokens_token_index');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.index(['email'], 'nc_users_v2_email_index');
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_views_v2_base_id_fk_workspace_id_index',
    );
    table.index(['created_by'], 'nc_views_v2_created_by_index');
    table.index(['fk_custom_url_id'], 'nc_views_v2_fk_custom_url_id_index');
    table.index(['fk_model_id'], 'nc_views_v2_fk_model_id_index');
    table.index(['owned_by'], 'nc_views_v2_owned_by_index');
  });

  await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
    table.index(['created_at'], 'notification_created_at_index');
    table.index(['fk_user_id'], 'notification_fk_user_id_index');
  });

  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.index(['fk_org_id'], 'workspace_fk_org_id_index');
  });

  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    table.index(['invited_by'], 'workspace_user_invited_by_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.WORKSPACE_USER);
  await knex.schema.dropTableIfExists(MetaTable.WORKSPACE);
  await knex.schema.dropTableIfExists(MetaTable.NOTIFICATION);
  await knex.schema.dropTableIfExists(MetaTable.VIEWS);
  await knex.schema.dropTableIfExists(MetaTable.USERS);
  await knex.schema.dropTableIfExists(MetaTable.USER_REFRESH_TOKENS);
  await knex.schema.dropTableIfExists(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
  );
  await knex.schema.dropTableIfExists(MetaTable.SYNC_SOURCE);
  await knex.schema.dropTableIfExists(MetaTable.SYNC_LOGS);
  await knex.schema.dropTableIfExists(MetaTable.SYNC_MAPPINGS);
  await knex.schema.dropTableIfExists(MetaTable.SYNC_CONFIGS);
  await knex.schema.dropTableIfExists(MetaTable.STORE);
  await knex.schema.dropTableIfExists(MetaTable.SSO_CLIENT_DOMAIN);
  await knex.schema.dropTableIfExists(MetaTable.SSO_CLIENT);
  await knex.schema.dropTableIfExists(MetaTable.DB_MUX);
  await knex.schema.dropTableIfExists(MetaTable.SOURCES);
  await knex.schema.dropTableIfExists(MetaTable.SORT);
  await knex.schema.dropTableIfExists(MetaTable.SNAPSHOT);
  await knex.schema.dropTableIfExists(MetaTable.SCRIPTS);
  await knex.schema.dropTableIfExists(MetaTable.PLUGIN);
  await knex.schema.dropTableIfExists(MetaTable.ORG_USERS);
  await knex.schema.dropTableIfExists(MetaTable.ORG_DOMAIN);
  await knex.schema.dropTableIfExists(MetaTable.ORG);
  await knex.schema.dropTableIfExists(MetaTable.MODELS);
  await knex.schema.dropTableIfExists(MetaTable.MODEL_STAT);
  await knex.schema.dropTableIfExists(MetaTable.MAP_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.MAP_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.MCP_TOKENS);
  await knex.schema.dropTableIfExists(MetaTable.KANBAN_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.KANBAN_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.JOBS);
  await knex.schema.dropTableIfExists(MetaTable.INTEGRATIONS);
  await knex.schema.dropTableIfExists(MetaTable.INTEGRATIONS_STORE);
  await knex.schema.dropTableIfExists(MetaTable.HOOKS);
  await knex.schema.dropTableIfExists(MetaTable.HOOK_LOGS);
  await knex.schema.dropTableIfExists(MetaTable.GRID_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.GRID_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.GALLERY_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.GALLERY_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.FORM_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.FORM_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.FOLLOWER);
  await knex.schema.dropTableIfExists(MetaTable.FILTER_EXP);
  await knex.schema.dropTableIfExists(MetaTable.FILE_REFERENCES);
  await knex.schema.dropTableIfExists(MetaTable.EXTENSIONS);
  await knex.schema.dropTableIfExists(MetaTable.MODEL_ROLE_VISIBILITY);
  await knex.schema.dropTableIfExists(MetaTable.DATA_REFLECTION);
  await knex.schema.dropTableIfExists(MetaTable.CUSTOM_URLS);
  await knex.schema.dropTableIfExists(MetaTable.COMMENTS);
  await knex.schema.dropTableIfExists(MetaTable.COMMENTS_REACTIONS);
  await knex.schema.dropTableIfExists(MetaTable.COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.COL_SELECT_OPTIONS);
  await knex.schema.dropTableIfExists(MetaTable.COL_ROLLUP);
  await knex.schema.dropTableIfExists(MetaTable.COL_RELATIONS);
  await knex.schema.dropTableIfExists(MetaTable.COL_QRCODE);
  await knex.schema.dropTableIfExists(MetaTable.COL_LOOKUP);
  await knex.schema.dropTableIfExists(MetaTable.COL_LONG_TEXT);
  await knex.schema.dropTableIfExists(MetaTable.COL_FORMULA);
  await knex.schema.dropTableIfExists(MetaTable.COL_BUTTON);
  await knex.schema.dropTableIfExists(MetaTable.COL_BARCODE);
  await knex.schema.dropTableIfExists(MetaTable.CALENDAR_VIEW);
  await knex.schema.dropTableIfExists(MetaTable.CALENDAR_VIEW_RANGE);
  await knex.schema.dropTableIfExists(MetaTable.CALENDAR_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.PROJECT);
  await knex.schema.dropTableIfExists(MetaTable.PROJECT_USERS);
  await knex.schema.dropTableIfExists(MetaTable.AUDIT);
  await knex.schema.dropTableIfExists(MetaTable.API_TOKENS);
  await knex.schema.dropTableIfExists(MetaTable.PLANS);
  await knex.schema.dropTableIfExists(MetaTable.SUBSCRIPTIONS);
  await knex.schema.dropTableIfExists(MetaTable.USAGE_STATS);
};

export { up, down };
