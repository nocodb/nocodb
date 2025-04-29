import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/*
  We have grace_period_start_at in the workspace table.
  We need to add new set of columns to track api & automation grace periods as
    they will be available only once whereas grace_period_start_at will be reset if they go below the limit.
*/

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.timestamp('api_grace_period_start_at');
    table.timestamp('automation_grace_period_start_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('api_grace_period_start_at');
    table.dropColumn('automation_grace_period_start_at');
  });
};

export { up, down };
