import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.timestamp('draft_reminder_sent_at', { useTz: true });
  });

  // Seed existing drafts so we don't spam reminders for pre-existing workflows on first deploy
  await knex(MetaTable.AUTOMATIONS)
    .whereNotNull('draft')
    .update({ draft_reminder_sent_at: knex.fn.now() });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.dropColumn('draft_reminder_sent_at');
  });
};

export { up, down };
