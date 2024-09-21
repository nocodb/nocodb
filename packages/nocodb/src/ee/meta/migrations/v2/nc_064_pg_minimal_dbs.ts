import type { Knex } from 'knex';

// is_local column is added from v3 migrations so this migration should be empty for cloud
const up = async (_knex: Knex) => {
  // empty migration
};

const down = async (_knex: Knex) => {
  // empty migration
};

export { up, down };
