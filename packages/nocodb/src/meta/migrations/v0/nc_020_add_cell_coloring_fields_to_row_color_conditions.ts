import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add 'type' and 'fk_target_column_id' columns to nc_row_color_conditions table
  // 'type' defaults to 'row' for backward compatibility with existing data
  // 'fk_target_column_id' is for cell-type coloring to specify which field to color
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.string('type', 20).defaultTo('row');
    table.string('fk_target_column_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  // Remove 'type' and 'fk_target_column_id' columns from nc_row_color_conditions table
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.dropColumn('fk_target_column_id');
    table.dropColumn('type');
  });
};

export { up, down };
