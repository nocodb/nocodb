import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

export async function up(knex: Knex): Promise<void> {
  // Create the TrackModifications trigger columns table - simple relationship table
  await knex.schema.createTable(MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS, (table) => {
    table.string('id').primary();
    table.string('fk_workspace_id');
    table.string('base_id');
    table.string('fk_column_id').notNullable(); // The TrackModifications column
    table.string('fk_trigger_column_id').notNullable(); // The column that triggers updates

    table.timestamps(true, true);

    // Add indexes
    table.index(['fk_column_id']);
    table.index(['fk_trigger_column_id']);
    table.index(['fk_workspace_id']);
    table.index(['base_id']);
  });
  //
  // // Ensure the TrackModifications column type is available in the database
  // try {
  //   // For PostgreSQL, we might need to create a custom type if required
  //   if (knex.client.config.client === 'pg') {
  //     // PostgreSQL doesn't need special handling for this
  //   }
  //   // For MySQL, no special handling needed
  //   // For SQLite, no special handling needed
  // } catch (e) {
  //   console.warn('Database type registration warning:', e);
  // }
  //
  // // Migrate any existing columns that might have TrackModifications configuration in meta
  // // This handles the case where columns were created before the migration
  // const existingColumns = await knex(MetaTable.COLUMNS)
  //   .where('uidt', 'TrackModifications')
  //   .select('*');
  //
  // for (const column of existingColumns) {
  //   // Check if the column has TrackModifications configuration in meta
  //   if (column.meta && typeof column.meta === 'string') {
  //     try {
  //       const meta = JSON.parse(column.meta);
  //       if (meta.trackModifications) {
  //         const triggerColumns = meta.trackModifications.triggerColumns || [];
  //
  //         // Insert each trigger column relationship
  //         for (const triggerColId of triggerColumns) {
  //           await knex(MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS).insert({
  //             id: knex.raw(knex.client.config.client === 'pg' ? 'gen_random_uuid()' : 'uuid()'),
  //             fk_workspace_id: column.fk_workspace_id,
  //             base_id: column.base_id,
  //             fk_column_id: column.id,
  //             fk_trigger_column_id: triggerColId,
  //           });
  //         }
  //       }
  //     } catch (e) {
  //       // If meta parsing fails, skip this column
  //       console.warn(`Failed to parse meta for column ${column.id}:`, e);
  //     }
  //   }
  // }
  //
  // // Update any existing TrackModifications columns to ensure they have the correct database type
  // // TrackModifications columns should have appropriate data types based on their update type
  // const trackModColumns = await knex(MetaTable.COLUMNS)
  //   .where('uidt', 'TrackModifications')
  //   .select('*');
  //
  // for (const column of trackModColumns) {
  //   // Get the TrackModifications configuration from colOptions or meta
  //   let updateType = 'timestamp'; // Default
  //
  //   if (column.colOptions && typeof column.colOptions === 'string') {
  //     try {
  //       const colOpts = JSON.parse(column.colOptions);
  //       updateType = colOpts.updateType || 'timestamp';
  //     } catch (e) {
  //       // Use default if parsing fails
  //     }
  //   } else if (column.meta && typeof column.meta === 'string') {
  //     try {
  //       const meta = JSON.parse(column.meta);
  //       if (meta.trackModifications) {
  //         updateType = meta.trackModifications.updateType || 'timestamp';
  //       }
  //     } catch (e) {
  //       // Use default if parsing fails
  //     }
  //   }
  //
  //   let newDataType = 'varchar(255)'; // Default to varchar
  //
  //   // Set appropriate data type based on update type
  //   switch (updateType) {
  //     case 'timestamp':
  //       newDataType = 'timestamp';
  //       break;
  //     case 'user':
  //       newDataType = 'varchar(255)'; // User ID or name
  //       break;
  //     case 'custom':
  //       newDataType = 'text'; // Custom value could be long
  //       break;
  //     default:
  //       newDataType = 'varchar(255)';
  //   }
  //
  //   // Update the column's data type if it's different
  //   if (column.dt !== newDataType) {
  //     await knex(MetaTable.COLUMNS)
  //       .where('id', column.id)
  //       .update({ dt: newDataType });
  //   }
  // }
}

export async function down(knex: Knex): Promise<void> {
  // Drop the TrackModifications trigger columns table
  await knex.schema.dropTable(MetaTable.COL_TRACK_MODIFICATIONS_TRIGGER_COLUMNS);
}
