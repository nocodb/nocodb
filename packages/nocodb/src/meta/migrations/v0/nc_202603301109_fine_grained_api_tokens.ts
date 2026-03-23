import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add new columns to nc_api_tokens (dormant columns base_id, fk_workspace_id,
  // permissions, expiry, enabled already exist from nc_001_init)
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    // SHA-256 hex digest of the token (new tokens only)
    table.string('token_hash', 64).nullable();

    // Display prefix, e.g. "nc_pat_a1b2c3" (first 12 chars)
    table.string('token_prefix', 20).nullable();

    // Last used timestamp
    table.timestamp('last_used_at').nullable();
  });

  // Index for hash-based token lookup
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.index('token_hash', 'idx_api_tokens_hash');
  });

  // Create the scopes join table for multi-resource token scoping
  await knex.schema.createTable('nc_api_token_scopes', (table) => {
    table.string('id', 20).primary();

    // FK to nc_api_tokens
    table.string('fk_api_token_id', 20).notNullable();

    // 'base' | 'workspace'
    table.string('resource_type', 20).notNullable();

    // base_id or workspace_id
    table.string('resource_id', 20).notNullable();

    // Per-scope permissions JSON blob
    table.text('permissions').nullable();

    table.timestamps(true, true);

    table.index('fk_api_token_id', 'idx_api_token_scopes_token');
    table.index(
      ['resource_type', 'resource_id'],
      'idx_api_token_scopes_resource',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists('nc_api_token_scopes');

  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropIndex('token_hash', 'idx_api_tokens_hash');
  });

  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropColumn('token_hash');
    table.dropColumn('token_prefix');
    table.dropColumn('last_used_at');
  });
};

export { up, down };
