import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_AI, (table) => {
    table.string('id').primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_column_id', 20);

    table.string('fk_integration_id', 20);
    table.string('model', 255);

    table.text('prompt');
    table.text('prompt_raw');
    table.text('error');

    table.boolean('rich_text').defaultTo(false);
    table.boolean('auto_generate').defaultTo(false);

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id']);
    table.index('fk_column_id');
  });

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_integration_id', 20);
    table.string('model', 255);
    table.text('output_column_ids');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.COL_AI);
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_integration_id');
    table.dropColumn('model');
    table.dropColumn('output_column_ids');
  });
};

export { up, down };
