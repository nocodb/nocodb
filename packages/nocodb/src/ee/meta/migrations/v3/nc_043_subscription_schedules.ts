import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.string('stripe_schedule_id', 255);
    table.timestamp('schedule_phase_start');
    table.string('schedule_stripe_price_id', 255);
    table.string('schedule_fk_plan_id', 20);
    table.string('schedule_period', 255);
    table.string('schedule_type', 255);
    // Add missing fk_user_id to track who created the subscription
    table.string('fk_user_id', 20);

    // Remove old columns
    table.dropColumn('scheduled_fk_plan_id');
    table.dropColumn('scheduled_stripe_price_id');
    table.dropColumn('scheduled_plan_start_at');
    table.dropColumn('scheduled_plan_period');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.dropColumn('stripe_schedule_id');
    table.dropColumn('schedule_phase_start');
    table.dropColumn('schedule_stripe_price_id');
    table.dropColumn('schedule_fk_plan_id');
    table.dropColumn('schedule_period');
    table.dropColumn('schedule_type');
    table.dropColumn('fk_user_id');

    table.string('scheduled_fk_plan_id', 20);
    table.string('scheduled_stripe_price_id', 255);
    table.timestamp('scheduled_plan_start_at');
    table.string('scheduled_plan_period', 255);
  });
};

export { up, down };
