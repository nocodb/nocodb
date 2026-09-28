import type { Knex } from 'knex';
import {
  down as revertOpLogEntityId,
  up as widenOpLogEntityId,
} from '~/meta/migrations/operation-logs/nc_002_widen_entity_id';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Operation-logs meta-DB copy (satellite source handles NC_OP_LOG_DB).
  await widenOpLogEntityId(knex);

  // The sandbox changelog stores record PKs the same way and has the same
  // varchar(20) defect on both entity_id and parent_entity_id. Through
  // MetaTableOldV2, not MetaTable: the live entry for this name has since moved
  // (`nc_202609021201_environments` copies the table later in the list), and
  // this migration must keep hitting the original.
  await knex.schema.alterTable(MetaTableOldV2.SANDBOX_CHANGELOG, (table) => {
    table.string('entity_id', 255).alter();
    table.string('parent_entity_id', 255).alter();
  });
};

const down = async (knex: Knex) => {
  await revertOpLogEntityId(knex);
  await knex.schema.alterTable(MetaTableOldV2.SANDBOX_CHANGELOG, (table) => {
    table.string('entity_id', 20).alter();
    table.string('parent_entity_id', 20).alter();
  });
};

export { up, down };
