import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('success_msg').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('redirect_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('banner_image_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.text('logo_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.text('description').alter();
    });
  }
};

const down = async (knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('success_msg').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('redirect_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('banner_image_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.string('logo_url').alter();
    });
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.string('description').alter();
    });
  }
};

export { up, down };
