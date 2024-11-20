import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.boolean('is_snapshot').defaultTo(false);
  });

  await knex.schema.createTable(MetaTable.SNAPSHOT, (table) => {
    table.string('id', 20).primary();
    table.string('title', 512);
    table.string('fk_base_id', 20);

    table.string('fk_workspace_id', 20);

    table.string('created_by', 20);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('is_snapshot');
  });

  await knex.schema.dropTableIfExists(MetaTable.SNAPSHOT);
};

export { up, down };
