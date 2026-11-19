import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/** MCP connectors: admin-added servers, each person's own connections, and who may use what. */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.MCP_CONNECTORS, (table) => {
    table.string('id', 20).primary();
    // 'workspace' | 'org'
    table.string('scope', 20).notNullable();
    table.string('scope_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('url').notNullable();
    table.string('transport', 10);
    table.string('auth', 20).notNullable();
    table.string('oauth_client_id', 255);
    // Encrypted.
    table.text('oauth_client_secret');
    table.text('icon_url');
    table.string('created_by', 20);
    table.timestamps(true, true);

    table.index(['scope', 'scope_id'], 'nc_mcp_connectors_scope_idx');
  });

  await knex.schema.createTable(MetaTable.MCP_CONNECTIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_user_id', 20).notNullable();
    // 'verified' | 'workspace' | 'org' | 'custom'
    table.string('source', 20).notNullable();
    table.string('connector_id', 64);
    table.string('title', 255).notNullable();
    table.text('url').notNullable();
    table.string('transport', 10);
    table.string('auth', 20).notNullable();
    table.string('name', 64);
    table.string('identity', 255);
    table.text('icon_url');
    table.boolean('is_default').defaultTo(false);
    table.string('permission', 20);
    table.text('tool_settings');
    table.text('tools');
    // Encrypted: tokens, registered client, authorization server.
    table.text('credentials');
    table.string('status', 20);
    table.timestamps(true, true);

    table.index(['fk_user_id'], 'nc_mcp_connections_user_idx');
  });

  await knex.schema.createTable(MetaTable.MCP_CONNECTOR_POLICIES, (table) => {
    table.string('id', 20).primary();
    table.string('scope', 20).notNullable();
    table.string('scope_id', 20).notNullable();
    table.string('mode', 20);
    table.string('verified', 20);
    table.text('verified_ids');
    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.timestamps(true, true);

    table.unique(['scope', 'scope_id'], {
      indexName: 'nc_mcp_connector_policies_scope_uq',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.MCP_CONNECTOR_POLICIES);
  await knex.schema.dropTable(MetaTable.MCP_CONNECTIONS);
  await knex.schema.dropTable(MetaTable.MCP_CONNECTORS);
};

export { up, down };
