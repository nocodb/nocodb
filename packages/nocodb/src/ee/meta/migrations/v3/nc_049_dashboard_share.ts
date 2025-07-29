import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.string('fk_dashboard_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.dropColumn('fk_dashboard_id');
  });
};

export { up, down };
