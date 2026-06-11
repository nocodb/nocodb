import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.integer('last_paid_seat_count').nullable();
  });

  // Backfill: set last_paid_seat_count to current seat_count for all existing subscriptions
  await knex(MetaTable.SUBSCRIPTIONS).update({
    last_paid_seat_count: knex.ref('seat_count'),
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.dropColumn('last_paid_seat_count');
  });
};

export { up, down };
