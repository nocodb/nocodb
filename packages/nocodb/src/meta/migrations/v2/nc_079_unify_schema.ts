import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.WORKSPACE)) {
    return;
  }

  // Add fk_workspace_id to tables that need it
  const tablesToAddFkWorkspaceId = [
    MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.COLUMNS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.COMMENTS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.VIEWS,
  ];

  for (const tableName of tablesToAddFkWorkspaceId) {
    await knex.schema.alterTable(tableName, (table) => {
      table.string('fk_workspace_id', 20);
    });
  }

  // Tables which need additional columns
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.string('fk_custom_url_id', 20);
    table.string('fk_workspace_id', 20); // note: PROJECT also gets fk_workspace_id
    table.boolean('is_snapshot').defaultTo(false);
    table.string('type', 200);
  });

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_script_id', 20);
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('fk_workspace_id', 20);
    table.boolean('is_global').defaultTo(false);
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('avatar', 255);
    table.string('bio', 255);
    table.string('location', 255);
    table.string('website', 255);
  });

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.string('fk_sql_executor_id', 20);
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.string('fk_custom_url_id', 20);
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.string('attachment_mode_column_id', 20);
    table.string('expanded_record_mode');
  });

  // Drop old indexes
  const tablesToDropOldBaseIdIndex = [
    { tableName: MetaTable.AUDIT, indexName: 'nc_audit_v2_base_id_index' },
    {
      tableName: MetaTable.PROJECT_USERS,
      indexName: 'nc_base_users_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_COLUMNS,
      indexName: 'nc_calendar_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_RANGE,
      indexName: 'nc_calendar_view_range_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW,
      indexName: 'nc_calendar_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_BARCODE,
      indexName: 'nc_col_barcode_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_FORMULA,
      indexName: 'nc_col_formula_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_LOOKUP,
      indexName: 'nc_col_lookup_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_QRCODE,
      indexName: 'nc_col_qrcode_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_RELATIONS,
      indexName: 'nc_col_relations_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_ROLLUP,
      indexName: 'nc_col_rollup_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_SELECT_OPTIONS,
      indexName: 'nc_col_select_options_v2_base_id_index',
    },
    { tableName: MetaTable.COLUMNS, indexName: 'nc_columns_v2_base_id_index' },
    {
      tableName: MetaTable.COMMENTS_REACTIONS,
      indexName: 'nc_comment_reactions_base_id_index',
    },
    { tableName: MetaTable.COMMENTS, indexName: 'nc_comments_base_id_index' },
    {
      tableName: MetaTable.MODEL_ROLE_VISIBILITY,
      indexName: 'nc_disabled_models_for_role_v2_base_id_index',
    },
    {
      tableName: MetaTable.EXTENSIONS,
      indexName: 'nc_extensions_base_id_index',
    },
    {
      tableName: MetaTable.FILTER_EXP,
      indexName: 'nc_filter_exp_v2_base_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW_COLUMNS,
      indexName: 'nc_form_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW,
      indexName: 'nc_form_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW_COLUMNS,
      indexName: 'nc_gallery_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW,
      indexName: 'nc_gallery_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW_COLUMNS,
      indexName: 'nc_grid_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW,
      indexName: 'nc_grid_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.HOOK_LOGS,
      indexName: 'nc_hook_logs_v2_base_id_index',
    },
    { tableName: MetaTable.HOOKS, indexName: 'nc_hooks_v2_base_id_index' },
    {
      tableName: MetaTable.KANBAN_VIEW_COLUMNS,
      indexName: 'nc_kanban_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW,
      indexName: 'nc_kanban_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW_COLUMNS,
      indexName: 'nc_map_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW,
      indexName: 'nc_map_view_v2_base_id_index',
    },
    { tableName: MetaTable.MODELS, indexName: 'nc_models_v2_base_id_index' },
    { tableName: MetaTable.SORT, indexName: 'nc_sort_v2_base_id_index' },
    {
      tableName: MetaTable.SYNC_LOGS,
      indexName: 'nc_sync_logs_v2_base_id_index',
    },
    {
      tableName: MetaTable.SYNC_SOURCE,
      indexName: 'nc_sync_source_v2_base_id_index',
    },
    {
      tableName: MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
      indexName: 'nc_user_comment_notifications_preference_base_id_index',
    },
    { tableName: MetaTable.VIEWS, indexName: 'nc_views_v2_base_id_index' },
  ];

  for (const { tableName, indexName } of tablesToDropOldBaseIdIndex) {
    await knex.schema.table(tableName, (table) => {
      table.dropIndex(['base_id'], indexName);
    });
  }

  // Sources table has multiple indexes to drop
  await knex.schema.table(MetaTable.SOURCES, (table) => {
    table.dropIndex(['base_id'], 'nc_sources_v2_base_id_index');
    table.dropIndex(
      ['fk_integration_id'],
      'nc_sources_v2_fk_integration_id_index',
    );
  });

  // Tables need base_id,fk_workspace_id indexes
  const tablesBaseIdWorkspaceIdx = [
    {
      tableName: MetaTable.AUDIT,
      indexName: 'nc_audit_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.PROJECT_USERS,
      indexName: 'nc_base_users_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_COLUMNS,
      indexName: 'nc_calendar_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_RANGE,
      indexName: 'nc_calendar_view_range_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW,
      indexName: 'nc_calendar_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_BARCODE,
      indexName: 'nc_col_barcode_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_FORMULA,
      indexName: 'nc_col_formula_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_LOOKUP,
      indexName: 'nc_col_lookup_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_QRCODE,
      indexName: 'nc_col_qrcode_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_RELATIONS,
      indexName: 'nc_col_relations_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_ROLLUP,
      indexName: 'nc_col_rollup_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_SELECT_OPTIONS,
      indexName: 'nc_col_select_options_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COLUMNS,
      indexName: 'nc_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COMMENTS_REACTIONS,
      indexName: 'nc_comment_reactions_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COMMENTS,
      indexName: 'nc_comments_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MODEL_ROLE_VISIBILITY,
      indexName: 'nc_disabled_models_for_role_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.EXTENSIONS,
      indexName: 'nc_extensions_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FILTER_EXP,
      indexName: 'nc_filter_exp_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW_COLUMNS,
      indexName: 'nc_form_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW,
      indexName: 'nc_form_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW_COLUMNS,
      indexName: 'nc_gallery_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW,
      indexName: 'nc_gallery_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW_COLUMNS,
      indexName: 'nc_grid_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW,
      indexName: 'nc_grid_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.HOOK_LOGS,
      indexName: 'nc_hook_logs_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.HOOKS,
      indexName: 'nc_hooks_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW_COLUMNS,
      indexName: 'nc_kanban_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW,
      indexName: 'nc_kanban_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW_COLUMNS,
      indexName: 'nc_map_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW,
      indexName: 'nc_map_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MODELS,
      indexName: 'nc_models_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SORT,
      indexName: 'nc_sort_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SOURCES,
      indexName: 'nc_source_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SYNC_LOGS,
      indexName: 'nc_sync_logs_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SYNC_SOURCE,
      indexName: 'nc_sync_source_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
      indexName:
        'nc_user_comment_notifications_preference_base_id_fk_workspace_i',
    },
    {
      tableName: MetaTable.VIEWS,
      indexName: 'nc_views_v2_base_id_fk_workspace_id_index',
    },
  ];

  for (const { tableName, indexName } of tablesBaseIdWorkspaceIdx) {
    await knex.schema.alterTable(tableName, (table) => {
      table.index(['base_id', 'fk_workspace_id'], indexName);
    });
  }

  // Tables with additional indexes
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['fk_custom_url_id'], 'nc_bases_v2_fk_custom_url_id_index');
    table.index(['fk_workspace_id'], 'nc_bases_v2_fk_workspace_id_index');
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.index(
      ['fk_workspace_id'],
      'nc_integrations_v2_fk_workspace_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.index(['fk_integration_id'], 'nc_source_v2_fk_integration_id_index');
    table.index(
      ['fk_sql_executor_id'],
      'nc_source_v2_fk_sql_executor_id_index',
    );
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.index(['fk_custom_url_id'], 'nc_views_v2_fk_custom_url_id_index');
  });

  // Add missing tables
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

    table.index('fk_org_id', 'workspace_fk_org_id_index');
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

    table.index('invited_by', 'workspace_user_invited_by_index');
  });

  await knex.schema.createTable(MetaTable.SSO_CLIENT_DOMAIN, (table) => {
    table.string('fk_sso_client_id', 20).notNullable();
    table.string('fk_org_domain_id', 20);
    table.boolean('enabled').defaultTo(true);
    table.timestamps(true, true);
    table.primary(['fk_sso_client_id']);
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

    table.index('domain_name', 'nc_sso_client_domain_name_index');
    table.index('fk_user_id', 'nc_sso_client_fk_user_id_index');
    table.index('fk_org_id', 'nc_sso_client_fk_workspace_id_index');
  });

  await knex.schema.createTable(MetaTable.DB_MUX, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('domain', 50);
    table.string('status', 20);
    table.integer('priority');
    table.integer('capacity');
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
    table.text('code');
    table.text('config');
    table.string('created_by', 20);
    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_scripts_context');
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

    table.index(['base_id', 'fk_workspace_id'], 'nc_snapshot_context');
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

    table.index('slug', 'nc_org_slug_index');
    table.index('fk_user_id', 'nc_org_fk_user_id_index');
  });

  await knex.schema.createTable(MetaTable.ORG_DOMAIN, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_org_id', 20);
    table.string('fk_user_id', 20);
    table.string('domain', 255);
    table.boolean('verified');
    table.string('txt_value', 255);
    table.timestamp('last_verified', { useTz: true });
    table.boolean('deleted').defaultTo(false);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);

    table.index('domain', 'nc_org_domain_domain_index');
    table.index('fk_org_id', 'nc_org_domain_fk_org_id_index');
    table.index('fk_user_id', 'nc_org_domain_fk_user_id_index');
  });

  await knex.schema.createTable(MetaTable.ORG_USERS, (table) => {
    table.string('fk_org_id', 20).notNullable().primary();
    table.string('fk_user_id', 20);
    table.string('roles', 255);
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

    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_model_stats_v2_base_id_fk_workspace_id_index',
    );
    table.index('fk_workspace_id', 'nc_model_stats_v2_fk_workspace_id_index');
  });

  await knex.schema.createTable(MetaTable.FOLLOWER, (table) => {
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_follower_id', 20).notNullable();
    table.timestamps(true, true);
    table.primary(['fk_user_id', 'fk_follower_id']);

    table.index('fk_follower_id', 'nc_follower_fk_follower_id_index');
    table.index('fk_user_id', 'nc_follower_fk_user_id_index');
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

    table.index('custom_path', 'nc_custom_urls_v2_custom_path_index');
    table.index(['base_id', 'fk_workspace_id'], 'nc_custom_urls_context');
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

  await knex.schema.alterTable(MetaTable.SSO_CLIENT, (table) => {
    table.index(['fk_workspace_id'], 'sso_client_fk_workspace_id_idx');
  });

  await knex.schema.alterTable(MetaTable.ORG_DOMAIN, (table) => {
    table.index(['fk_workspace_id'], 'org_domain_fk_workspace_id_idx');
  });
};

const down = async (knex: Knex) => {
  // Recreate the old indexes that were dropped in `up()`.
  const tablesToRecreateOldBaseIdIndex = [
    { tableName: MetaTable.AUDIT, indexName: 'nc_audit_v2_base_id_index' },
    {
      tableName: MetaTable.PROJECT_USERS,
      indexName: 'nc_base_users_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_COLUMNS,
      indexName: 'nc_calendar_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_RANGE,
      indexName: 'nc_calendar_view_range_v2_base_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW,
      indexName: 'nc_calendar_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_BARCODE,
      indexName: 'nc_col_barcode_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_FORMULA,
      indexName: 'nc_col_formula_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_LOOKUP,
      indexName: 'nc_col_lookup_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_QRCODE,
      indexName: 'nc_col_qrcode_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_RELATIONS,
      indexName: 'nc_col_relations_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_ROLLUP,
      indexName: 'nc_col_rollup_v2_base_id_index',
    },
    {
      tableName: MetaTable.COL_SELECT_OPTIONS,
      indexName: 'nc_col_select_options_v2_base_id_index',
    },
    { tableName: MetaTable.COLUMNS, indexName: 'nc_columns_v2_base_id_index' },
    {
      tableName: MetaTable.COMMENTS_REACTIONS,
      indexName: 'nc_comment_reactions_base_id_index',
    },
    { tableName: MetaTable.COMMENTS, indexName: 'nc_comments_base_id_index' },
    {
      tableName: MetaTable.MODEL_ROLE_VISIBILITY,
      indexName: 'nc_disabled_models_for_role_v2_base_id_index',
    },
    {
      tableName: MetaTable.EXTENSIONS,
      indexName: 'nc_extensions_base_id_index',
    },
    {
      tableName: MetaTable.FILTER_EXP,
      indexName: 'nc_filter_exp_v2_base_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW_COLUMNS,
      indexName: 'nc_form_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW,
      indexName: 'nc_form_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW_COLUMNS,
      indexName: 'nc_gallery_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW,
      indexName: 'nc_gallery_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW_COLUMNS,
      indexName: 'nc_grid_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW,
      indexName: 'nc_grid_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.HOOK_LOGS,
      indexName: 'nc_hook_logs_v2_base_id_index',
    },
    { tableName: MetaTable.HOOKS, indexName: 'nc_hooks_v2_base_id_index' },
    {
      tableName: MetaTable.KANBAN_VIEW_COLUMNS,
      indexName: 'nc_kanban_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW,
      indexName: 'nc_kanban_view_v2_base_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW_COLUMNS,
      indexName: 'nc_map_view_columns_v2_base_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW,
      indexName: 'nc_map_view_v2_base_id_index',
    },
    { tableName: MetaTable.MODELS, indexName: 'nc_models_v2_base_id_index' },
    { tableName: MetaTable.SORT, indexName: 'nc_sort_v2_base_id_index' },
    {
      tableName: MetaTable.SYNC_LOGS,
      indexName: 'nc_sync_logs_v2_base_id_index',
    },
    {
      tableName: MetaTable.SYNC_SOURCE,
      indexName: 'nc_sync_source_v2_base_id_index',
    },
    {
      tableName: MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
      indexName: 'nc_user_comment_notifications_preference_base_id_index',
    },
    { tableName: MetaTable.VIEWS, indexName: 'nc_views_v2_base_id_index' },
  ];

  for (const { tableName, indexName } of tablesToRecreateOldBaseIdIndex) {
    await knex.schema.table(tableName, (table) => {
      table.index(['base_id'], indexName);
    });
  }

  // SOURCES table had additional old indexes
  await knex.schema.table(MetaTable.SOURCES, (table) => {
    table.index(['base_id'], 'nc_sources_v2_base_id_index');
    table.index(['fk_integration_id'], 'nc_sources_v2_fk_integration_id_index');
  });

  // Drop the new indexes that were added in `up()`.
  const tablesBaseIdWorkspaceIdx = [
    {
      tableName: MetaTable.AUDIT,
      indexName: 'nc_audit_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.PROJECT_USERS,
      indexName: 'nc_base_users_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_COLUMNS,
      indexName: 'nc_calendar_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW_RANGE,
      indexName: 'nc_calendar_view_range_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.CALENDAR_VIEW,
      indexName: 'nc_calendar_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_BARCODE,
      indexName: 'nc_col_barcode_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_FORMULA,
      indexName: 'nc_col_formula_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_LOOKUP,
      indexName: 'nc_col_lookup_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_QRCODE,
      indexName: 'nc_col_qrcode_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_RELATIONS,
      indexName: 'nc_col_relations_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_ROLLUP,
      indexName: 'nc_col_rollup_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COL_SELECT_OPTIONS,
      indexName: 'nc_col_select_options_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COLUMNS,
      indexName: 'nc_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COMMENTS_REACTIONS,
      indexName: 'nc_comment_reactions_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.COMMENTS,
      indexName: 'nc_comments_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MODEL_ROLE_VISIBILITY,
      indexName: 'nc_disabled_models_for_role_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.EXTENSIONS,
      indexName: 'nc_extensions_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FILTER_EXP,
      indexName: 'nc_filter_exp_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW_COLUMNS,
      indexName: 'nc_form_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.FORM_VIEW,
      indexName: 'nc_form_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW_COLUMNS,
      indexName: 'nc_gallery_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GALLERY_VIEW,
      indexName: 'nc_gallery_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW_COLUMNS,
      indexName: 'nc_grid_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.GRID_VIEW,
      indexName: 'nc_grid_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.HOOK_LOGS,
      indexName: 'nc_hook_logs_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.HOOKS,
      indexName: 'nc_hooks_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW_COLUMNS,
      indexName: 'nc_kanban_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.KANBAN_VIEW,
      indexName: 'nc_kanban_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW_COLUMNS,
      indexName: 'nc_map_view_columns_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MAP_VIEW,
      indexName: 'nc_map_view_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.MODELS,
      indexName: 'nc_models_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SORT,
      indexName: 'nc_sort_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SOURCES,
      indexName: 'nc_source_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SYNC_LOGS,
      indexName: 'nc_sync_logs_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.SYNC_SOURCE,
      indexName: 'nc_sync_source_v2_base_id_fk_workspace_id_index',
    },
    {
      tableName: MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
      indexName:
        'nc_user_comment_notifications_preference_base_id_fk_workspace_i',
    },
    {
      tableName: MetaTable.VIEWS,
      indexName: 'nc_views_v2_base_id_fk_workspace_id_index',
    },
  ];

  // Drop all "base_id/fk_workspace_id" indexes
  for (const { tableName, indexName } of tablesBaseIdWorkspaceIdx) {
    await knex.schema.table(tableName, (table) => {
      table.dropIndex(['base_id', 'fk_workspace_id'], indexName);
    });
  }

  // Drop the other unique indexes created in `up()`
  await knex.schema.table(MetaTable.PROJECT, (table) => {
    table.dropIndex(['fk_custom_url_id'], 'nc_bases_v2_fk_custom_url_id_index');
    table.dropIndex(['fk_workspace_id'], 'nc_bases_v2_fk_workspace_id_index');
  });

  await knex.schema.table(MetaTable.INTEGRATIONS, (table) => {
    table.dropIndex(
      ['fk_workspace_id'],
      'nc_integrations_v2_fk_workspace_id_index',
    );
  });

  await knex.schema.table(MetaTable.SOURCES, (table) => {
    table.dropIndex(
      ['fk_integration_id'],
      'nc_sources_v2_fk_integration_id_index',
    );
  });

  await knex.schema.table(MetaTable.VIEWS, (table) => {
    table.dropIndex(['fk_custom_url_id'], 'nc_views_v2_fk_custom_url_id_index');
  });

  // Drop the new columns added in `up()`
  const tablesToDropFkWorkspaceId = [
    MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.COLUMNS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.COMMENTS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.VIEWS,
  ];

  for (const tableName of tablesToDropFkWorkspaceId) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('fk_workspace_id');
    });
  }

  // Drop additional columns

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('fk_custom_url_id');
    table.dropColumn('is_snapshot');
    table.dropColumn('type');
    // Note: We already dropped 'fk_workspace_id' in the above loop
  });

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_script_id');
  });

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('fk_workspace_id');
    table.dropColumn('is_global');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('avatar');
    table.dropColumn('bio');
    table.dropColumn('location');
    table.dropColumn('website');
  });

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('fk_sql_executor_id');
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('fk_custom_url_id');
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('attachment_mode_column_id');
    table.dropColumn('expanded_record_mode');
  });

  // Drop the new tables created in `up()`
  await knex.schema.dropTable(MetaTable.WORKSPACE);
  await knex.schema.dropTable(MetaTable.WORKSPACE_USER);
  await knex.schema.dropTable(MetaTable.SSO_CLIENT_DOMAIN);
  await knex.schema.dropTable(MetaTable.SSO_CLIENT);
  await knex.schema.dropTable(MetaTable.DB_MUX);
  await knex.schema.dropTable(MetaTable.SCRIPTS);
  await knex.schema.dropTable(MetaTable.SNAPSHOT);
  await knex.schema.dropTable(MetaTable.ORG);
  await knex.schema.dropTable(MetaTable.ORG_DOMAIN);
  await knex.schema.dropTable(MetaTable.ORG_USERS);
  await knex.schema.dropTable(MetaTable.MODEL_STAT);
  await knex.schema.dropTable(MetaTable.FOLLOWER);
  await knex.schema.dropTable(MetaTable.CUSTOM_URLS);
  await knex.schema.dropTable(MetaTable.PLANS);
  await knex.schema.dropTable(MetaTable.SUBSCRIPTIONS);
  await knex.schema.dropTable(MetaTable.USAGE_STATS);
};

export { up, down };
