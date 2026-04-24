import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.GANTT_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('title', 255);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'fk_view_id']);
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gantt_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_gantt_view_v2_oldpk_idx');
  });

  await knex.schema.createTable(MetaTable.GANTT_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('show');
    table.boolean('bold');
    table.boolean('underline');
    table.boolean('italic');
    table.float('order');
    table.boolean('group_by');
    table.float('group_by_order');
    table.string('group_by_sort', 4);
    table.string('aggregation', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gantt_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_gantt_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['id'], 'nc_gantt_view_columns_v2_oldpk_idx');
  });

  // Date dependency config (start/end/predecessor/duration/weekends) lives on
  // the table meta (`nc_date_dependency`). Gantt consumes it directly; no
  // per-view range table is needed.
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.GANTT_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.GANTT_VIEW);
};

export { up, down };
