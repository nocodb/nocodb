import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BASE_VARIABLES, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('key', 255);
    table.text('value');
    table.text('description');
    table.string('inheritance', 20).defaultTo('fixed');
    table.string('type', 20).defaultTo('text');
    table.float('order');
    table.text('default_value');
    table.boolean('is_overridden').defaultTo(false);
    table.boolean('is_inherited').defaultTo(false);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });

  await knex.schema.alterTable(MetaTable.BASE_VARIABLES, (table) => {
    table.unique(
      ['fk_workspace_id', 'base_id', 'key'],
      'nc_base_variables_ws_base_key_unique',
    );
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_base_variables_base_ws_index',
    );
  });

  await knex.schema.createTable(MetaTable.SANDBOX_CHANGELOG, (table) => {
    table.string('id', 20).notNullable().primary();
    // App-managed monotonic counter (microseconds + intra-tick increment).
    // Replay iterates in seq-ASC order. created_at has only second precision
    // (meta.service.ts now()), so we cannot rely on it alone for ordering.
    table.bigInteger('seq').notNullable();
    table.string('fk_sandbox_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('event', 80).notNullable();
    table.string('entity_type', 40).notNullable();
    table.string('entity_id', 20);
    table.string('entity_title', 255);
    table.string('parent_entity_id', 20);
    table.string('parent_entity_title', 255);
    table.string('created_by', 20).notNullable();
    table.text('description').nullable();
    table.text('meta');
    table.string('status', 20).notNullable().defaultTo('pending');
    table.timestamp('merged_at');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.SANDBOX_CHANGELOG, (table) => {
    table.index(['fk_sandbox_id', 'seq'], 'nc_scl_sandbox_seq_index');
    table.index(['base_id'], 'nc_scl_base_id_index');
    table.index(['entity_type', 'entity_id'], 'nc_scl_entity_type_id_index');
  });

  // Re-scope subscriber unique index to include base_id so sandbox and
  // production can hold parallel subscriber rows for the same (workflow, user)
  // pair.
  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.dropUnique(
      ['fk_automation_id', 'fk_user_id'],
      'nc_automation_subscribers_unique_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.unique(['base_id', 'fk_automation_id', 'fk_user_id'], {
      indexName: 'nc_automation_subscribers_unique_idx',
    });
  });

  // Sandbox terminology: rename "master" → "production" on sandbox-related
  // tables. Managed-app `managed_app_master` is a separate concept (template
  // vs installed instance) and is left unchanged.
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.dropIndex(['master_base_id'], 'nc_sandboxes_v2_master_base_id_idx');
  });
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.renameColumn('master_base_id', 'production_base_id');
  });
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.index(
      ['production_base_id'],
      'nc_sandboxes_v2_production_base_id_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(['is_sandbox_master'], 'nc_bases_is_sandbox_master_idx');
  });
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.renameColumn('is_sandbox_master', 'is_sandbox_production');
  });
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(
      ['is_sandbox_production'],
      'nc_bases_is_sandbox_production_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Reverse sandbox terminology rename
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(
      ['is_sandbox_production'],
      'nc_bases_is_sandbox_production_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.renameColumn('is_sandbox_production', 'is_sandbox_master');
  });
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['is_sandbox_master'], 'nc_bases_is_sandbox_master_idx');
  });

  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.dropIndex(
      ['production_base_id'],
      'nc_sandboxes_v2_production_base_id_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.renameColumn('production_base_id', 'master_base_id');
  });
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.index(['master_base_id'], 'nc_sandboxes_v2_master_base_id_idx');
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.dropUnique(
      ['base_id', 'fk_automation_id', 'fk_user_id'],
      'nc_automation_subscribers_unique_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.unique(['fk_automation_id', 'fk_user_id'], {
      indexName: 'nc_automation_subscribers_unique_idx',
    });
  });

  await knex.schema.dropTableIfExists(MetaTable.SANDBOX_CHANGELOG);
  await knex.schema.dropTableIfExists(MetaTable.BASE_VARIABLES);
};

export { up, down };
