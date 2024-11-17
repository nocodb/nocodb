import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);

    table.string('fk_user_id', 20);

    table.string('title');

    table.text('config');

    table.string('type');

    table.string('sub_type');

    table.float('order');

    table.boolean('deleted').defaultTo(false);

    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.string('fk_integration_id', 20);
  });

  /*
    Move MetaTable.BASES records to MetaTable.INTEGRATIONS
  */
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTEGRATIONS);

  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('fk_integration_id');
  });
};

export { up, down };
