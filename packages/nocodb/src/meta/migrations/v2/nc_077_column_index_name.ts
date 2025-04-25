import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.string('custom_index_name', 64);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('custom_index_name');
  });
};

export { up, down };
