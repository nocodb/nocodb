// This migration is intentionally empty — superseded by nc_099_timeline_view.
// The nc_017 number was a duplicate (conflicts with nc_017_add_canonical_email_to_users).
// This file should be deleted from the repository.
import type { Knex } from 'knex';

const up = async (_knex: Knex) => {
  // no-op: handled by nc_099_timeline_view
};

const down = async (_knex: Knex) => {
  // no-op
};

export { up, down };
