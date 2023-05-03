import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_shared_views', (table) => {
    table.integer('view_name');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_shared_views', (table) => {
    table.dropColumns('view_name');
  });
};

export { up, down };
