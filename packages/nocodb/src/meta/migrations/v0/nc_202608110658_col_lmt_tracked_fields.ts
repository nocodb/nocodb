import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Junction table for LastModifiedTime / LastModifiedBy columns that track
// specific fields (meta.fields_mode === 'specific'): one row per
// (lmt column, tracked column) pair — the tracked-field id set lives here
// rather than in the column's meta JSON, so the generic meta-dependency
// delete cascade and import/duplicate id-remap cover it.
// Mirrors nc_hook_trigger_fields.
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COL_LMT_TRACKED_FIELDS, (table) => {
    table.string('fk_column_id', 20).notNullable();
    table.string('fk_tracked_column_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.timestamps(true, true);
    table.primary([
      'fk_workspace_id',
      'base_id',
      'fk_column_id',
      'fk_tracked_column_id',
    ]);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COL_LMT_TRACKED_FIELDS);
};

export { up, down };
