import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // GCP Marketplace accounts — maps GCP procurement accounts to NocoDB users
  await knex.schema.createTable(MetaTable.GCP_MARKETPLACE_ACCOUNTS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('procurement_account_id', 255).notNullable().unique();
    table.string('fk_user_id', 20);
    table.string('state', 50).notNullable().defaultTo('pending');
    table.string('link_token', 64);
    table.timestamp('link_token_expires_at');
    table.text('meta');

    table.timestamps(true, true);

    table.index(['fk_user_id'], 'nc_gcp_mp_accounts_user_idx');
    table.index(['link_token'], 'nc_gcp_mp_accounts_link_token_idx');
  });

  // GCP Marketplace entitlements — maps GCP entitlements to installations (licenses)
  await knex.schema.createTable(
    MetaTable.GCP_MARKETPLACE_ENTITLEMENTS,
    (table) => {
      table.string('id', 20).primary().notNullable();
      table.string('entitlement_id', 255).notNullable().unique();
      table.string('fk_gcp_account_id', 20).notNullable();
      table.string('fk_installation_id', 20);
      table.string('plan', 255);
      table.string('state', 50).notNullable().defaultTo('pending');
      table.text('meta');

      table.timestamps(true, true);

      table.index(['fk_gcp_account_id'], 'nc_gcp_mp_ent_account_idx');
      table.index(['fk_installation_id'], 'nc_gcp_mp_ent_install_idx');
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.GCP_MARKETPLACE_ENTITLEMENTS);
  await knex.schema.dropTable(MetaTable.GCP_MARKETPLACE_ACCOUNTS);
};

export { up, down };
