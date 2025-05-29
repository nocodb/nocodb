import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.integer('version', 10);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('version');
  });
};

export { up, down };
