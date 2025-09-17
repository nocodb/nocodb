import type { Knex } from 'knex';
import { BaseVersion, MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (t) => {
    t.smallint('version').unsigned().defaultTo(BaseVersion.V2);
  });

  // Make sure all existing projects are marked as V2
  await knex(MetaTable.PROJECT).update({ version: BaseVersion.V2 });

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
    [MetaTable.CUSTOM_URLS]: ['base_id', 'id'],
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
    [MetaTable.SCRIPTS]: ['base_id', 'id'],
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

  // first make sure to clear rows with null base_id values
  for (const table of Object.keys(compositePkTables)) {
    const count = await knex(table)
      .whereNull('base_id')
      .count('*', { as: 'count' })
      .first();
    if (count && parseInt(`${count.count}`, 10) > 0) {
      console.log(
        `There are ${count.count} rows in table ${table} with null base_id.`,
      );

      // delete those rows
      await knex(table).whereNull('base_id').del();
    }
  }

  for (const [table, columns] of Object.entries(compositePkTables)) {
    // Drop old PK
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary(customPkTitles[table] ? customPkTitles[table] : undefined);
    });
    // Add new composite PK
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns);
    });
    // Add index excluding base_id for backward compatibility (optional)
    const indexColumns = columns.filter((col) => col !== 'base_id');
    if (indexColumns.length > 0) {
      await knex.schema.alterTable(table, (t) => {
        t.index(indexColumns, `${table}_oldpk_idx`);
      });
    }
  }
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (t) => {
    t.dropColumn('version');
  });

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
    [MetaTable.CUSTOM_URLS]: ['id'],
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
    [MetaTable.SCRIPTS]: ['id'],
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

  for (const [table, columns] of Object.entries(oldPkTables)) {
    // Drop composite PK
    await knex.schema.alterTable(table, (t) => {
      t.dropPrimary();
    });
    // Restore old PK
    await knex.schema.alterTable(table, (t) => {
      t.primary(columns, {
        constraintName: customPkTitles[table]
          ? customPkTitles[table]
          : undefined,
      });
    });
  }
};

export { up, down };
