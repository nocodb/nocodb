import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_integration_id', 20);
    table.string('model', 255);
    table.text('output_column_ids');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_integration_id');
    table.dropColumn('model');
    table.dropColumn('output_column_ids');
  });
};

export { up, down };
