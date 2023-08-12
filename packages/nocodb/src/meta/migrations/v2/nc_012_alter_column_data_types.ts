import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (knex.client.config.client !== 'sqlite3') {
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
  }
};

const down = async (knex) => {
  if (knex.client.config.client !== 'sqlite3') {
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
  }
};

export { up, down };
