import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.SHARED_VIEWS);
  await knex.schema.dropTableIfExists(MetaTable.TEAM_USERS);
  await knex.schema.dropTableIfExists(MetaTable.TEAMS);
  await knex.schema.dropTableIfExists(MetaTable.ORGS_OLD);
  await knex.schema.dropTableIfExists('nc_shared_bases');
};

const down = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SHARED_VIEWS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_view_id', 20);
    table.text('meta');
    table.text('query_params');
    table.string('view_id', 255);
    table.boolean('show_all_fields');
    table.boolean('allow_copy');
    table.string('password', 255);
    table.boolean('deleted');
    table.float('order');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable(MetaTable.TEAM_USERS, (table) => {
    table.string('org_id', 20);
    table.string('user_id', 20);
    table.timestamps(true, true);
    // No explicit PK
  });

  await knex.schema.createTable(MetaTable.TEAMS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 255);
    table.string('org_id', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.ORGS_OLD, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 255);
    table.timestamps(true, true);
  });
};

export { up, down };
