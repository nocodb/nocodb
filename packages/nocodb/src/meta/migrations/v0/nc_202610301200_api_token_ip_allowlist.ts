import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    // JSON array of IPv4/IPv6 addresses and CIDR ranges the token may be used
    // from. NULL / empty = unrestricted (existing behaviour).
    table.text('ip_allowlist').nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropColumn('ip_allowlist');
  });
};

export { up, down };
