import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.text('subheading').alter();
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.text('success_msg').alter();
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.text('label').alter();
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.text('description').alter();
  });
};

const down = async (knex: Knex) => {};

export { up, down };
