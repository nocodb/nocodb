import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Safety-net migration: ensures nc_timeline_view_* tables exist.
 * If nc_099_timeline_view was recorded as complete but the tables
 * were not actually created (e.g. due to build-cache issues),
 * this migration will create them.
 */
const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW, (table) => {
      table.string('fk_view_id', 20).primary();

      table.string('base_id', 20);

      table.string('source_id', 128);

      table.string('title');

      table.text('meta');

      table.dateTime('created_at');
      table.dateTime('updated_at');
    });
  }

  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW_COLUMNS))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW_COLUMNS, (table) => {
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

      table.text('meta');

      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW_RANGE))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW_RANGE, (table) => {
      table.string('id', 20).primary().notNullable();

      table.string('fk_view_id', 20);

      table.string('fk_from_column_id', 20);

      table.string('fk_to_column_id', 20);

      table.string('label', 40);

      table.timestamps(true, true);
    });
  }
};

const down = async (_knex: Knex) => {
  // no-op: nc_099 handles the drop
};

export { up, down };
