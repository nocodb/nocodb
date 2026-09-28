import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OPERATION_LOGS, (table) => {
    // entity_id stores the user record's PK value, which can be a long text
    // key (external tables) — varchar(20) truncated it and broke undo entries.
    table.string('entity_id', 255).alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OPERATION_LOGS, (table) => {
    table.string('entity_id', 20).alter();
  });
};

export { up, down };
