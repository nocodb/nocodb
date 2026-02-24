import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.RAG_SESSIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_base_id', 20).index();
    table.string('fk_workspace_id', 20).index();
    table.string('title', 255);
    table.text('integration_ids'); // JSON array of integration IDs
    table.string('created_by', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.RAG_MESSAGES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_session_id', 20).index();
    table.string('fk_workspace_id', 20).index();
    table.string('role', 20); // 'user' | 'assistant'
    table.text('content');
    table.text('sql');
    table.text('result'); // JSON stringified query result
    table.text('error');
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.RAG_MESSAGES);
  await knex.schema.dropTable(MetaTable.RAG_SESSIONS);
};

export { up, down };
