import type { Knex } from 'knex';
import {
  up as createChatMessages,
  down as dropChatMessages,
} from '~/meta/migrations/chat-messages/nc_001_init';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Chat sessions
  await knex.schema.createTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_user_id', 20);
    table.string('title', 255);
    table.text('summary');
    table.integer('total_input_tokens').defaultTo(0);
    table.integer('total_output_tokens').defaultTo(0);
    table.integer('message_count').defaultTo(0);
    table.timestamps(true, true);

    table.primary(['fk_workspace_id', 'id']);
    table.index('fk_user_id', 'nc_chat_sessions_user_idx');
  });

  // Chat messages — delegated to canonical migration (shared with satellite DB)
  await createChatMessages(knex);
};

const down = async (knex: Knex) => {
  await dropChatMessages(knex);
  await knex.schema.dropTableIfExists(MetaTable.CHAT_SESSIONS);
};

export { up, down };
