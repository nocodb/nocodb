import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.string('row_id', 32);
    table.index('row_id', 'idx_nc_form_view_columns_row_id');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropIndex('row_id', 'idx_nc_form_view_columns_row_id');
    table.dropColumn('row_id');
  });
};

export { up, down };
