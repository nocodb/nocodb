import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.boolean('is_encrypted').defaultTo(false).index();
  });
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.boolean('is_encrypted').defaultTo(false).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.dropColumn('is_encrypted');
  });
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('is_encrypted');
  });
};

export { up, down };
