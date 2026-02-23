import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.TIMELINE_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('title', 255);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps();
    table.primary(['base_id', 'fk_view_id']);
  });

  await knex.schema.createTable(MetaTable.TIMELINE_VIEW_COLUMNS, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('fk_view_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('show');
    table.boolean('bold');
    table.boolean('underline');
    table.boolean('italic');
    table.float('order');
    table.boolean('group_by');
    table.float('group_by_order');
    table.string('group_by_sort', 4);
    table.string('aggregation', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });

  await knex.schema.createTable(MetaTable.TIMELINE_VIEW_RANGE, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_view_id', 20);
    table.string('fk_from_column_id', 20);
    table.string('fk_to_column_id', 20);
    table.string('label', 40);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW_RANGE);
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW);
};

export { up, down };
