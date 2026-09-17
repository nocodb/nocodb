import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { migrateTableInBatches } from '~/utils/migrationUtils';

const logger = new Logger('nc_007_agent_messages');

/**
 * Agent messages become chat messages: same parts, same files, one table. The
 * agent copy also carried `fk_agent_id`, which nothing needs — the session has
 * it. `model` widens because agent runs store full provider ids.
 *
 * Canonical for the chat-messages satellite (NC_CHAT_DB) — the v0 migration
 * imports this too, so a deployment without NC_CHAT_DB gets the same change.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.string('model', 255).alter();
  });

  // The chat primary key needs a workspace; metaInsert2 always stamped one.
  await migrateTableInBatches(
    knex,
    MetaTable.AGENT_MESSAGES,
    MetaTable.CHAT_MESSAGES,
    (r) => ({
      id: r.id,
      fk_session_id: r.fk_session_id,
      fk_workspace_id: r.fk_workspace_id,
      base_id: r.base_id,
      role: r.role,
      content: r.content ?? null,
      parts: r.parts ?? null,
      files: r.files ?? null,
      created_files: r.created_files ?? null,
      model: r.model ?? null,
      input_tokens: r.input_tokens ?? 0,
      output_tokens: r.output_tokens ?? 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }),
    logger,
    { whereConditions: (qb) => qb.whereNotNull('fk_workspace_id') },
  );
};

const down = async (knex: Knex) => {
  await knex(MetaTable.CHAT_MESSAGES)
    .whereIn('id', knex(MetaTable.AGENT_MESSAGES).select('id'))
    .del();

  await knex(MetaTable.CHAT_MESSAGES)
    .whereRaw('length(model) > 100')
    .update({ model: knex.raw('substr(model, 1, 100)') });

  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.string('model', 100).alter();
  });
};

export { up, down };
