import { MetaTable } from 'src/utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DASHBOARD, async (table) => {
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
    table.string('dashboard_id', 20);
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
      table.string('id', 20).primary().notNullable();
      table.string('dashboard_project_id', 20).notNullable();
      table
        .foreign('dashboard_project_id')
        .references(`${MetaTable.PROJECT}.id`);
      table.string('db_project_id', 20).notNullable();
      table.foreign('db_project_id').references(`${MetaTable.PROJECT}.id`);
      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable(
    MetaTable.WIDGET_DB_DEPENDENCIES,
    async (table) => {
      table.string('id', 20).primary().notNullable();
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
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DASHBOARD);
  await knex.schema.dropTable(MetaTable.WIDGET);
  await knex.schema.dropTable(MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS);
  await knex.schema.dropTable(MetaTable.WIDGET_DB_DEPENDENCIES);
};

export { up, down };
