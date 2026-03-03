import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    // Add queryable_field_2 as timestamptz for cron trigger next execution time
    // This allows efficient querying for due cron triggers
    table.timestamp('queryable_field_2', { useTz: true });
  });

  // Add index on queryable_field_2 for efficient time-based queries
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.index(
      'queryable_field_2',
      'nc_dependency_tracker_queryable_field_2_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Drop index first
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropIndex(
      'queryable_field_2',
      'nc_dependency_tracker_queryable_field_2_idx',
    );
  });

  // Then drop column
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropColumn('queryable_field_2');
  });
};

export { up, down };
