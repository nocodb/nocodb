import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_users_v2', (table) => {
    table.string('token_version');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_users_v2', (table) => {
    table.dropColumns('token_version');
  });
};

export { up, down };
