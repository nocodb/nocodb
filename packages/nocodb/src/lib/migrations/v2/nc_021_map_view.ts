import { MetaTable } from '../../utils/globals';
import Knex from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.MAP_VIEW, (table) => {
    table.string('fk_view_id', 20).primary();
    table.foreign('fk_view_id').references(`${MetaTable.VIEWS}.id`);

    table.string('base_id', 20);
    table.foreign('base_id').references(`${MetaTable.BASES}.id`);

    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('uuid');
    table.string('title');

    table.string('fk_geo_data_col_id', 20);
    table.foreign('fk_geo_data_col_id').references(`${MetaTable.COLUMNS}.id`);

    table.text('meta');

    table.dateTime('created_at');
    table.dateTime('updated_at');
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.MAP_VIEW);
};

export { up, down };
