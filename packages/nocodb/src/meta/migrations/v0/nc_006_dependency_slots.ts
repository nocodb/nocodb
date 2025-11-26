import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    // Queryable slots (indexed) - for fields that are queried
    // queryable_slot_0: Workflow=nodeType (e.g., "nocodb.trigger.after_insert")
    // queryable_slot_1: Reserved for future queryable fields
    table.text('queryable_slot_0');
    table.text('queryable_slot_1');

    // Non-queryable slots (not indexed) - for display/reference only
    // slot_0: path - Expression path for all types (e.g., "config.data.category.column_id")
    // slot_1: Workflow=nodeId (specific node ID within workflow)
    // slot_2: Reserved for future use
    table.text('slot_0');
    table.text('slot_1');
    table.text('slot_2');
  });

  // Add indexes only on queryable slots
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.index(
      'queryable_slot_0',
      'nc_dependency_tracker_queryable_slot_0_idx',
    );
    table.index(
      'queryable_slot_1',
      'nc_dependency_tracker_queryable_slot_1_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Drop indexes first
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropIndex(
      'queryable_slot_0',
      'nc_dependency_tracker_queryable_slot_0_idx',
    );
    table.dropIndex(
      'queryable_slot_1',
      'nc_dependency_tracker_queryable_slot_1_idx',
    );
  });

  // Then drop columns
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropColumn('queryable_slot_0');
    table.dropColumn('queryable_slot_1');
    table.dropColumn('slot_0');
    table.dropColumn('slot_1');
    table.dropColumn('slot_2');
  });
};

export { up, down };
