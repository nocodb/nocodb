/**
 * DEPRECATED: The enabled column is now included in v0/nc_018_record_templates.
 * All new migrations should be added to XcMigrationSourcev0.
 * This file is kept only because the filesystem does not allow deletion.
 */
import type { Knex } from 'knex';

const up = async (_knex: Knex) => {
  // No-op: enabled column now created in v0/nc_018_record_templates
};

const down = async (_knex: Knex) => {
  // No-op
};

export { up, down };
