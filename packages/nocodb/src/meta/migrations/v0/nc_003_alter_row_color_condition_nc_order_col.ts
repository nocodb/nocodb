import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Change nc_order from integer to float
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.float('nc_order').alter();
  });
};

const down = async (knex: Knex) => {
  // Revert nc_order back to integer
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.integer('nc_order').alter();
  });
};

export { up, down };
