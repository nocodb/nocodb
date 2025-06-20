import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DB_SERVERS, (table) => {
    table.string('id', 20).primary();
    table.string('title', 255);
    table.boolean('is_shared').defaultTo(true);
    table.integer('max_tenants');
    table.integer('current_tenant_count').defaultTo(0);
    table.text('config');
    table.text('conditions');

    table.timestamps(true, true);
  });
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.string('db_job_id', 20);
    table.string('fk_db_instance_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DB_SERVERS);
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('db_job_id');
    table.dropColumn('fk_db_instance_id');
  });
};

export { up, down };
