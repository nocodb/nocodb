import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.boolean('is_local').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('is_local');
  });
};

export { up, down };
