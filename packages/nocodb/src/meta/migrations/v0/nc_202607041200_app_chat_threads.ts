import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.APP_CHAT_THREADS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_app_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('title', 255);
    table.string('claude_session_id', 64);
    table.string('last_seen_sha', 40);
    table.string('created_by', 20);
    table.timestamps(true, true);
    // Composite PK — same rationale as the other app tables in
    // nc_202606280000_apps (sandbox merge id preservation).
    table.primary(['base_id', 'id']);
    table.index(['base_id', 'fk_app_id'], 'nc_app_chat_threads_context');
  });

  await knex.schema.alterTable(MetaTable.APP_CHAT_MESSAGES, (table) => {
    table.string('fk_thread_id', 20);
    table.index(['base_id', 'fk_thread_id'], 'nc_app_chat_messages_thread');
  });

  // The Claude session pointer moves from the app-global draft version to the
  // per-builder thread row — the column is dead after this migration.
  await knex.schema.alterTable(MetaTable.APP_VERSIONS, (table) => {
    table.dropColumn('claude_session_id');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.APP_VERSIONS, (table) => {
    table.string('claude_session_id', 64);
  });

  await knex.schema.alterTable(MetaTable.APP_CHAT_MESSAGES, (table) => {
    table.dropIndex(['base_id', 'fk_thread_id'], 'nc_app_chat_messages_thread');
    table.dropColumn('fk_thread_id');
  });

  await knex.schema.dropTable(MetaTable.APP_CHAT_THREADS);
};

export { up, down };
