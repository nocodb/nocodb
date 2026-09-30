import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Consent-recorded scopes on an OAuth grant, so a bearer can be what a
 * fine-grained PAT is rather than the user's whole authority.
 *
 * Nullable and never backfilled. Null is the legacy marker: the grant keeps
 * exactly what it had, which matters because every existing grant is already
 * configured in somebody's client.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OAUTH_AUTHORIZATION_CODES, (table) => {
    table.text('permissions');
  });

  await knex.schema.alterTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.text('permissions');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OAUTH_AUTHORIZATION_CODES, (table) => {
    table.dropColumn('permissions');
  });

  await knex.schema.alterTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.dropColumn('permissions');
  });
};

export { up, down };
