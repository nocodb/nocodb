import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.HOOK_TRIGGER_FIELDS, (table) => {
    table.string('fk_hook_id', 20).notNullable();
    table.string('fk_column_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.timestamps(true, true);
    table.primary(['fk_workspace_id', 'base_id', 'fk_hook_id', 'fk_column_id']);
  });

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.boolean('trigger_field').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.HOOK_TRIGGER_FIELDS);

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('triggerField');
  });
};

export { up, down };
