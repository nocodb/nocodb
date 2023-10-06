import { MetaTable, MetaTableOldV2, orderedMetaTables } from '~/utils/globals';

const up = async (knex) => {
  await knex.schema.createTable(MetaTableOldV2.PROJECT, (table) => {
    table.string('id', 128).primary();
    table.string('title');
    table.string('prefix');
    table.string('status');
    table.text('description');
    table.text('meta');
    table.string('color');

    table.string('uuid');
    table.string('password');
    table.string('roles');

    table.boolean('deleted').defaultTo(false);
    table.boolean('is_meta');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTableOldV2.BASES, (table) => {
    table.string('id', 20).primary().notNullable();

    // todo: foreign key
    // table.string('project_id', 128);
    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);
    table.string('alias');
    table.text('config');

    table.text('meta');
    table.boolean('is_meta');
    table.string('type');

    table.string('inflection_column');
    table.string('inflection_table');

    // todo: type
    // table.text('ssl');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MODELS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('table_name');
    table.string('title');

    table.string('type').defaultTo('table');

    table.text('meta', 'mediumtext');
    table.text('schema', 'text');
    table.boolean('enabled').defaultTo(true);
    table.boolean('mm').defaultTo(false);

    table.string('tags');
    table.boolean('pinned');

    table.boolean('deleted');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_model_id', 20);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('title');
    table.string('column_name');

    // todo: decide type
    table.string('uidt');
    table.string('dt');
    table.string('np');
    table.string('ns');
    table.string('clen');
    table.string('cop');
    table.boolean('pk');
    table.boolean('pv');
    table.boolean('rqd');
    table.boolean('un');
    table.string('ct');
    table.boolean('ai');
    table.boolean('unique');
    table.string('cdf');
    table.string('cc');
    table.string('csn');
    table.string('dtx');
    table.string('dtxp');
    table.string('dtxs');
    table.boolean('au');

    // todo: normalise
    table.text('validate');

    //todo: virtual, real, etc
    table.boolean('virtual');

    table.boolean('deleted');

    table.boolean('system').defaultTo(false);
    table.float('order');
    table.timestamps(true, true);
  });

  // await knex.schema.createTable(MetaTable.COLUMN_VALIDATIONS, table => {
  //   table
  //     .string('id', 20)
  //     .primary()
  //     .notNullable();
  // })
  /*
  await knex.schema.createTable('nc_col_props_v2', table => {
    table
      .string('id', 20)
      .primary()
      .notNullable();
    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);


    table.string('fk_column_id',20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('cn');
    // todo: decide type
    table.string('uidt');
    table.string('dt');
    table.string('np');
    table.string('ns');
    table.string('clen');
    table.string('cop');
    table.boolean('pk');
    table.boolean('rqd');
    table.boolean('un');
    table.string('ct');
    table.boolean('ai');
    table.boolean('unique');
    table.string('ctf');
    table.string('cc');
    table.string('csn');
    table.string('dtx');
    table.string('dtxp');
    table.string('dtxs');
    table.boolean('au');
    table.timestamps(true, true);
    // table.index(['db_alias', 'tn']);
  });
*/

  await knex.schema.createTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('ref_db_alias');
    table.string('type');
    table.boolean('virtual');
    table.string('db_type');

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_related_model_id', 20);
    table.foreign('fk_related_model_id').references(`${MetaTable.MODELS}.id`);

    // fk_rel_column_id
    // fk_rel_ref_column_id

    table.string('fk_child_column_id', 20);
    table.foreign('fk_child_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_parent_column_id', 20);
    table.foreign('fk_parent_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_mm_model_id', 20);
    table.foreign('fk_mm_model_id').references(`${MetaTable.MODELS}.id`);
    table.string('fk_mm_child_column_id', 20);
    table
      .foreign('fk_mm_child_column_id')
      .references(`${MetaTable.COLUMNS}.id`);
    table.string('fk_mm_parent_column_id', 20);
    table
      .foreign('fk_mm_parent_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.string('ur');
    table.string('dr');

    table.string('fk_index_name');

    table.boolean('deleted');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('title');
    table.string('color');

    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.COL_LOOKUP, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    // todo: refer relation column
    // table.string('fk_child_column_id',20);
    // table.foreign('fk_child_column_id').references(`${MetaTable.COLUMNS}.id`);
    // table.string('fk_parent_column_id',20);
    // table.foreign('fk_parent_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_relation_column_id', 20);
    table
      .foreign('fk_relation_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_lookup_column_id', 20);
    table.foreign('fk_lookup_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.boolean('deleted');

    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.COL_ROLLUP, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_relation_column_id', 20);
    table
      .foreign('fk_relation_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_rollup_column_id', 20);
    table.foreign('fk_rollup_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.string('rollup_function');
    table.boolean('deleted');
    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.COL_FORMULA, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.text('formula').notNullable();
    table.text('formula_raw');

    table.text('error');

    table.boolean('deleted');
    table.float('order');
    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.VIEWS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_model_id', 20);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('title');
    table.integer('type');
    table.boolean('is_default');
    table.boolean('show_system_fields');
    table.string('lock_type').defaultTo('collaborative');

    table.string('uuid');
    table.string('password');

    // todo:  type

    table.boolean('show');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.HOOKS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_model_id', 20);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('title');
    table.string('description', 255);
    table.string('env').defaultTo('all');
    table.string('type');
    table.string('event');

    table.string('operation');
    table.boolean('async').defaultTo(false);
    table.boolean('payload').defaultTo(true);

    table.text('url', 'text');
    table.text('headers', 'text');

    // todo: normalise
    table.boolean('condition').defaultTo(false);

    table.text('notification', 'text');

    table.integer('retries').defaultTo(0);
    table.integer('retry_interval').defaultTo(60000);
    table.integer('timeout').defaultTo(60000);
    table.boolean('active').defaultTo(true);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.HOOK_LOGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_hook_id', 20);
    // table.foreign('fk_hook_id').references(`${MetaTable.HOOKS}.id`);

    table.string('type');
    table.string('event');
    table.string('operation');

    table.boolean('test_call').defaultTo(true);

    table.boolean('payload').defaultTo(true);
    table.text('conditions');
    table.text('notification', 'text');
    table.string('error_code');
    table.string('error_message');
    table.text('error', 'text');
    table.integer('execution_time');
    table.string('response');
    table.string('triggered_by');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FILTER_EXP, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.string('fk_hook_id', 20);
    table.foreign('fk_hook_id').references(`${MetaTable.HOOKS}.id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_parent_id', 20);
    table.foreign('fk_parent_id').references(`${MetaTable.FILTER_EXP}.id`);

    table.string('logical_op');
    table.string('comparison_op');
    table.string('value');
    table.boolean('is_group');

    table.float('order');
    table.timestamps(true, true);
  });

  // await knex.schema.createTable(MetaTable.HOOK_FILTER_EXP, table => {
  //   table
  //     .string('id', 20)
  //     .primary()
  //     .notNullable();
  //
  //   table.string('base_id', 20);
  //   // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
  //   table.string('project_id', 128);
  //   // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);
  //
  //   table.string('fk_hook_id', 20);
  //   table.foreign('fk_hook_id').references(`${MetaTable.HOOKS}.id`);
  //   table.string('fk_column_id', 20);
  //   table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
  //
  //   table.string('fk_parent_id', 20);
  //   table.foreign('fk_parent_id').references(`${MetaTable.HOOK_FILTER_EXP}.id`);
  //
  //   table.string('logical_op');
  //   table.string('comparison_op');
  //   table.string('value');
  //   table.boolean('is_group');
  //
  //   table.float('order');
  //   table.timestamps(true, true);
  // });

  await knex.schema.createTable(MetaTable.SORT, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('direction').defaultTo(false);

    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SHARED_VIEWS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.text('meta', 'mediumtext');
    // todo:
    table.text('query_params', 'mediumtext');
    table.string('view_id');
    table.boolean('show_all_fields');
    table.boolean('allow_copy');
    table.string('password');

    table.boolean('deleted');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FORM_VIEW, (table) => {
    // table
    //   .string('id', 20)
    //   .primary()
    //   .notNullable();
    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.string('heading');
    table.string('subheading');
    table.string('success_msg');
    table.string('redirect_url');
    table.string('redirect_after_secs');
    table.string('email');
    table.boolean('submit_another_form');
    table.boolean('show_blank_form');
    table.string('uuid');
    table.string('banner_image_url');
    table.string('logo_url');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.FORM_VIEW}.fk_view_id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    // todo: type
    table.string('uuid');

    table.string('label');
    table.string('help');
    table.string('description');
    table.boolean('required');
    table.boolean('show');
    table.float('order');

    // todo : condition

    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.GALLERY_VIEW, (table) => {
    // table
    //   .string('id', 20)
    //   .primary()
    //   .notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    // todo:  type
    table.boolean('next_enabled');
    table.boolean('prev_enabled');
    table.integer('cover_image_idx');
    table.string('fk_cover_image_col_id', 20);
    table
      .foreign('fk_cover_image_col_id')
      .references(`${MetaTable.COLUMNS}.id`);
    table.string('cover_image');
    table.string('restrict_types');
    table.string('restrict_size');
    table.string('restrict_number');
    table.boolean('public');
    table.string('dimensions');
    table.string('responsive_columns');
    // todo : condition

    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table
      .foreign('fk_view_id')
      .references(`${MetaTable.GALLERY_VIEW}.fk_view_id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('uuid');

    // todo:  type
    table.string('label');
    table.string('help');

    table.boolean('show');
    table.float('order');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.GRID_VIEW, (table) => {
    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('uuid');

    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.GRID_VIEW}.fk_view_id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('uuid');

    // todo:  type
    table.string('label');
    table.string('help');
    table.string('width').defaultTo('200px');

    table.boolean('show');
    table.float('order');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.KANBAN_VIEW, (table) => {
    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.boolean('show');
    table.float('order');

    table.string('uuid');
    table.string('title');
    // todo:  type
    table.boolean('public');
    table.string('password');
    table.boolean('show_all_fields');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_view_id', 20);
    table
      .foreign('fk_view_id')
      .references(`${MetaTable.KANBAN_VIEW}.fk_view_id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);
    table.string('uuid');

    // todo:  type
    table.string('label');
    table.string('help');
    table.boolean('show');
    table.float('order');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.USERS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('email');
    table.string('password', 255);
    table.string('salt', 255);
    table.string('firstname');
    table.string('lastname');
    table.string('username');
    table.string('refresh_token', 255);
    table.string('invite_token', 255);
    table.string('invite_token_expires', 255);
    table.timestamp('reset_password_expires');
    table.string('reset_password_token', 255);
    table.string('email_verification_token', 255);
    table.boolean('email_verified');
    table.string('roles', 255).defaultTo('editor');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTableOldV2.PROJECT_USERS, (table) => {
    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);
    table.string('fk_user_id', 20);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
    table.text('roles');

    table.boolean('starred');
    table.boolean('pinned');
    table.string('group');
    table.string('color');
    table.float('order');
    table.float('hidden');
    table.timestamp('opened_date');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAMS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS}.id`);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAM_USERS, (table) => {
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS}.id`);
    table.string('user_id', 20);
    table.foreign('user_id').references(`${MetaTable.USERS}.id`);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.AUDIT, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('user');

    table.string('ip');

    table.string('base_id', 20);
    table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    table.string('fk_model_id', 20);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('row_id').index();

    /* op_type - AUTH, DATA, SQL, META */
    table.string('op_type');
    table.string('op_sub_type');
    table.string('status');
    table.text('description');
    table.text('details');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.PLUGIN, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title', 45);
    table.text('description');
    table.boolean('active').defaultTo(false);
    table.float('rating');
    table.string('version');
    table.string('docs');
    table.string('status').defaultTo('install');
    table.string('status_details');
    table.string('logo');
    table.string('icon');
    table.string('tags');
    table.string('category');
    table.text('input_schema');
    table.text('input');
    table.string('creator');
    table.string('creator_website');
    table.string('price');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    // table.foreign('base_id').references(`${MetaTableOldV2.BASES}.id`);
    table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);

    // table.string('fk_model_id', 20);
    // table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.string('role', 45);
    table.boolean('disabled').defaultTo(true);
    table.timestamps(true, true);
  });

  // await knex('nc_plugins').insert([
  //   googleAuth,
  //   ses,
  //   cache
  //   // ee,
  //   // brand,
  // ]);
};

const down = async (knex) => {
  for (const tableName of orderedMetaTables) {
    await knex.schema.dropTable(tableName);
  }
};

export { up, down };
