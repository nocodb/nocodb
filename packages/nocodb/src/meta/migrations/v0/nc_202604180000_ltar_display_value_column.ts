import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_display_value_column_id', 20);
    // Column.delete2 cleans up fk_display_value_column_id references on every
    // column delete — without this index it triggers a full-table scan on
    // nc_col_relations_v2 (existing composite index is (base_id, fk_workspace_id)
    // with base_id leading, so a workspace filter alone can't help).
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
