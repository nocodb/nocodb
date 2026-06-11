import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.timestamp('resume_at').nullable();
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.index(
      ['fk_workspace_id', 'base_id', 'resume_at'],
      'nc_automation_executions_resume_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropIndex([], 'nc_automation_executions_resume_idx');
    table.dropColumn('resume_at');
  });
};

export { up, down };
