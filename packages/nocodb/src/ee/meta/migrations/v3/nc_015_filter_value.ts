import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.text('value').alter();
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('value', 255).alter();
  });
};

export { up, down };
