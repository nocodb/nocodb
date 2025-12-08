import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.text('internal_meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('internal_meta');
  });
};

export { up, down };
