import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WIDGETS, (table) => {
    table.boolean('error');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WIDGETS, (table) => {
    table.dropColumn('error');
  });
};

export { up, down };
