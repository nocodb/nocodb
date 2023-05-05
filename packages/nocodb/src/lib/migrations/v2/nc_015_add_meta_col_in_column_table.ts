import { MetaTable } from '../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.text('meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('meta');
  });
};

export { up, down };
