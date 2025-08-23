import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

export async function up(knex: Knex): Promise<void> {
  // Create the TrackModifications table
  await knex.schema.createTable(MetaTable.COL_TRACK_MODIFICATIONS, (table) => {
    table.string('id').primary();
    table.string('fk_workspace_id');
    table.string('base_id');
    table.string('fk_column_id').notNullable();
    table.boolean('enabled').defaultTo(false);
    table.json('triggerColumns').defaultTo('[]');
    table.string('updateType').defaultTo('timestamp');
    table.string('customValue');
    table.string('fk_target_view_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Add indexes
    table.index(['fk_column_id']);
    table.index(['fk_workspace_id']);
    table.index(['base_id']);
  });

  // Add foreign key constraint
  await knex.schema.alterTable(MetaTable.COL_TRACK_MODIFICATIONS, (table) => {
    table.foreign('fk_column_id').references('id').inTable(MetaTable.COLUMNS).onDelete('CASCADE');
  });

  // Ensure the TrackModifications column type is available in the database
  // This might be needed for some database systems that require explicit type registration
  try {
    // For PostgreSQL, we might need to create a custom type if required
    if (knex.client.config.client === 'pg') {
      // PostgreSQL doesn't need special handling for this
    }
    // For MySQL, no special handling needed
    // For SQLite, no special handling needed
  } catch (e) {
    console.warn('Database type registration warning:', e);
  }

  // Migrate any existing columns that might have TrackModifications configuration in meta
  // This handles the case where columns were created before the migration
  const existingColumns = await knex(MetaTable.COLUMNS)
    .where('uidt', 'TrackModifications')
    .select('*');

  for (const column of existingColumns) {
    // Check if the column has TrackModifications configuration in meta
    if (column.meta && typeof column.meta === 'string') {
      try {
        const meta = JSON.parse(column.meta);
        if (meta.trackModifications) {
          // Insert the configuration into the new table
          await knex(MetaTable.COL_TRACK_MODIFICATIONS).insert({
            id: knex.raw('uuid()'),
            fk_workspace_id: column.fk_workspace_id,
            base_id: column.base_id,
            fk_column_id: column.id,
            enabled: meta.trackModifications.enabled || false,
            triggerColumns: JSON.stringify(meta.trackModifications.triggerColumns || []),
            updateType: meta.trackModifications.updateType || 'timestamp',
            customValue: meta.trackModifications.customValue || null,
            fk_target_view_id: meta.trackModifications.fk_target_view_id || null,
          });
        }
      } catch (e) {
        // If meta parsing fails, skip this column
        console.warn(`Failed to parse meta for column ${column.id}:`, e);
      }
    }
  }

  // Update any existing TrackModifications columns to ensure they have the correct database type
  // TrackModifications columns should have appropriate data types based on their update type
  const trackModColumns = await knex(MetaTable.COLUMNS)
    .where('uidt', 'TrackModifications')
    .select('*');

  for (const column of trackModColumns) {
    // Get the TrackModifications configuration
    const trackConfig = await knex(MetaTable.COL_TRACK_MODIFICATIONS)
      .where('fk_column_id', column.id)
      .first();

    if (trackConfig) {
      let newDataType = 'varchar(255)'; // Default to varchar
      
      // Set appropriate data type based on update type
      switch (trackConfig.updateType) {
        case 'timestamp':
          newDataType = 'timestamp';
          break;
        case 'user':
          newDataType = 'varchar(255)'; // User ID or name
          break;
        case 'custom':
          newDataType = 'text'; // Custom value could be long
          break;
        default:
          newDataType = 'varchar(255)';
      }

      // Update the column's data type if it's different
      if (column.dt !== newDataType) {
        await knex(MetaTable.COLUMNS)
          .where('id', column.id)
          .update({ dt: newDataType });
      }
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop the foreign key constraint first
  await knex.schema.alterTable(MetaTable.COL_TRACK_MODIFICATIONS, (table) => {
    table.dropForeign(['fk_column_id']);
  });

  // Drop the TrackModifications table
  await knex.schema.dropTable(MetaTable.COL_TRACK_MODIFICATIONS);
}
