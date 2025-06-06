import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.string('cron_expression');
    table.timestamp('last_execution_at');
    table.timestamp('next_execution_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('cron_expression');
    table.dropColumn('last_execution_at');
    table.dropColumn('next_execution_at');
  });
};

export { up, down };
