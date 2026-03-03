import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
    table.text('meta');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
    table.dropColumn('meta');
  });
};

export { up, down };
