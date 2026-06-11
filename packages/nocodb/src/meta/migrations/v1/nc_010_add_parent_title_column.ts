import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable('nc_disabled_models_for_role', (table) => {
    table.string('parent_model_title');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable('nc_disabled_models_for_role', (table) => {
    table.dropColumn('parent_model_title');
  });
};

export { up, down };
