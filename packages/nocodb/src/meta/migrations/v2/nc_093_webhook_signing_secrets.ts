import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.text('signing_secret');
    table.timestamp('signing_secret_updated_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('signing_secret');
    table.dropColumn('signing_secret_updated_at');
  });
};

export { up, down };
