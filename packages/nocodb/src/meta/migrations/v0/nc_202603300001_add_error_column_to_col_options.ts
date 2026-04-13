import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const tables = [
    MetaTable.COL_LOOKUP,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_BARCODE,
  ];

  for (const table of tables) {
    await knex.schema.alterTable(table, (t) => {
      t.text('error').nullable();
    });
  }
};

const down = async (knex: Knex) => {
  const tables = [
    MetaTable.COL_LOOKUP,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_BARCODE,
  ];

  for (const table of tables) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('error');
    });
  }
};

export { up, down };
