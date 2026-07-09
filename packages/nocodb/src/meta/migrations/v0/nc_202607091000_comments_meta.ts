import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.text('meta');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropColumn('meta');
  });
};

export { up, down };
