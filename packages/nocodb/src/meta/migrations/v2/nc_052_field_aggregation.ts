import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.string('aggregation', 30).nullable().defaultTo(null);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.dropColumn('aggregation');
  });
};

export { up, down };
