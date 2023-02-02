import { MetaTable } from '../../utils/globals';

const up = async (knex) => {
  await knex.schema.createTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    table.string('project_id', 128);

    table.string('fk_view_id', 20);
    table.foreign('fk_view_id').references(`${MetaTable.MAP_VIEW}.fk_view_id`);
    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('uuid');

    table.string('label');
    table.string('help');

    table.boolean('show');
    table.float('order');

    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.MAP_VIEW_COLUMNS);
};

export { up, down };
