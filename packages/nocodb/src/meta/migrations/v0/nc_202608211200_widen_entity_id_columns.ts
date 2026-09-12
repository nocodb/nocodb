import type { Knex } from 'knex';
import {
  up as widenOpLogEntityId,
  down as revertOpLogEntityId,
} from '~/meta/migrations/operation-logs/nc_002_widen_entity_id';

const up = async (knex: Knex) => {
  // Operation-logs meta-DB copy (satellite source handles NC_OP_LOG_DB).
  await widenOpLogEntityId(knex);

  // nc_sandbox_changelog stores record PKs the same way and has the same
  // varchar(20) defect on both entity_id and parent_entity_id. Named literally
  // rather than through the enum, which now points at the copy
  // `nc_202609021201_environments` makes of this table LATER in the list. Behaviour is
  // identical to the shipped version — same table, same statements.
  await knex.schema.alterTable('nc_sandbox_changelog', (table) => {
    table.string('entity_id', 255).alter();
    table.string('parent_entity_id', 255).alter();
  });
};

const down = async (knex: Knex) => {
  await revertOpLogEntityId(knex);
  await knex.schema.alterTable('nc_sandbox_changelog', (table) => {
    table.string('entity_id', 20).alter();
    table.string('parent_entity_id', 20).alter();
  });
};

export { up, down };
