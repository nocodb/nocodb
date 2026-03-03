import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INSTALLATIONS, (table) => {
    table.string('id', 20).primary().notNullable();

    // For stripe subscriptions
    table.string('fk_subscription_id', 20);

    table.string('licensed_to').notNullable();
    table.string('license_key').notNullable();

    // HMAC-based authentication (client-specific derived secret)
    table.string('installation_secret');

    // Timestamps for installation and expiration
    table.timestamp('installed_at');
    table.timestamp('last_seen_at');
    table.timestamp('expires_at');

    table.string('license_type').notNullable(); // e.g., 'enterprise_trial', 'enterprise_starter', 'enterprise'
    table.string('status').notNullable().defaultTo('active'); // 'active', 'grace', 'expired', 'revoked', 'suspended'

    table.integer('seat_count').notNullable().defaultTo(0); // e.g., number of active users

    // Limits, features, etc. as JSON string
    table.text('config');

    table.text('meta'); // Additional metadata as JSON string

    table.timestamps(true, true);

    table.index(['license_key'], 'nc_installations_license_key_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INSTALLATIONS);
};

export { up, down };
