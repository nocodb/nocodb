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
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_plan_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable(); // user who subscribed

    table.string('stripe_subscription_id', 255);
    table.string('stripe_customer_id', 255);
    table.string('stripe_price_id', 255);

    table.integer('seat_count').notNullable().defaultTo(1);

    table.string('status', 255); // active, canceled, paused, trial

    table.timestamp('start_at');
    table.timestamp('end_at'); // end of trial or after cancelation - otherwise null

    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_subscriptions_ws_idx');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('stripe_customer_id', 255);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.PLANS);
  await knex.schema.dropTableIfExists(MetaTable.SUBSCRIPTIONS);
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('stripe_customer_id');
  });
};

export { up, down };
