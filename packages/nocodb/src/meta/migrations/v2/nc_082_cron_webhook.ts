import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.string('cron_expression');
    table.string('timezone');
    table.timestamp('last_execution_at');
    table.timestamp('next_execution_at');
  });

  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.index(
      ['event', 'active', 'next_execution_at'],
      'idx_hooks_cron_execution',
    );
  });

  // Disable webhooks for deleted bases
  await knex(MetaTable.HOOKS)
    .update({ active: false })
    .whereIn('base_id', function () {
      this.select('id').from(MetaTable.PROJECT).where('deleted', true);
    });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropIndex(
      ['event', 'active', 'next_execution_at'],
      'idx_hooks_cron_execution',
    );

    table.dropColumn('cron_expression');
    table.dropColumn('timezone');
    table.dropColumn('last_execution_at');
    table.dropColumn('next_execution_at');
  });
};

export { up, down };
