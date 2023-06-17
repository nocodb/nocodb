import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_models', (table) => {
    table.float('order').unsigned().index();
    table.float('view_order').unsigned().index();
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_models', (table) => {
    table.dropColumn('order');
    table.dropColumn('view_order');
  });
};

export { up, down };
