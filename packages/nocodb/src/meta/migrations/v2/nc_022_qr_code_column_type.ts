import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_QRCODE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_qr_value_column_id', 20);
    table
      .foreign('fk_qr_value_column_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.boolean('deleted');
    table.float('order');
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COL_QRCODE);
};

export { up, down };
