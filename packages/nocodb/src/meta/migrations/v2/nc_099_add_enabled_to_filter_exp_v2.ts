import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
    table.boolean('enabled').defaultTo(true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
    table.dropColumn('enabled');
  });
};

export { up, down };
