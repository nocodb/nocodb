import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.CALENDAR_VIEW, (table) => {
    table.string('fk_view_id', 20).primary();

    table.string('base_id', 20);

    table.string('source_id', 128);

    table.string('title');

    table.string('fk_cover_image_col_id', 20);

    table.text('meta');

    table.dateTime('created_at');
    table.dateTime('updated_at');
  });

  await knex.schema.createTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('base_id', 20);
    table.string('source_id', 128);

    table.string('fk_view_id', 20);

    table.string('fk_column_id', 20);

    table.boolean('show');

    table.boolean('bold');

    table.boolean('underline');

    table.boolean('italic');

    table.float('order');

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.CALENDAR_VIEW_RANGE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_view_id', 20);

    table.string('fk_to_column_id', 20);

    table.string('label', 40);

    table.string('fk_from_column_id', 20);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.CALENDAR_VIEW);
  await knex.schema.dropTable(MetaTable.CALENDAR_VIEW_COLUMNS);
  await knex.schema.dropTable(MetaTable.CALENDAR_VIEW_RANGE);
};

export { up, down };
