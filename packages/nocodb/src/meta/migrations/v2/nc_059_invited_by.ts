import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.string('invited_by', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.dropColumn('invited_by');
  });
};

export { up, down };
