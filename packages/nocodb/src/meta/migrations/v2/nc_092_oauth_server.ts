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
    table.string('fk_user_id', 20);
    table.timestamps(true, true);

    table.index('fk_user_id');
  });

  // OAuth Authorization Codes Table
  await knex.schema.createTable(
    MetaTable.OAUTH_AUTHORIZATION_CODES,
    (table) => {
      table.string('code', 32).primary();
      table.string('client_id', 32);
      table.string('user_id', 20);

      // PKCE
      table.string('code_challenge');
      table.string('code_challenge_method', 10).defaultTo('S256'); // Only S256 supported

      table.string('redirect_uri');
      table.string('scope');
      table.string('state', 1024);

      table.string('resource').nullable(); // For MCP requirements
      table.text('granted_resources').nullable(); // JSON stored as text

      table.timestamp('expires_at').notNullable();
      table.boolean('is_used').defaultTo(false).notNullable();
      table.timestamps(true, true);

      // Indexes for performance
      table.index('client_id');
      table.index('user_id');
      table.index('code');
      table.index('expires_at');
      table.index('is_used');
      table.index(['client_id', 'user_id']);
    },
  );

  // OAuth Tokens Table
  await knex.schema.createTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.string('id', 20).primary();
    table.string('client_id', 32);
    table.string('fk_user_id');

    table.text('access_token');
    table.timestamp('access_token_expires_at');

    table.text('refresh_token');
    table.timestamp('refresh_token_expires_at'); // 60 days

    // MCP Requirements
    table.string('resource');
    table.string('audience');

    table.text('granted_resources'); // JSON stored as text
    table.string('scope');
    table.boolean('is_revoked').defaultTo(false).notNullable();

    table.timestamps(true, true);
    table.timestamp('last_used_at').nullable();

    // Indexes for performance
    table.index('client_id');
    table.index('fk_user_id');
    table.index('access_token');
    table.index('refresh_token');
    table.index('access_token_expires_at');
    table.index('refresh_token_expires_at');
    table.index('is_revoked');
    table.index('last_used_at');
    table.index(['client_id', 'fk_user_id']);
    table.index(['is_revoked', 'access_token_expires_at']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.OAUTH_TOKENS);
  await knex.schema.dropTable(MetaTable.OAUTH_AUTHORIZATION_CODES);
  await knex.schema.dropTable(MetaTable.OAUTH_CLIENTS);
};

export { up, down };
