import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    // Epoch ms. Sessions that started before it are refused; kept out of
    // `meta` because profile updates overwrite that column from the client.
    table.bigInteger('sessions_revoked_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('sessions_revoked_at');
  });
};

export { up, down };
