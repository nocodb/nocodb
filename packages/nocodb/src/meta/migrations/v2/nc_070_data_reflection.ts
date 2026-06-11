import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DATA_REFLECTION, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20);

    table.string('username', 255);
    table.string('password', 255);
    table.string('database', 255);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DATA_REFLECTION);
};

export { up, down };
