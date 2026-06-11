import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.primary(['base_id', 'fk_user_id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.dropPrimary();
  });
};

export { up, down };
