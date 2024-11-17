import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('refresh_token');
  });

  await knex.schema.createTable(MetaTable.USER_REFRESH_TOKENS, (table) => {
    table.string('fk_user_id', 20).index();
    table.string('token', 255).index();
    table.text('meta');

    table.timestamp('expires_at').index();

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.USER_REFRESH_TOKENS);
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('refresh_token', 255);
  });
};

export { up, down };
