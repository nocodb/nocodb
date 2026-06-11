import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.integer('row_height');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.dropColumns('row_height');
  });
};

export { up, down };
