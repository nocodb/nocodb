import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// App-builder turns now persist as normal chat messages. `agent` attributes the
// producing persona ('app_builder' for sandbox build turns, absent for the
// assistant) and `fk_app_id` records which app a build turn targeted — one
// conversation can build/edit any number of apps. Canonical schema shared by
// the main meta DB (via a v0 migration) and the chat-messages satellite DB.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.string('agent', 20);
    table.string('fk_app_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.CHAT_MESSAGES, (table) => {
    table.dropColumn('agent');
    table.dropColumn('fk_app_id');
  });
};

export { up, down };
