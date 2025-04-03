import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.PLANS, (table) => {
    table.string('id', 20).primary();
    table.string('title', 255);
    table.text('description');
    table.string('stripe_product_id', 255).notNullable();
    table.boolean('is_active').defaultTo(true);

    // limits
    table.text('prices'); // JSON
    table.text('meta'); // JSON

    table.timestamps(true, true);

    table.index('stripe_product_id', 'nc_plans_stripe_product_idx');
  });

  await knex.schema.createTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.string('fk_plan_id', 20).notNullable();

    table.string('stripe_subscription_id', 255);
    table.string('stripe_price_id', 255);

    table.integer('seat_count').notNullable().defaultTo(1);

    table.string('status', 255); // active, canceled, paused, trial

    table.timestamp('start_at');
    table.timestamp('trial_end_at'); // when trial ends - otherwise null
    table.timestamp('canceled_at'); // when canceled - otherwise null

    table.string('period', 255); // month, year

    table.timestamp('upcoming_invoice_at');
    table.timestamp('upcoming_invoice_due_at');
    table.integer('upcoming_invoice_amount');
    table.string('upcoming_invoice_currency');

    table.string('scheduled_fk_plan_id', 20); // next plan id - if any
    table.string('scheduled_stripe_price_id', 255); // next stripe price id - if any
    table.timestamp('scheduled_plan_start_at'); // next plan start date - if any
    table.string('scheduled_plan_period', 255); // month, year

    table.text('meta'); // JSON - limits override

    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_subscriptions_ws_idx');
    table.index('fk_org_id', 'nc_subscriptions_org_idx');
    table.index(
      'stripe_subscription_id',
      'nc_subscriptions_stripe_subscription_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.string('stripe_customer_id', 255);
  });

  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.string('stripe_customer_id', 255);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.PLANS);
  await knex.schema.dropTableIfExists(MetaTable.SUBSCRIPTIONS);
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('stripe_customer_id');
  });
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.dropColumn('stripe_customer_id');
  });
};

export { up, down };
