import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable('nc_addons', (table) => {
    table.string('id', 20).primary();
    table.string('addon_key', 255).notNullable();
    table.string('title', 255);
    table.text('description');
    table.string('stripe_product_id', 255).notNullable();
    table.text('prices'); // JSON: synced Stripe.Price[]
    table.boolean('is_active').defaultTo(true);
    table.text('meta');
    table.timestamps(true, true);
    table.index('addon_key', 'nc_addons_addon_key_idx');
    table.index('stripe_product_id', 'nc_addons_stripe_product_idx');
  });

  await knex.schema.createTable('nc_subscription_addons', (table) => {
    table.string('id', 20).primary();
    table.string('fk_subscription_id', 20).notNullable();
    table.string('fk_addon_id', 20).notNullable();
    table.string('addon_key', 255).notNullable();
    table.string('stripe_subscription_item_id', 255).nullable(); // null = comped
    table.string('stripe_price_id', 255).nullable(); // negotiated/deal price; null = comped or default-resolved
    table.integer('seat_count').defaultTo(1);
    table.string('status', 255).defaultTo('active');
    table.text('meta');
    table.timestamps(true, true);
    table.index('fk_subscription_id', 'nc_subscription_addons_sub_idx');
    table.index('addon_key', 'nc_subscription_addons_key_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists('nc_subscription_addons');
  await knex.schema.dropTableIfExists('nc_addons');
};

export { up, down };
