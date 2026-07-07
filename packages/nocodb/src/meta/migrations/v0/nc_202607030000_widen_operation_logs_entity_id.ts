import type { Knex } from 'knex';
import {
  up as widenOperationLogsEntityId,
  down as revertOperationLogsEntityId,
} from '~/meta/migrations/operation-logs/nc_002_widen_entity_id';

// Runs against the meta DB when NC_OP_LOG_DB is not configured. When it is,
// the satellite source (XcMigrationSourceOperationLogs) applies the same
// alter against the satellite connection — single source of truth.
const up = async (knex: Knex) => {
  await widenOperationLogsEntityId(knex);
};

const down = async (knex: Knex) => {
  await revertOperationLogsEntityId(knex);
};

export { up, down };
