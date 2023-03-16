import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_models', (table) => {
    table.integer('mm');
    table.text('m_to_m_meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_models', (table) => {
    table.dropColumns('mm', 'm_to_m_meta');
  });
};

export { up, down };
