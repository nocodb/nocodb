import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.primary(['id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.dropPrimary('id');
  });
};

export { up, down };
