import type { Knex } from 'knex';

// Stub migration — the LastModifiedTime/By tracked-field set is stored in the
// existing `nc_dependency_tracker` table (column → column edges), so no
// dedicated junction table is created. The name stays registered to satisfy
// knex's validateMigrationList on databases that ran the earlier version of
// this migration while the PR was in review.
const up = async (_knex: Knex) => {};

const down = async (_knex: Knex) => {};

export { up, down };
