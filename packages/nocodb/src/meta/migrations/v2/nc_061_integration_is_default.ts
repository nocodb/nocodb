import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.boolean('is_default').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('is_default');
  });
};

export { up, down };
