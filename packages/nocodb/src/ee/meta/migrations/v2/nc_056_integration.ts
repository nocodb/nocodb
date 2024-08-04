import type { Knex } from 'knex';

// In EE version of this migration is moved v3/nc_024_integration.ts since is_local column is added in v3 migration
const up = async (_knex: Knex) => {
  // empty migration
};

const down = async (_knex: Knex) => {
  // empty migration
};

export { up, down };
