import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SCRIPTS, (table) => {
    table.renameColumn('code', 'script');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SCRIPTS, (table) => {
    table.renameColumn('script', 'code');
  });
};

export { up, down };
