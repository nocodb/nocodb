import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Stores files the AI generated for a message (e.g. a CSV/chart written by the
// sandbox), as a JSON array of attachments — parallel to the user-uploaded
// `files` column. Canonical schema shared by the main meta DB (via a v0
// migration) and the chat-messages satellite DB.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.text('created_files');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.dropColumn('created_files');
  });
};

export { up, down };
