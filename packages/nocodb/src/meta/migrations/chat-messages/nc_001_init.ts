import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_session_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('role', 20).notNullable();
    table.text('content');
    table.text('parts');
    table.string('model', 100);
    table.integer('input_tokens').defaultTo(0);
    table.integer('output_tokens').defaultTo(0);
    table.timestamps(true, true);

    table.primary(['fk_workspace_id', 'id']);
    table.index('fk_session_id', 'nc_chat_messages_session_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.CHAT_MESSAGES);
};

export { up, down };
