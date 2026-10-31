import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Serves each workflow's latest run on every workflow list load.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.index(
      ['base_id', 'fk_workflow_id', 'created_at'],
      'nc_automation_executions_latest_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropIndex([], 'nc_automation_executions_latest_idx');
  });
};

export { up, down };
