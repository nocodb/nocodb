import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// `scope` is client-supplied and unbounded; varchar(255) turned a long request
// into a PG insert error surfacing as `server_error`.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OAUTH_AUTHORIZATION_CODES, (table) => {
    table.text('scope').alter();
  });

  await knex.schema.alterTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.text('scope').alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.OAUTH_AUTHORIZATION_CODES, (table) => {
    table.string('scope', 255).alter();
  });

  await knex.schema.alterTable(MetaTable.OAUTH_TOKENS, (table) => {
    table.string('scope', 255).alter();
  });
};

export { up, down };
