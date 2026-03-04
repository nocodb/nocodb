import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Chat sessions
  await knex.schema.createTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_user_id', 20);
    table.string('title', 255);
    table.text('summary');
    table.integer('total_input_tokens').defaultTo(0);
    table.integer('total_output_tokens').defaultTo(0);
    table.integer('message_count').defaultTo(0);
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('fk_workspace_id', 'nc_chat_sessions_ws_idx');
    table.index('fk_user_id', 'nc_chat_sessions_user_idx');
  });

  // Chat messages
  await knex.schema.createTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_session_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('role', 20).notNullable();
    table.text('content');
    table.text('parts');
    table.string('model', 100);
    table.integer('input_tokens').defaultTo(0);
    table.integer('output_tokens').defaultTo(0);
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index('fk_session_id', 'nc_chat_messages_session_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.CHAT_MESSAGES);
  await knex.schema.dropTableIfExists(MetaTable.CHAT_SESSIONS);
};

export { up, down };
