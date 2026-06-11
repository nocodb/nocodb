import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_LONG_TEXT, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('fk_column_id', 20);

    table.string('fk_integration_id', 20);
    table.string('model', 255);

    table.text('prompt');
    table.text('prompt_raw');
    table.text('error');

    table.timestamps(true, true);

    table.index('fk_column_id');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COL_LONG_TEXT);
};

export { up, down };
