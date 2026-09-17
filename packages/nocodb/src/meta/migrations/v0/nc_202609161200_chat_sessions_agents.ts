import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { migrateTableInBatches } from '~/utils/migrationUtils';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import {
  up as migrateMessages,
  down as revertMessages,
} from '~/meta/migrations/chat-messages/nc_007_agent_messages';

const logger = new Logger('nc_202609051200_chat_sessions_agents');

/**
 * Agent sessions become chat sessions. Three columns tell them apart:
 * `fk_agent_id` (null = the assistant), `trigger_type` ('chat' = a person,
 * else the trigger node that fired it) and `status` (where the latest turn
 * stands). The trigger's payload and the agent-to-agent hop count fold into
 * `meta.trigger`; started/finished were the row timestamps, and skip_reason
 * and resume_at were never written.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.string('fk_agent_id', 20);
    table.string('trigger_type', 60).defaultTo('chat');
    table.string('status', 20).defaultTo('active');
    table.index(
      ['base_id', 'fk_agent_id', 'trigger_type', 'status'],
      'nc_chat_sessions_agent_idx',
    );
  });

  // The chat primary key needs a workspace; metaInsert2 always stamped one.
  await migrateTableInBatches(
    knex,
    MetaTable.AGENT_SESSIONS,
    MetaTable.CHAT_SESSIONS,
    (r) => {
      const row = prepareForResponse(r, ['meta', 'trigger_payload']);

      const meta = row.meta ?? {};
      const payload = row.trigger_payload ?? {};
      const depth = Number(row.chain_depth) || 0;
      if (Object.keys(payload).length || depth) {
        meta.trigger = { payload, depth };
      }

      return prepareForDb({
        id: row.id,
        fk_workspace_id: row.fk_workspace_id,
        base_id: row.base_id,
        fk_user_id: row.fk_user_id ?? null,
        fk_agent_id: row.fk_agent_id,
        title: row.title ?? null,
        trigger_type: row.trigger_type ?? 'chat',
        status: row.status ?? 'active',
        meta,
        total_input_tokens: row.total_input_tokens ?? 0,
        total_output_tokens: row.total_output_tokens ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
    logger,
    { whereConditions: (qb) => qb.whereNotNull('fk_workspace_id') },
  );

  await migrateMessages(knex);
};

const down = async (knex: Knex) => {
  await revertMessages(knex);

  await knex(MetaTable.CHAT_SESSIONS).whereNotNull('fk_agent_id').del();

  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropIndex(
      ['base_id', 'fk_agent_id', 'trigger_type', 'status'],
      'nc_chat_sessions_agent_idx',
    );
    table.dropColumn('fk_agent_id');
    table.dropColumn('trigger_type');
    table.dropColumn('status');
  });
};

export { up, down };
