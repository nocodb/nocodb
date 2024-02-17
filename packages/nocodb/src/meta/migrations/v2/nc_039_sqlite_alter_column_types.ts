import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (knex.client.config.client === 'sqlite3') {
    //nc_012_alter_colum_data_types.ts
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.text('cdf').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.text('dtxp').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.text('cc').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.text('ct').alter();
    });
    //nc_014_alter_colum_data_types.ts
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
    //nc_016_alter_hooklog_payload_types.ts
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('payload').alter();
    });
    //nc_029_webhook.ts
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('response').alter();
    });
  }
};

const down = async (knex) => {
  if (knex.client.config.client === 'sqlite3') {
    //nc_012_alter_colum_data_types.ts
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.string('cdf').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.string('dtxp').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.string('cc').alter();
    });
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.string('ct').alter();
    });
    //nc_014_alter_colum_data_types.ts
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
    //nc_016_alter_hooklog_payload_types.ts
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.boolean('payload').alter();
    });
    //nc_029_webhook.ts
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.boolean('response').alter();
    });
  }
};

export { up, down };
