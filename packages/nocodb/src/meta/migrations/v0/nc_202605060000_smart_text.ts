import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('fk_row_id').nullable();
    table.index(
      ['base_id', 'fk_column_id', 'fk_row_id'],
      'nc_fr_row_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex(
      ['base_id', 'fk_column_id', 'fk_row_id'],
      'nc_fr_row_idx',
    );
    table.dropColumn('fk_row_id');
  });
};

export { up, down };
