import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.boolean('is_schema_readonly').defaultTo(false);
    table.boolean('is_data_readonly').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('is_schema_readonly');
    table.dropColumn('is_data_readonly');
  });
};

export { up, down };
