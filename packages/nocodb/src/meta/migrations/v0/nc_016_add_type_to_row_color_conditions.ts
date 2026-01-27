import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add 'type' column to nc_row_color_conditions table
  // Default to 'row' for backward compatibility with existing data
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.string('type', 20).defaultTo('row');
  });
};

const down = async (knex: Knex) => {
  // Remove 'type' column from nc_row_color_conditions table
  await knex.schema.alterTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.dropColumn('type');
  });
};

export { up, down };