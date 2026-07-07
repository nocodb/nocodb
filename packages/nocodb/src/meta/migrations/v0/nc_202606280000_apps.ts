import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.APPS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('meta');
    table.float('order');
    table.string('fk_draft_version_id', 20);
    table.string('fk_live_version_id', 20);
    table.text('last_build_error');
    table.string('created_by', 20);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
    // Composite PK so the same id can coexist across a sandbox base and its
    // production base — required for sandbox merge / replay id preservation
    // (matches every other replayable meta table, see nc_051_composite_pk).
    table.primary(['base_id', 'id']);
    table.index(['base_id', 'fk_workspace_id'], 'nc_apps_context');
    table.string('slug', 255);
    table.unique(['slug'], { indexName: 'nc_apps_slug' });
  });

  await knex.schema.createTable(MetaTable.APP_VERSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.integer('version_number').notNullable().defaultTo(0);
    table.string('status', 20).notNullable().defaultTo('draft');
    table.string('git_sha', 40);
    table.string('claude_session_id', 64);
    table.string('created_by', 20);
    table.timestamps(true, true);
    // Composite PK — see APPS above (sandbox merge id preservation).
    table.primary(['base_id', 'id']);
    // Scope the per-app version uniqueness by base_id so a sandbox copy and
    // its production base can both hold the same (fk_app_id, version_number)
    // after merge (fk_app_id is itself preserved across the merge).
    table.unique(['base_id', 'fk_app_id', 'version_number'], {
      indexName: 'nc_app_versions_app_version_idx',
    });
    table.index(['base_id', 'fk_workspace_id'], 'nc_app_versions_context');
  });

  await knex.schema.createTable(MetaTable.APP_CHAT_MESSAGES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('role', 20).notNullable();
    table.text('parts');
    table.string('git_sha', 40);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.index(['base_id', 'fk_app_id'], 'nc_app_chat_messages_context');
  });

  await knex.schema.createTable(MetaTable.APP_ROUTINES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.string('name', 80).notNullable();
    table.text('description');
    table.string('fk_current_version_id', 20);
    table.string('created_by', 20);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_app_id', 'name'], {
      indexName: 'nc_app_routines_app_name',
    });
    table.index(['base_id', 'fk_workspace_id'], 'nc_app_routines_ctx');
  });

  await knex.schema.createTable(MetaTable.APP_ROUTINE_VERSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_routine_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.integer('version_number').notNullable();
    table.string('source_type', 20).notNullable();
    table.text('source_ref');
    table.string('operation', 40).notNullable();
    table.text('template');
    table.text('param_schema');
    table.string('body_hash', 64);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_routine_id', 'version_number'], {
      indexName: 'nc_app_routine_versions_seq',
    });
    table.index(['base_id', 'fk_workspace_id'], 'nc_app_routine_versions_ctx');
  });

  await knex.schema.createTable(MetaTable.APP_VERSION_ROUTINES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_app_version_id', 20).notNullable();
    table.string('fk_routine_id', 20).notNullable();
    table.string('fk_routine_version_id', 20).notNullable();
    table.string('routine_name', 80).notNullable();
    table.string('base_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_app_version_id', 'routine_name'], {
      indexName: 'nc_app_version_routines_pin',
    });
    table.index(['fk_routine_version_id'], 'nc_app_version_routines_ver');
  });

  await knex.schema.createTable(MetaTable.APP_INTEGRATION_GRANTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_integration_id', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.text('reason');
    table.string('requested_by', 20);
    table.string('granted_by', 20);
    table.timestamp('granted_at');
    table.timestamps(true, true);
    table.primary(['id']);
    table.index(['fk_workspace_id', 'fk_app_id'], 'nc_aig_app');
    table.index(['fk_workspace_id', 'fk_integration_id'], 'nc_aig_integration');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.APP_INTEGRATION_GRANTS);
  await knex.schema.dropTable(MetaTable.APP_VERSION_ROUTINES);
  await knex.schema.dropTable(MetaTable.APP_ROUTINE_VERSIONS);
  await knex.schema.dropTable(MetaTable.APP_ROUTINES);
  await knex.schema.dropTable(MetaTable.APP_CHAT_MESSAGES);
  await knex.schema.dropTable(MetaTable.APP_VERSIONS);
  await knex.schema.dropTable(MetaTable.APPS);
};

export { up, down };
