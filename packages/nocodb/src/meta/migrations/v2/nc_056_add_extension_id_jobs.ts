import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.JOBS, (table) => {
    table.string('extension_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.JOBS, (table) => {
    table.dropColumn('extension_id');
  });
};

export { up, down };
