import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// `entity_id` stores the *user's own* primary key value for the record an
// undo/redo op applies to, not a NocoDB-internal id — it was sized for the
// latter (varchar(20)) and truncates on any external table with a longer
// text PK, throwing StringDataRightTruncation on every edit.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OPERATION_LOGS, (table) => {
    table.text('entity_id').alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OPERATION_LOGS, (table) => {
    table.string('entity_id', 20).alter();
  });
};

export { up, down };
