import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Granular scopes on the MCP credential, so one MCP token can be what a
 * fine-grained PAT is: authority bounded per resource rather than "everything
 * this user can do in one base".
 *
 * Nullable on purpose, and never backfilled. A null column is the legacy
 * marker — the credential carries the user's own authority pinned to
 * `base_id`, which is exactly what it did before this column existed. Every
 * MCP token in the wild is already configured in somebody's client, so the
 * migration deliberately rewrites none of them.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MCP_TOKENS, (table) => {
    table.text('permissions');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MCP_TOKENS, (table) => {
    table.dropColumn('permissions');
  });
};

export { up, down };
