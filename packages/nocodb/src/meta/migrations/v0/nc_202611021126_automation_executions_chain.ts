import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Links a run to the run whose write triggered it, for the trigger loop guard.
// nc_automation_executions is in the prod logical-replication publication with an
// explicit column list — mirror these columns on the replica.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.string('parent_execution_id', 20);
    table.integer('execution_depth').defaultTo(0);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropColumn('parent_execution_id');
    table.dropColumn('execution_depth');
  });
};

export { up, down };
