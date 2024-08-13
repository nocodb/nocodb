import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_BUTTON, (table) => {
    table.string('id', 20);

    table.string('base_id', 20);

    table.string('type');

    table.text('label');

    table.string('theme');

    table.string('color');

    table.text('formula');

    table.text('formula_raw');

    table.string('error');

    table.string('webhook_id', 20);

    table.string('fk_column_id', 20);

    table.text('parsed_tree');

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COL_BUTTON);
};

export { up, down };
