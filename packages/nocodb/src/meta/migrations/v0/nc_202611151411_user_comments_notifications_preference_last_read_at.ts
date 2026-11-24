import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.timestamp('last_read_at');
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.dropColumn('last_read_at');
    },
  );
};

export { up, down };
