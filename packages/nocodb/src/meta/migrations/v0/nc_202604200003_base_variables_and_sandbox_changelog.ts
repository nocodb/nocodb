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
    table.index(['fk_sandbox_id'], 'nc_scl_sandbox_id_index');
    table.index(['base_id'], 'nc_scl_base_id_index');
    table.index(['entity_type', 'entity_id'], 'nc_scl_entity_type_id_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.SANDBOX_CHANGELOG);
  await knex.schema.dropTableIfExists(MetaTable.BASE_VARIABLES);
};

export { up, down };
