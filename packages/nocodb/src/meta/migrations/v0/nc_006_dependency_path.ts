import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.text('path');
    table.text('meta');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropColumn('path');
    table.dropColumn('meta');
  });
};

export { up, down };
