import type { Knex } from 'knex';
import {
  up as widenOpLogEntityId,
  down as revertOpLogEntityId,
} from '~/meta/migrations/operation-logs/nc_002_widen_entity_id';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Operation-logs meta-DB copy (satellite source handles NC_OP_LOG_DB).
  await widenOpLogEntityId(knex);

  // nc_sandbox_changelog stores record PKs the same way and has the same
  // varchar(20) defect on both entity_id and parent_entity_id.
  await knex.schema.alterTable(MetaTable.SANDBOX_CHANGELOG, (table) => {
    table.string('entity_id', 255).alter();
    table.string('parent_entity_id', 255).alter();
  });
};

const down = async (knex: Knex) => {
  await revertOpLogEntityId(knex);
  await knex.schema.alterTable(MetaTable.SANDBOX_CHANGELOG, (table) => {
    table.string('entity_id', 20).alter();
    table.string('parent_entity_id', 20).alter();
  });
};

export { up, down };
