import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/** Who handled a report, and whether its public link was taken down. */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ABUSE_REPORTS, (table) => {
    table.string('resolved_by', 20);
    table.timestamp('resolved_at', { useTz: true });
    table.string('resource_disabled_by', 20);
    table.timestamp('resource_disabled_at', { useTz: true });

    // Admin queue: newest first within a status.
    table.index(['status', 'created_at'], 'nc_abuse_reports_status_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ABUSE_REPORTS, (table) => {
    table.dropIndex(['status', 'created_at'], 'nc_abuse_reports_status_idx');
    table.dropColumn('resolved_by');
    table.dropColumn('resolved_at');
    table.dropColumn('resource_disabled_by');
    table.dropColumn('resource_disabled_at');
  });
};

export { up, down };
