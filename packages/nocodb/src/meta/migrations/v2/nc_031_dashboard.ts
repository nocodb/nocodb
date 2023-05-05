import { MetaTable } from 'src/utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DASHBOARD, async (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    table.string('project_id', 128);

    table.string('title');

    table.string('uuid');
    table.boolean('show');
    table.float('order');
    table.text('meta');
    table.timestamps(true, true);
  });
  await knex.schema.createTable(MetaTable.DASHBOARD_WIDGET, async (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('dashboard_id', 20);
    table.string('schema_version', 20);
    table.string('visualisation_type', 128);
    table.text('data_source');
    table.text('data_config');
    table.text('appearance_config');
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DASHBOARD);
  await knex.schema.dropTable(MetaTable.DASHBOARD_WIDGET);
};

export { up, down };
