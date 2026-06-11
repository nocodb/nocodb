import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.text('meta');
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.text('meta');
  });
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.text('meta');
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.text('meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.dropColumns('meta');
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropColumns('meta');
  });
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.dropColumns('meta');
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.dropColumns('meta');
  });
};

export { up, down };
