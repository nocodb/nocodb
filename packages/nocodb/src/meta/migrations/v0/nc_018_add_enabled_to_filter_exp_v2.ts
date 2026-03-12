import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn('nc_filter_exp_v2', 'enabled');
  if (!hasColumn) {
    await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
      table.boolean('enabled').defaultTo(true);
    });
  }
};

const down = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn('nc_filter_exp_v2', 'enabled');
  if (hasColumn) {
    await knex.schema.alterTable('nc_filter_exp_v2', (table) => {
      table.dropColumn('enabled');
    });
  }
};

export { up, down };
