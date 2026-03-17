import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.timestamp('draft_reminder_sent_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.dropColumn('draft_reminder_sent_at');
  });
};

export { up, down };
