import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DASHBOARDS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('title', 255).notNullable();
    table.text('description');
    table.text('meta');
    table.integer('order').unsigned();

    table.string('created_by', 20);
    table.string('owned_by', 20);

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_dashboards_context');
  });

  await knex.schema.createTable(MetaTable.WIDGETS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_dashboard_id', 20).notNullable();

    table.string('fk_model_id', 20);
    table.string('fk_view_id', 20);

    table.string('title', 255).notNullable();
    table.text('description');
    table.string('type', 50).notNullable();
    table.text('config');
    table.text('meta');
    table.integer('order').unsigned();
    table.text('position');

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_widgets_context');
    table.index('fk_dashboard_id', 'nc_widgets_dashboard_idx');
  });

  if (!(await knex.schema.hasColumn(MetaTable.FILTER_EXP, 'fk_widget_id'))) {
    await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
      table.string('fk_widget_id', 20).index();
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.WIDGETS);
  await knex.schema.dropTable(MetaTable.DASHBOARDS);

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropColumn('fk_widget_id');
  });
};

export { up, down };
