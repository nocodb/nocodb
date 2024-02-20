import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.index(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.index(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.index(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.index(['fk_model_id', 'fk_column_id']);
  });
};

const down = async (knex: Knex) => {

  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_model_id', 'fk_column_id']);
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropIndex(['fk_model_id', 'fk_column_id']);
  });
};

export { up, down };
