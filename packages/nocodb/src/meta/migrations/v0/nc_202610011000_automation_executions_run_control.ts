import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// nc_automation_executions is in the prod logical-replication publication with an
// explicit column list — mirror these columns on the replica.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.timestamp('heartbeat_at', { useTz: true });
    table.string('control', 20);
    table.string('fk_retry_of_id', 20);
    table.string('claim_id', 20);
    table.string('job_id', 64);
  });
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.index(
      ['status', 'heartbeat_at'],
      'nc_automation_executions_heartbeat_idx',
    );
    table.index(
      ['base_id', 'fk_retry_of_id'],
      'nc_automation_executions_retry_of_idx',
    );
    // The resume sweep's cross-workspace scan; the existing resume index leads with the workspace.
    table.index(
      ['status', 'resume_at'],
      'nc_automation_executions_status_resume_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropIndex(
      ['status', 'heartbeat_at'],
      'nc_automation_executions_heartbeat_idx',
    );
    table.dropIndex(
      ['base_id', 'fk_retry_of_id'],
      'nc_automation_executions_retry_of_idx',
    );
    table.dropIndex(
      ['status', 'resume_at'],
      'nc_automation_executions_status_resume_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropColumn('heartbeat_at');
    table.dropColumn('control');
    table.dropColumn('fk_retry_of_id');
    table.dropColumn('claim_id');
    table.dropColumn('job_id');
  });
};

export { up, down };
