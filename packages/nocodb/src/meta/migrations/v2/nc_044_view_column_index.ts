import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  console.log('Adding index to view column tables...');
  console.time('Added index to Grid view columns');
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Grid view columns');

  console.time('Added index to Gallery view columns');
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Gallery view columns');

  console.time('Added index to Kanban view columns');
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Kanban view columns');

  console.time('Added index to Form view columns');
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Form view columns');

  console.time('Added index to Calendar view columns');
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Calendar view columns');

  console.time('Added index to Map view columns');
  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.index(['fk_view_id', 'fk_column_id']);
  });
  console.timeEnd('Added index to Map view columns');
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_view_id', 'fk_column_id']);
  });
};

export { up, down };
