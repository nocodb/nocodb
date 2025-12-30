import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const migrationStart = Date.now();
  console.log(
    '[nc_013_composite_pk_missing_tables] Starting composite primary key migration for missing tables...',
  );

  // List of tables that were missing from nc_092 migration
  const compositePkTables: Record<string, string[]> = {
    [MetaTable.AUTOMATIONS]: ['base_id', 'id'],
    [MetaTable.AUTOMATION_EXECUTIONS]: ['base_id', 'id'],
    [MetaTable.DEPENDENCY_TRACKER]: ['base_id', 'id'],
  };

  // Custom constraint names for tables that have non-standard PK names
  const customPkTitles = {
    [MetaTable.AUTOMATION_EXECUTIONS]: 'nc_workflow_executions_pkey',
  };

  const cleanupStart = Date.now();
  console.log(
    '[nc_013_composite_pk_missing_tables] Cleaning up rows with null base_id values...',
  );
  let totalCleanedRows = 0;

  for (const table of Object.keys(compositePkTables)) {
    const tableCleanupStart = Date.now();
    const count = await knex(table)
      .whereNull('base_id')
      .count('*', { as: 'count' })
      .first();
    if (count && parseInt(`${count.count}`, 10) > 0) {
      console.log(
        `[nc_013_composite_pk_missing_tables] Found ${count.count} rows in table ${table} with null base_id.`,
      );

      const deletedRows = await knex(table).whereNull('base_id').del();
      totalCleanedRows += deletedRows;
      console.log(
        `[nc_013_composite_pk_missing_tables] Cleaned ${deletedRows} rows from ${table} in ${
          Date.now() - tableCleanupStart
        }ms`,
      );
    }
  }
  console.log(
    `[nc_013_composite_pk_missing_tables] Cleanup completed. Total rows cleaned: ${totalCleanedRows} in ${
      Date.now() - cleanupStart
    }ms`,
  );

  const pkMigrationStart = Date.now();
  console.log(
    `[nc_013_composite_pk_missing_tables] Starting primary key migration for ${
      Object.keys(compositePkTables).length
    } tables...`,
  );

  for (const [table, columns] of Object.entries(compositePkTables)) {
    const tableStart = Date.now();
    console.log(
      `[nc_013_composite_pk_missing_tables] Processing table: ${table}`,
    );

    const dropPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary(customPkTitles[table] ? customPkTitles[table] : undefined);
    });
    console.log(
      `[nc_013_composite_pk_missing_tables] Dropped old PK for ${table} in ${
        Date.now() - dropPkStart
      }ms`,
    );

    const addPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns);
    });
    console.log(
      `[nc_013_composite_pk_missing_tables] Added composite PK [${columns.join(
        ', ',
      )}] for ${table} in ${Date.now() - addPkStart}ms`,
    );

    const indexColumns = columns.filter((col) => col !== 'base_id');
    if (indexColumns.length > 0) {
      const indexStart = Date.now();
      await knex.schema.alterTable(table, (t) => {
        t.index(indexColumns, `${table}_oldpk_idx`);
      });
      console.log(
        `[nc_013_composite_pk_missing_tables] Added backward compatibility index [${indexColumns.join(
          ', ',
        )}] for ${table} in ${Date.now() - indexStart}ms`,
      );
    }

    console.log(
      `[nc_013_composite_pk_missing_tables] Completed ${table} in ${
        Date.now() - tableStart
      }ms`,
    );
  }

  console.log(
    `[nc_013_composite_pk_missing_tables] Primary key migration completed for all tables in ${
      Date.now() - pkMigrationStart
    }ms`,
  );
  console.log(
    `[nc_013_composite_pk_missing_tables] Total migration time: ${
      Date.now() - migrationStart
    }ms`,
  );
};

const down = async (knex: Knex) => {
  const rollbackStart = Date.now();
  console.log(
    '[nc_013_composite_pk_missing_tables] Starting rollback migration...',
  );

  // List of tables and their old PKs
  const oldPkTables: Record<string, string[]> = {
    [MetaTable.AUTOMATIONS]: ['id'],
    [MetaTable.AUTOMATION_EXECUTIONS]: ['id'],
    [MetaTable.DEPENDENCY_TRACKER]: ['id'],
  };

  // Custom constraint names for tables that have non-standard PK names
  const customPkTitles = {
    [MetaTable.AUTOMATION_EXECUTIONS]: 'nc_workflow_executions_pkey',
  };

  const pkRollbackStart = Date.now();
  console.log(
    `[nc_013_composite_pk_missing_tables] Starting rollback for ${
      Object.keys(oldPkTables).length
    } tables...`,
  );

  for (const [table, columns] of Object.entries(oldPkTables)) {
    const tableStart = Date.now();
    console.log(
      `[nc_013_composite_pk_missing_tables] Rolling back table: ${table}`,
    );

    const dropCompositePkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary();
    });
    console.log(
      `[nc_013_composite_pk_missing_tables] Dropped composite PK for ${table} in ${
        Date.now() - dropCompositePkStart
      }ms`,
      {
        constraintName: customPkTitles[table]
          ? customPkTitles[table]
          : undefined,
      },
    );

    const restoreOldPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns);
    });
    console.log(
      `[nc_013_composite_pk_missing_tables] Restored old PK [${columns.join(
        ', ',
      )}] for ${table} in ${Date.now() - restoreOldPkStart}ms`,
    );

    const dropIndexStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex([], `${table}_oldpk_idx`);
    });
    console.log(
      `[nc_013_composite_pk_missing_tables] Dropped backward compatibility index for ${table} in ${
        Date.now() - dropIndexStart
      }ms`,
    );

    console.log(
      `[nc_013_composite_pk_missing_tables] Completed rollback for ${table} in ${
        Date.now() - tableStart
      }ms`,
    );
  }

  console.log(
    `[nc_013_composite_pk_missing_tables] Rollback completed for all tables in ${
      Date.now() - pkRollbackStart
    }ms`,
  );
  console.log(
    `[nc_013_composite_pk_missing_tables] Total rollback time: ${
      Date.now() - rollbackStart
    }ms`,
  );
};

export { up, down };
