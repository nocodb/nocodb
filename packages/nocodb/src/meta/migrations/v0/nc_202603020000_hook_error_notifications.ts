import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
    table.timestamp('error_notified_at', { useTz: true });
    table.index(['error_notified_at'], 'nc_hook_logs_error_notify_idx');
  });

  await knex(MetaTable.HOOK_LOGS)
    .whereNotNull('error')
    .update({ error_notified_at: knex.fn.now() });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
    table.dropIndex(['error_notified_at'], 'nc_hook_logs_error_notify_idx');
  });
  await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
    table.dropColumn('error_notified_at');
  });
};

export { up, down };
