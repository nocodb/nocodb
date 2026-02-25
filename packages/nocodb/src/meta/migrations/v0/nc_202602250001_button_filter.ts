import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(
    MetaTable.FILTER_EXP,
    'fk_button_col_id',
  );
  if (!hasColumn) {
    await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
      table.string('fk_button_col_id', 20);
      table.index('fk_button_col_id');
    });
  }
};

const down = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(
    MetaTable.FILTER_EXP,
    'fk_button_col_id',
  );
  if (hasColumn) {
    await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
      table.dropIndex('fk_button_col_id');
      table.dropColumn('fk_button_col_id');
    });
  }
};

export { up, down };
