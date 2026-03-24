import type { Knex } from 'knex';

// Stub migration — schema changes were applied in another branch.
// This file exists to satisfy knex validateMigrationList.
const up = async (_knex: Knex) => {};

const down = async (_knex: Knex) => {};

export { up, down };
