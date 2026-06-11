import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    // Queryable fields (indexed) - for fields used in WHERE clauses
    // queryable_field_0: Workflow=nodeType (e.g., "nocodb.trigger.after_insert")
    // queryable_field_1: Reserved for future queryable needs
    table.text('queryable_field_0');
    table.text('queryable_field_1');

    // Meta field (not indexed) - JSON storage for display/reference data
    table.text('meta');
  });

  // Add indexes only on queryable fields
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    if (!['mysql', 'mysql2'].includes(knex.client.config.client)) {
      table.index(
        'queryable_field_0',
        'nc_dependency_tracker_queryable_field_0_idx',
      );
      table.index(
        'queryable_field_1',
        'nc_dependency_tracker_queryable_field_1_idx',
      );
    }
  });
};

const down = async (knex: Knex) => {
  // Drop indexes first
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropIndex(
      'queryable_field_0',
      'nc_dependency_tracker_queryable_field_0_idx',
    );
    table.dropIndex(
      'queryable_field_1',
      'nc_dependency_tracker_queryable_field_1_idx',
    );
  });

  // Then drop columns
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropColumn('queryable_field_0');
    table.dropColumn('queryable_field_1');
    table.dropColumn('meta');
  });
};

export { up, down };
