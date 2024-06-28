import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.JOBS, (table) => {
    table.string('id', 20).primary();

    table.string('job', 255);

    table.string('status', 20);

    table.text('result');

    table.string('fk_user_id', 20);

    table.string('fk_workspace_id', 20);

    table.string('base_id', 20);

    table.timestamps(true, true);

    // TODO - add indexes
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.JOBS);
};

export { up, down };
