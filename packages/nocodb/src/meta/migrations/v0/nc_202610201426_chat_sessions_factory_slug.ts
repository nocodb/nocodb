import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/** A factory session's preview host and branch name; one domain serves every workspace, so it is unique. */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.string('factory_slug', 63);
    table.unique(['factory_slug'], {
      indexName: 'nc_chat_sessions_factory_slug_uq',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_SESSIONS, (table) => {
    table.dropUnique(['factory_slug'], 'nc_chat_sessions_factory_slug_uq');
    table.dropColumn('factory_slug');
  });
};

export { up, down };
