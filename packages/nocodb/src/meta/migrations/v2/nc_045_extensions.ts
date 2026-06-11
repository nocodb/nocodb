import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.EXTENSIONS, (table) => {
    table.string('id', 20).primary();

    table.string('base_id', 20).index();

    table.string('fk_user_id', 20);

    table.string('extension_id');

    table.string('title');

    table.text('kv_store');

    table.text('meta');

    table.float('order');

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.EXTENSIONS);
};

export { up, down };
