import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.boolean('wf_is_polling').defaultTo(false);
    table.boolean('wf_is_polling_heartbeat').defaultTo(false);
    table.string('wf_polling_cron');
    table.bigint('wf_next_polling_at');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.dropColumn('wf_is_polling');
    table.dropColumn('wf_is_polling_heartbeat');
    table.dropColumn('wf_polling_cron');
    table.dropColumn('wf_next_polling_at');
  });
};

export { up, down };
