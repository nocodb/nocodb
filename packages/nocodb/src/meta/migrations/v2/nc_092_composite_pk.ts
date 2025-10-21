import type { Knex } from 'knex';
import { BaseVersion, MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const migrationStart = Date.now();
  console.log(
    '[nc_092_composite_pk] Starting composite primary key migration...',
  );

  const versionStart = Date.now();
  console.log(
    '[nc_092_composite_pk] Adding version column to PROJECT table...',
  );
  await knex.schema.alterTable(MetaTable.PROJECT, (t) => {
    t.smallint('version').unsigned().defaultTo(BaseVersion.V2);
  });
  console.log(
    `[nc_092_composite_pk] Version column added in ${
      Date.now() - versionStart
    }ms`,
  );

  const updateStart = Date.now();
  console.log('[nc_092_composite_pk] Updating existing projects to V2...');
  const updatedCount = await knex(MetaTable.PROJECT).update({
    version: BaseVersion.V2,
  });
  console.log(
    `[nc_092_composite_pk] Updated ${updatedCount} projects to V2 in ${
      Date.now() - updateStart
    }ms`,
  );

  // List of tables and their new composite PKs
  const compositePkTables: Record<string, string[]> = {
    [MetaTable.CALENDAR_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.CALENDAR_VIEW_RANGE]: ['base_id', 'id'],
    [MetaTable.CALENDAR_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.COL_BARCODE]: ['base_id', 'id'],
    [MetaTable.COL_BUTTON]: ['base_id', 'id'],
    [MetaTable.COL_FORMULA]: ['base_id', 'id'],
    [MetaTable.COL_LONG_TEXT]: ['base_id', 'id'],
    [MetaTable.COL_LOOKUP]: ['base_id', 'id'],
    [MetaTable.COL_QRCODE]: ['base_id', 'id'],
    [MetaTable.COL_RELATIONS]: ['base_id', 'id'],
    [MetaTable.COL_ROLLUP]: ['base_id', 'id'],
    [MetaTable.COL_SELECT_OPTIONS]: ['base_id', 'id'],
    [MetaTable.COLUMNS]: ['base_id', 'id'],
    [MetaTable.COMMENTS_REACTIONS]: ['base_id', 'id'],
    [MetaTable.COMMENTS]: ['base_id', 'id'],
    [MetaTable.DASHBOARDS]: ['base_id', 'id'],
    [MetaTable.MODEL_ROLE_VISIBILITY]: ['base_id', 'id'],
    [MetaTable.EXTENSIONS]: ['base_id', 'id'],
    [MetaTable.FILTER_EXP]: ['base_id', 'id'],
    [MetaTable.FORM_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.FORM_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.GALLERY_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.GALLERY_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.GRID_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.GRID_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.HOOK_LOGS]: ['base_id', 'id'],
    [MetaTable.HOOKS]: ['base_id', 'id'],
    [MetaTable.KANBAN_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.KANBAN_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.MAP_VIEW_COLUMNS]: ['base_id', 'id'],
    [MetaTable.MAP_VIEW]: ['base_id', 'fk_view_id'],
    [MetaTable.MCP_TOKENS]: ['base_id', 'id'],
    [MetaTable.MODELS]: ['base_id', 'id'],
    [MetaTable.PERMISSIONS]: ['base_id', 'id'],
    [MetaTable.PERMISSION_SUBJECTS]: [
      'base_id',
      'fk_permission_id',
      'subject_type',
      'subject_id',
    ],
    [MetaTable.ROW_COLOR_CONDITIONS]: ['base_id', 'id'],
    [MetaTable.SORT]: ['base_id', 'id'],
    [MetaTable.SOURCES]: ['base_id', 'id'],
    [MetaTable.SYNC_CONFIGS]: ['base_id', 'id'],
    [MetaTable.SYNC_LOGS]: ['base_id', 'id'],
    [MetaTable.SYNC_MAPPINGS]: ['base_id', 'id'],
    [MetaTable.SYNC_SOURCE]: ['base_id', 'id'],
    [MetaTable.VIEWS]: ['base_id', 'id'],
    [MetaTable.WIDGETS]: ['base_id', 'id'],
  };

  const customPkTitles = {
    [MetaTable.SOURCES]: 'nc_bases_v2_pkey',
    [MetaTable.PERMISSION_SUBJECTS]: 'nc_permission_subjects_pkey',
  };

  const cleanupStart = Date.now();
  console.log(
    '[nc_092_composite_pk] Cleaning up rows with null base_id values...',
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
        `[nc_092_composite_pk] Found ${count.count} rows in table ${table} with null base_id.`,
      );

      const deletedRows = await knex(table).whereNull('base_id').del();
      totalCleanedRows += deletedRows;
      console.log(
        `[nc_092_composite_pk] Cleaned ${deletedRows} rows from ${table} in ${
          Date.now() - tableCleanupStart
        }ms`,
      );
    }
  }
  console.log(
    `[nc_092_composite_pk] Cleanup completed. Total rows cleaned: ${totalCleanedRows} in ${
      Date.now() - cleanupStart
    }ms`,
  );

  const pkMigrationStart = Date.now();
  console.log(
    `[nc_092_composite_pk] Starting primary key migration for ${
      Object.keys(compositePkTables).length
    } tables...`,
  );

  for (const [table, columns] of Object.entries(compositePkTables)) {
    const tableStart = Date.now();
    console.log(`[nc_092_composite_pk] Processing table: ${table}`);

    const dropPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary(customPkTitles[table] ? customPkTitles[table] : undefined);
    });
    console.log(
      `[nc_092_composite_pk] Dropped old PK for ${table} in ${
        Date.now() - dropPkStart
      }ms`,
    );

    const addPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns);
    });
    console.log(
      `[nc_092_composite_pk] Added composite PK [${columns.join(
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
        `[nc_092_composite_pk] Added backward compatibility index [${indexColumns.join(
          ', ',
        )}] for ${table} in ${Date.now() - indexStart}ms`,
      );
    }

    console.log(
      `[nc_092_composite_pk] Completed ${table} in ${
        Date.now() - tableStart
      }ms`,
    );
  }

  console.log(
    `[nc_092_composite_pk] Primary key migration completed for all tables in ${
      Date.now() - pkMigrationStart
    }ms`,
  );
  console.log(
    `[nc_092_composite_pk] Total migration time: ${
      Date.now() - migrationStart
    }ms`,
  );
};

const down = async (knex: Knex) => {
  const rollbackStart = Date.now();
  console.log('[nc_092_composite_pk] Starting rollback migration...');

  const versionDropStart = Date.now();
  console.log(
    '[nc_092_composite_pk] Dropping version column from PROJECT table...',
  );
  await knex.schema.alterTable(MetaTable.PROJECT, (t) => {
    t.dropColumn('version');
  });
  console.log(
    `[nc_092_composite_pk] Version column dropped in ${
      Date.now() - versionDropStart
    }ms`,
  );

  // List of tables and their old PKs
  const oldPkTables: Record<string, string[]> = {
    [MetaTable.CALENDAR_VIEW_COLUMNS]: ['id'],
    [MetaTable.CALENDAR_VIEW_RANGE]: ['id'],
    [MetaTable.CALENDAR_VIEW]: ['fk_view_id'],
    [MetaTable.COL_BARCODE]: ['id'],
    [MetaTable.COL_BUTTON]: ['id'],
    [MetaTable.COL_FORMULA]: ['id'],
    [MetaTable.COL_LONG_TEXT]: ['id'],
    [MetaTable.COL_LOOKUP]: ['id'],
    [MetaTable.COL_QRCODE]: ['id'],
    [MetaTable.COL_RELATIONS]: ['id'],
    [MetaTable.COL_ROLLUP]: ['id'],
    [MetaTable.COL_SELECT_OPTIONS]: ['id'],
    [MetaTable.COLUMNS]: ['id'],
    [MetaTable.COMMENTS_REACTIONS]: ['id'],
    [MetaTable.COMMENTS]: ['id'],
    [MetaTable.DASHBOARDS]: ['id'],
    [MetaTable.MODEL_ROLE_VISIBILITY]: ['id'],
    [MetaTable.EXTENSIONS]: ['id'],
    [MetaTable.FILTER_EXP]: ['id'],
    [MetaTable.FORM_VIEW_COLUMNS]: ['id'],
    [MetaTable.FORM_VIEW]: ['fk_view_id'],
    [MetaTable.GALLERY_VIEW_COLUMNS]: ['id'],
    [MetaTable.GALLERY_VIEW]: ['fk_view_id'],
    [MetaTable.GRID_VIEW_COLUMNS]: ['id'],
    [MetaTable.GRID_VIEW]: ['fk_view_id'],
    [MetaTable.HOOK_LOGS]: ['id'],
    [MetaTable.HOOKS]: ['id'],
    [MetaTable.KANBAN_VIEW_COLUMNS]: ['id'],
    [MetaTable.KANBAN_VIEW]: ['fk_view_id'],
    [MetaTable.MAP_VIEW_COLUMNS]: ['id'],
    [MetaTable.MAP_VIEW]: ['fk_view_id'],
    [MetaTable.MCP_TOKENS]: ['id'],
    [MetaTable.MODELS]: ['id'],
    [MetaTable.PERMISSIONS]: ['id'],
    [MetaTable.PERMISSION_SUBJECTS]: [
      'fk_permission_id',
      'subject_type',
      'subject_id',
    ],
    [MetaTable.ROW_COLOR_CONDITIONS]: ['id'],
    [MetaTable.SORT]: ['id'],
    [MetaTable.SOURCES]: ['id'],
    [MetaTable.SYNC_CONFIGS]: ['id'],
    [MetaTable.SYNC_LOGS]: ['id'],
    [MetaTable.SYNC_MAPPINGS]: ['id'],
    [MetaTable.SYNC_SOURCE]: ['id'],
    [MetaTable.VIEWS]: ['id'],
    [MetaTable.WIDGETS]: ['id'],
  };

  const customPkTitles = {
    [MetaTable.SOURCES]: 'nc_bases_v2_pkey',
    [MetaTable.PERMISSION_SUBJECTS]: 'nc_permission_subjects_pkey',
  };

  const pkRollbackStart = Date.now();
  console.log(
    `[nc_092_composite_pk] Starting rollback for ${
      Object.keys(oldPkTables).length
    } tables...`,
  );

  for (const [table, columns] of Object.entries(oldPkTables)) {
    const tableStart = Date.now();
    console.log(`[nc_092_composite_pk] Rolling back table: ${table}`);

    const dropCompositePkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary();
    });
    console.log(
      `[nc_092_composite_pk] Dropped composite PK for ${table} in ${
        Date.now() - dropCompositePkStart
      }ms`,
    );

    const restoreOldPkStart = Date.now();
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns, {
        constraintName: customPkTitles[table]
          ? customPkTitles[table]
          : undefined,
      });
    });
    console.log(
      `[nc_092_composite_pk] Restored old PK [${columns.join(
        ', ',
      )}] for ${table} in ${Date.now() - restoreOldPkStart}ms`,
    );

    console.log(
      `[nc_092_composite_pk] Completed rollback for ${table} in ${
        Date.now() - tableStart
      }ms`,
    );
  }

  console.log(
    `[nc_092_composite_pk] Rollback completed for all tables in ${
      Date.now() - pkRollbackStart
    }ms`,
  );
  console.log(
    `[nc_092_composite_pk] Total rollback time: ${
      Date.now() - rollbackStart
    }ms`,
  );
};

export { up, down };
