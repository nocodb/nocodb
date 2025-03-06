import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.HOOK_TRIGGER_FIELDS, (table) => {
    table.string('fk_hook_id', 20).primary().notNullable();
    table.string('fk_column_id', 20).primary().notNullable();
  });

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.boolean('triggerField').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.HOOK_TRIGGER_FIELDS);

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('triggerField');
  });
};

export { up, down };
