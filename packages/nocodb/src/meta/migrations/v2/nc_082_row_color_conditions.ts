import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ROW_COLOR_CONDITIONS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_view_id', 20);

    table.string('fk_workspace_id', 20);

    table.string('base_id', 20);
    table.string('color', 20);
    table.integer('nc_order');
    table.boolean('is_set_as_background');

    table.index(['fk_workspace_id', 'base_id']);
    table.index('fk_view_id');

    table.timestamps(true, true);
  });
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.string('row_coloring_mode', 10);
  });
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('fk_row_color_condition_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.ROW_COLOR_CONDITIONS);
  await knex.schema.alterTable(MetaTable.VIEWS, (table) =>
    table.dropColumn('row_coloring_mode'),
  );
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) =>
    table.dropColumn('fk_row_color_condition_id'),
  );
};

export { up, down };
