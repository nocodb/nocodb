import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTableOldV2.OUTLINE_VIEW, (table) => {
    table.string('fk_view_id', 20);

    table.string('base_id', 20);

    table.string('source_id', 128);

    table.string('title');

    table.boolean('show_empty_parents');

    table.integer('row_height');

    table.string('fk_prefix_column_id', 20);

    table.text('meta');

    table.string('fk_workspace_id', 20);

    table.timestamps(true, true);

    table.primary(['base_id', 'fk_view_id']);
  });

  await knex.schema.createTable(
    MetaTableOldV2.OUTLINE_VIEW_COLUMNS,
    (table) => {
      table.string('id', 20);

      table.string('base_id', 20);

      table.string('source_id', 128);

      table.string('fk_view_id', 20);

      table.string('fk_column_id', 20);

      table.string('fk_level_id', 20);

      table.boolean('show');

      table.float('order');

      table.string('width', 255);

      table.string('fk_workspace_id', 20);

      table.timestamps(true, true);

      table.primary(['base_id', 'id']);
    },
  );

  await knex.schema.createTable(MetaTableOldV2.OUTLINE_VIEW_LEVELS, (table) => {
    table.string('id', 20);

    table.string('fk_view_id', 20);

    table.integer('level');

    table.string('fk_model_id', 20);

    table.string('fk_link_column_id', 20);

    table.boolean('enable_nested_records');

    table.string('fk_self_link_column_id', 20);

    table.boolean('wrap_headers');

    table.text('meta');

    table.string('base_id', 20);

    table.string('fk_workspace_id', 20);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
  });

  // Add indexes — matching pattern from calendar/grid/kanban view tables
  await knex.schema.alterTable(MetaTableOldV2.OUTLINE_VIEW, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_outline_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_outline_view_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTableOldV2.OUTLINE_VIEW_COLUMNS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_outline_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_outline_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['fk_view_id'], 'nc_outline_view_columns_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTableOldV2.OUTLINE_VIEW_LEVELS, (table) => {
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_outline_view_levels_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_outline_view_levels_v2_fk_view_id_index');
  });

  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.string('fk_level_id', 20);
    table.index(['fk_level_id'], 'nc_sort_v2_fk_level_id_index');
  });

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('fk_level_id', 20);
    table.index(['fk_level_id'], 'nc_filter_exp_v2_fk_level_id_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropIndex([], 'nc_filter_exp_v2_fk_level_id_index');
    table.dropColumn('fk_level_id');
  });
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropIndex([], 'nc_sort_v2_fk_level_id_index');
    table.dropColumn('fk_level_id');
  });
  await knex.schema.dropTable(MetaTableOldV2.OUTLINE_VIEW_LEVELS);
  await knex.schema.dropTable(MetaTableOldV2.OUTLINE_VIEW_COLUMNS);
  await knex.schema.dropTable(MetaTableOldV2.OUTLINE_VIEW);
};

export { up, down };
