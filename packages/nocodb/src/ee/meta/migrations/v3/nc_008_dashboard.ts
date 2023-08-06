import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.LAYOUT, async (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('base_id', 20);
    table.string('project_id', 128);
    table.string('title');
    table.boolean('show');
    table.float('order');
    table.text('meta');
    table.string('description', 255);
    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.WIDGET, async (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('layout_id', 20);
    table.string('schema_version', 20);
    table.string('widget_type', 128);
    table.text('data_source');
    table.text('data_config');
    table.text('appearance_config');
    table.string('description', 255);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(
    MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
    async (table) => {
      table.string('dashboard_project_id', 20).notNullable();
      table
        .foreign('dashboard_project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName('nc_ds_dashboard_to_db_project__dashboard_id');
      table.string('db_project_id', 20).notNullable();
      table
        .foreign('db_project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName('nc_ds_dashboard_to_db_project__db_id');
      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable(
    MetaTable.WIDGET_DB_DEPENDENCIES,
    async (table) => {
      table.string('widget_id', 20).notNullable();
      table.foreign('widget_id').references(`${MetaTable.WIDGET}.id`);
      table.string('model_id', 20).notNullable();
      table.foreign('model_id').references(`${MetaTable.MODELS}.id`);
      table.string('view_id', 20).notNullable();
      table.foreign('view_id').references(`${MetaTable.VIEWS}.id`);
      table.string('column_id', 20).notNullable();
      table.foreign('column_id').references(`${MetaTable.COLUMNS}.id`);
      table.timestamps(true, true);
    },
  );
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('fk_widget_id', 200).nullable();
    table.foreign('fk_widget_id').references(`${MetaTable.WIDGET}.id`);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropForeign('fk_widget_id');
    table.dropColumn('fk_widget_id');
  });
  await knex.schema.dropTable(MetaTable.WIDGET_DB_DEPENDENCIES);
  await knex.schema.dropTable(MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS);
  await knex.schema.dropTable(MetaTable.WIDGET);
  await knex.schema.dropTable(MetaTable.LAYOUT);
};

export { up, down };
