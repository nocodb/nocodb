import type { Knex } from 'knex';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.SCRIPTS, (table) => {
    table.renameColumn('code', 'script');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.SCRIPTS, (table) => {
    table.renameColumn('script', 'code');
  });
};

export { up, down };
