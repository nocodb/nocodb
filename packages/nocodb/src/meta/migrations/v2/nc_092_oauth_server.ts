import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // OAuth Clients Table
  await knex.schema.createTable(MetaTable.OAUTH_CLIENTS, (table) => {
    table.string('client_id', 32).primary();
    table.string('client_secret', 64);
    table.string('client_type');
    table.string('client_name');
    table.text('client_description');
    table.string('client_uri');
    table.string('logo_uri');
    table.text('redirect_uris'); // JSON stored as text
    table.text('allowed_grant_types'); // JSON stored as text
    table.text('response_types'); // JSON stored as text
    table.text('allowed_scopes');
    table.string('registration_access_token');
    table.string('registration_client_uri');
    table.bigInteger('client_id_issued_at');
    table.bigInteger('client_secret_expires_at');
    table.string('fk_user_id');
    table.timestamps(true, true);

    table.index('fk_user_id');
  });

  // OAuth Authorization Codes Table
  await knex.schema.createTable(
    MetaTable.OAUTH_AUTHORIZATION_CODES,
    (table) => {
      table.string('code').primary();
      table.string('client_id');
      table.string('user_id');

      // PKCE
      table.string('code_challenge');
      table.string('code_challenge_method'); // Default: 'S256'

      table.string('redirect_uri');
      table.string('scope');
      table.string('state');

      table.string('resource');
      table.text('granted_resources');

      table.timestamp('expires_at');
      table.boolean('is_used');
      table.timestamps(true, true);

      // Add indexes for performance
      table.index('client_id');
      table.index('user_id');
      table.index('code');
      table.index('expires_at');
    },
  );

  // OAuth Tokens Table
  await knex.schema.createTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.string('id').primary();
    table.string('client_id');
    table.string('fk_user_id');

    table.string('access_token');
    table.timestamp('access_token_expires_at');

    table.string('refresh_token');
    table.timestamp('refresh_token_expires_at');

    // MCP Requirements
    table.string('resource');
    table.string('audience');

    table.text('granted_resources');
    table.string('scope');
    table.boolean('is_revoked');

    table.timestamps(true, true);
    table.timestamp('last_used_at');

    table.index('client_id');
    table.index('fk_user_id');
    table.index('access_token');
    table.index('refresh_token');
    table.index('access_token_expires_at');
    table.index('is_revoked');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.OAUTH_TOKENS);
  await knex.schema.dropTable(MetaTable.OAUTH_AUTHORIZATION_CODES);
  await knex.schema.dropTable(MetaTable.OAUTH_CLIENTS);
};

export { up, down };
