import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.USAGE_STATS, (table) => {
    table.string('fk_workspace_id', 20);
    table.string('usage_type', 255); // 'api', 'automation', 'storage', 'webhook'

    table.date('period_start');

    table.integer('count').defaultTo(0);

    table.timestamps(true, true);

    table.primary(['fk_workspace_id', 'usage_type', 'period_start']);

    table.index(
      ['fk_workspace_id', 'period_start'],
      'nc_usage_stats_ws_period_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.timestamp('grace_period_start_at');
  });

  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.timestamp('billing_cycle_anchor');
  });

  // update existing subscriptions to set billing_cycle_anchor to start_at
  await knex(MetaTable.SUBSCRIPTIONS)
    .update({
      billing_cycle_anchor: knex.raw('start_at'),
    })
    .whereNotNull('start_at')
    .whereNull('billing_cycle_anchor');
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.USAGE_STATS);

  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('grace_period_start_at');
  });

  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.dropColumn('billing_cycle_anchor');
  });
};

export { up, down };
