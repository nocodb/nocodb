import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import {
  down as revertMessageTable,
  up as updateMessageTable,
} from '~/meta/migrations/chat-messages/nc_002_base_id';
const up = async (knex: Knex) => {
  await knex(MetaTable.CHAT_SESSIONS).del();

  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.string('base_id', 20);
  });

  await updateMessageTable(knex);

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('fk_session_id', 20);
    table.index(['base_id', 'fk_session_id'], 'nc_fr_session_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropColumn('base_id');
  });

  await revertMessageTable(knex);

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex(['base_id', 'fk_session_id'], 'nc_fr_session_idx');
    table.dropColumn('fk_session_id');
  });
};

export { up, down };
