import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_BARCODE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_barcode_value_column_id', 20);
    table
      .foreign('fk_barcode_value_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.string('barcode_format', 15);
    table.boolean('deleted');
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COL_BARCODE);
};

export { up, down };
