import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTableOldV2.LAYOUT, async (table) => {
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
  await knex.schema.createTable(MetaTableOldV2.WIDGET, async (table) => {
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
    MetaTableOldV2.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
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
    MetaTableOldV2.WIDGET_DB_DEPENDENCIES,
    async (table) => {
      table.string('widget_id', 20).notNullable();
      table.foreign('widget_id').references(`${MetaTableOldV2.WIDGET}.id`);
      table.string('model_id', 20).notNullable();
      table.foreign('model_id').references(`${MetaTable.MODELS}.id`);
      table.string('view_id', 20).notNullable();
      table.foreign('view_id').references(`${MetaTable.VIEWS}.id`);
      table.string('column_id', 20).notNullable();
      table.foreign('column_id').references(`${MetaTable.COLUMNS}.id`);
      table.timestamps(true, true);
    },
  );
  await knex.schema.alterTable(MetaTable.FILTER_EXP, async (table) => {
    // In V2 Migration, `fk_widget_id` was added to `filter_exp`
    if (!(await knex.schema.hasColumn(MetaTable.FILTER_EXP, 'fk_widget_id'))) {
      table.string('fk_widget_id', 200).nullable();
    }

    // This fk relation is removed in nc_013_remove_fk_and_add_idx migration
    table.foreign('fk_widget_id').references(`${MetaTableOldV2.WIDGET}.id`);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropForeign('fk_widget_id');
    table.dropColumn('fk_widget_id');
  });
  await knex.schema.dropTable(MetaTableOldV2.WIDGET_DB_DEPENDENCIES);
  await knex.schema.dropTable(
    MetaTableOldV2.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
  );
  await knex.schema.dropTable(MetaTableOldV2.WIDGET);
  await knex.schema.dropTable(MetaTableOldV2.LAYOUT);
};

export { up, down };
