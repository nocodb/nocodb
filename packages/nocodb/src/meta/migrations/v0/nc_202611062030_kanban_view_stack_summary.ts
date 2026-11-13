import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.string('summary_fn', 30).nullable().defaultTo(null);
    table.string('fk_summary_col_id', 20).nullable().defaultTo(null);
    table.text('summary_label').nullable().defaultTo(null);
    table.text('summary_colors').nullable().defaultTo(null);
    table.index(
      ['fk_summary_col_id'],
      'nc_kanban_view_v2_fk_summary_col_id_index',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.dropIndex(
      ['fk_summary_col_id'],
      'nc_kanban_view_v2_fk_summary_col_id_index',
    );
    table.dropColumn('summary_fn');
    table.dropColumn('fk_summary_col_id');
    table.dropColumn('summary_label');
    table.dropColumn('summary_colors');
  });
};

export { up, down };
