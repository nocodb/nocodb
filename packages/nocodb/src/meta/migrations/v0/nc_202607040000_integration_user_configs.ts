import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.string('credential_mode', 20).defaultTo('shared');
  });

  // Per-user credentials for `per_user` AUTH integrations. One row per
  // (integration, user, environment) — a user's token is minted per environment
  // (a staging connection authorizes a different account than production).
  //
  // Unlike nc_integration_env_configs, the reserved key `production` IS stored
  // here: per-user mode never falls back to the integration's own config (that
  // would silently escalate to the admin's credential), so production needs its
  // own row. `fk_environment_id` is a SOFT reference — a reserved key
  // (`production`/`staging`) or a custom env row id (`env…`).
  //
  // `config` is an encrypted JSON blob, same shape/encryption as the
  // integration's own config. It NEVER leaves the backend — not even to its
  // owner; clients only ever see connection state.
  await knex.schema.createTable(MetaTable.INTEGRATION_USER_CONFIGS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_integration_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.timestamps(true, true);
    table.primary(['id']);
    // Enables the atomic onConflict().merge() upsert on the token-refresh path.
    table.unique(['fk_integration_id', 'fk_user_id', 'fk_environment_id'], {
      indexName: 'nc_integration_user_configs_int_user_env_unique',
    });
    table.index(['fk_integration_id'], 'nc_integration_user_configs_int_index');
    table.index(['fk_user_id'], 'nc_integration_user_configs_user_index');
    table.index(['fk_environment_id'], 'nc_integration_user_configs_env_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTEGRATION_USER_CONFIGS);
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('credential_mode');
  });
};

export { up, down };
