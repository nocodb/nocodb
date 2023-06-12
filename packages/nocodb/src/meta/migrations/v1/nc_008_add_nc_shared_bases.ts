import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable('nc_shared_bases', (table) => {
    table.increments();
    table.string('project_id');
    table.string('db_alias');
    table.string('roles').defaultTo('viewer');
    table.string('shared_base_id');
    table.boolean('enabled').defaultTo(true);
    table.string('password');
    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable('nc_shared_bases');
};

export { up, down };
