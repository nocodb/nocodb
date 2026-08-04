import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Stores the record a user message was scoped to ("Ask AI about this record" /
// the selected grid row), as JSON { tableId, recordId, recordTitle } — so the
// composer context chip on a sent message survives reload. Canonical schema
// shared by the main meta DB (via a v0 migration) and the chat-messages
// satellite DB.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.text('ui_context_record');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.dropColumn('ui_context_record');
  });
};

export { up, down };
