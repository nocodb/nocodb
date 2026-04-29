import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_display_value_column_id', 20);
    // Index backs Column.delete2's cleanup of fk_display_value_column_id
    // references on every column delete (and any future lookups by this column).
    table.index(
      ['fk_display_value_column_id'],
      'nc_col_relations_v2_fk_display_value_column_id_index',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropIndex(
      ['fk_display_value_column_id'],
      'nc_col_relations_v2_fk_display_value_column_id_index',
    );
    table.dropColumn('fk_display_value_column_id');
  });
};

export { up, down };
