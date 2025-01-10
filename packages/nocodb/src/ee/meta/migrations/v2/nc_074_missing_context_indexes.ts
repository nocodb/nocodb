import type { Knex } from 'knex';

// In EE version of this migration is moved v3/nc_035_missing_context_indexes since fk_workspace_id is added in v3 migration for EE
const up = async (_knex: Knex) => {
  // empty migration
};

const down = async (_knex: Knex) => {
  // empty migration
};

export { up, down };
