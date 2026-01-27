import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add 'fk_column_id' column to nc_row_color_conditions table
  // For cell-type coloring to specify which field to color
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.string('fk_column_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  // Remove 'fk_column_id' column from nc_row_color_conditions table
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.dropColumn('fk_column_id');
  });
};

export { up, down };