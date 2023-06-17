import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_shared_views', (table) => {
    table.string('view_type');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_shared_views', (table) => {
    table.dropColumns('view_type');
  });
};

export { up, down };
