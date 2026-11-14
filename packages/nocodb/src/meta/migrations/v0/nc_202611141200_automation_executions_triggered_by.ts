import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Who started a run by hand (manual run or retry); attribution only.
// nc_automation_executions is in the prod logical-replication publication with an
// explicit column list — mirror this column on the replica.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.string('triggered_by', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropColumn('triggered_by');
  });
};

export { up, down };
