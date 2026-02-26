import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  // Rename outline view tables to list view tables
  if (await knex.schema.hasTable('nc_outline_view_v2')) {
    await knex.schema.renameTable('nc_outline_view_v2', 'nc_list_view_v2');
  }

  if (await knex.schema.hasTable('nc_outline_view_columns_v2')) {
    await knex.schema.renameTable(
      'nc_outline_view_columns_v2',
      'nc_list_view_columns_v2',
    );
  }

  if (await knex.schema.hasTable('nc_outline_view_levels_v2')) {
    await knex.schema.renameTable(
      'nc_outline_view_levels_v2',
      'nc_list_view_levels_v2',
    );
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasTable('nc_list_view_v2')) {
    await knex.schema.renameTable('nc_list_view_v2', 'nc_outline_view_v2');
  }

  if (await knex.schema.hasTable('nc_list_view_columns_v2')) {
    await knex.schema.renameTable(
      'nc_list_view_columns_v2',
      'nc_outline_view_columns_v2',
    );
  }

  if (await knex.schema.hasTable('nc_list_view_levels_v2')) {
    await knex.schema.renameTable(
      'nc_list_view_levels_v2',
      'nc_outline_view_levels_v2',
    );
  }
};

export { up, down };
