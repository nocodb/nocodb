import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.boolean('enabled');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropColumn('enabled');
  });
};

export { up, down };
