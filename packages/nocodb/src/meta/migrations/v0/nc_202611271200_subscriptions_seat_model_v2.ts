import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.string('seat_model', 10);
    table.integer('app_seat_count').defaultTo(0);
    table.integer('last_paid_app_seat_count').defaultTo(0);
    table.string('stripe_app_seat_item_id', 255);
    table.string('stripe_app_seat_price_id', 255);
    table.string('schedule_app_seat_price_id', 255);
    table.integer('billed_seat_count');
    table.integer('billed_app_bundles');
    table.timestamp('current_period_end', { useTz: true });
    table.timestamp('seat_reserve_held_since', { useTz: true });
  });

  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.text('app_seat_prices');
    table.string('stripe_app_seat_product_id', 255);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.dropColumn('seat_model');
    table.dropColumn('app_seat_count');
    table.dropColumn('last_paid_app_seat_count');
    table.dropColumn('stripe_app_seat_item_id');
    table.dropColumn('stripe_app_seat_price_id');
    table.dropColumn('schedule_app_seat_price_id');
    table.dropColumn('billed_seat_count');
    table.dropColumn('billed_app_bundles');
    table.dropColumn('current_period_end');
    table.dropColumn('seat_reserve_held_since');
  });

  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.dropColumn('app_seat_prices');
    table.dropColumn('stripe_app_seat_product_id');
  });
};

export { up, down };
