import type { Knex } from 'knex';

// In EE version of this migration is moved v3/nc_029_encrypt_flag.ts since integration table will be created in v3 migration
const up = async (_knex: Knex) => {
  // empty migration
};

const down = async (_knex: Knex) => {
  // empty migration
};

export { up, down };
