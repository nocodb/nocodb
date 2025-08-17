import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

export async function up(knex: Knex): Promise<void> {
  // Create the LastModified trigger columns table - simple relationship table
  await knex.schema.createTable(
    MetaTable.COL_LAST_MOD_TRIGGER_COLUMNS,
    (table) => {
      table.string('id').primary();
      table.string('fk_workspace_id');
      table.string('base_id');
      table.string('fk_column_id').notNullable(); // The LastModified column
      table.string('fk_trigger_column_id').notNullable(); // The column that triggers updates

      table.timestamps(true, true);

      // Add indexes
      table.index(['fk_column_id']);
      table.index(['fk_trigger_column_id']);
      table.index(['base_id', 'fk_workspace_id'], 'nc_col_mod_track_context');
    },
  );
}

export async function down(knex: Knex): Promise<void> {
  // Drop the TrackModifications trigger columns table
  await knex.schema.dropTable(MetaTable.COL_LAST_MOD_TRIGGER_COLUMNS);
}
