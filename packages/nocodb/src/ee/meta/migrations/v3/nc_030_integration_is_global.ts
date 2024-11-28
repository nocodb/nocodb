import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.boolean('is_global').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('is_global');
  });
};

export { up, down };
