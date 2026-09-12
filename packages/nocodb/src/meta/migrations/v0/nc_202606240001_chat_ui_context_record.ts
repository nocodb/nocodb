import type { Knex } from 'knex';
import {
  up as addUiContextRecord,
  down as dropUiContextRecord,
} from '~/meta/migrations/chat-messages/nc_004_ui_context_record';

// Adds `ui_context_record` to nc_chat_messages on the main meta DB. The canonical
// schema lives in chat-messages/nc_004_ui_context_record (shared with the
// satellite DB migration source), so this just delegates to it.
const up = async (knex: Knex) => {
  await addUiContextRecord(knex);
};

const down = async (knex: Knex) => {
  await dropUiContextRecord(knex);
};

export { up, down };
