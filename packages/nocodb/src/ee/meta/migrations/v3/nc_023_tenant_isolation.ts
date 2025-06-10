import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/*
  Add base_id to:
    nc_calendar_view_range_v2: MetaTable.CALENDAR_VIEW_RANGE
    nc_col_barcode_v2: MetaTable.COL_BARCODE
    nc_col_formula_v2: MetaTable.COL_FORMULA
    nc_col_lookup_v2: MetaTable.COL_LOOKUP
    nc_col_qrcode_v2: MetaTable.COL_QRCODE
    nc_col_relations_v2: MetaTable.COL_RELATIONS
    nc_col_rollup_v2: MetaTable.COL_ROLLUP
    nc_col_select_options_v2: MetaTable.COL_SELECT_OPTIONS
    nc_model_stats_v2: MetaTable.MODEL_STAT -> only one that have fk_workspace_id but not base_id
  Add fk_workspace_id to:
    nc_api_tokens: MetaTable.API_TOKENS
    nc_audit_v2: MetaTable.AUDIT
    nc_base_users_v2: MetaTable.PROJECT_USERS
    nc_calendar_view_columns_v2: MetaTable.CALENDAR_VIEW_COLUMNS
    nc_calendar_view_v2: MetaTable.CALENDAR_VIEW
    nc_columns_v2: MetaTable.COLUMNS
    nc_extensions: MetaTable.EXTENSIONS
    nc_filter_exp_v2: MetaTable.FILTER_EXP
    nc_form_view_columns_v2: MetaTable.FORM_VIEW_COLUMNS
    nc_form_view_v2: MetaTable.FORM_VIEW
    nc_gallery_view_columns_v2: MetaTable.GALLERY_VIEW_COLUMNS
    nc_gallery_view_v2: MetaTable.GALLERY_VIEW
    nc_grid_view_columns_v2: MetaTable.GRID_VIEW_COLUMNS
    nc_grid_view_v2: MetaTable.GRID_VIEW
    nc_hook_logs_v2: MetaTable.HOOK_LOGS
    nc_hooks_v2: MetaTable.HOOKS
    nc_kanban_view_columns_v2: MetaTable.KANBAN_VIEW_COLUMNS
    nc_kanban_view_v2: MetaTable.KANBAN_VIEW
    nc_map_view_columns_v2: MetaTable.MAP_VIEW_COLUMNS
    nc_map_view_v2: MetaTable.MAP_VIEW
    nc_models_v2: MetaTable.MODELS
    nc_sort_v2: MetaTable.SORT
    nc_source_v2: MetaTable.BASES
    nc_sync_logs_v2: MetaTable.SYNC_LOGS
    nc_sync_source_v2: MetaTable.SYNC_SOURCE
    nc_views_v2: MetaTable.VIEWS
    nc_disabled_models_for_role_v2: MetaTable.MODEL_ROLE_VISIBILITY
    nc_comments: MetaTable.COMMENTS
    nc_comment_reactions: MetaTable.COMMENTS_REACTIONS
    nc_user_comment_notifications_preference: MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE

    nc_calendar_view_range_v2: MetaTable.CALENDAR_VIEW_RANGE
    nc_col_barcode_v2: MetaTable.COL_BARCODE
    nc_col_formula_v2: MetaTable.COL_FORMULA
    nc_col_lookup_v2: MetaTable.COL_LOOKUP
    nc_col_qrcode_v2: MetaTable.COL_QRCODE
    nc_col_relations_v2: MetaTable.COL_RELATIONS
    nc_col_rollup_v2: MetaTable.COL_ROLLUP
    nc_col_select_options_v2: MetaTable.COL_SELECT_OPTIONS
*/

const log = (message: string) => {
  console.log(`nc_023_tenant_isolation: ${message}`);
};

let hrTime = process.hrtime();

const logExecutionTime = (message: string) => {
  const [seconds, nanoseconds] = process.hrtime(hrTime);
  const elapsedSeconds = seconds + nanoseconds / 1e9;
  log(`${message} in ${elapsedSeconds}s`);
};

const migrateDataWithJoin = async (
  knex: Knex,
  table: string,
  column: string,
  joinTable: string,
  joinColumn: string,
  destinationColumn: string,
  sourceColumn: string,
) => {
  const sourceType = knex.client.driverName;

  switch (sourceType) {
    case 'pg':
      await knex.raw(`
        UPDATE ${table}
        SET ${destinationColumn} = ${joinTable}.${sourceColumn}
        FROM ${joinTable}
        WHERE ${table}.${column} = ${joinTable}.${joinColumn}
      `);
      break;
    case 'mysql':
    case 'mysql2':
      await knex.raw(`
        UPDATE ${table}
        JOIN ${joinTable}
        ON ${table}.${column} = ${joinTable}.${joinColumn}
        SET ${table}.${destinationColumn} = ${joinTable}.${sourceColumn}
      `);
      break;
    case 'sqlite3':
      await knex.raw(`
        UPDATE ${table}
        SET ${destinationColumn} = (
          SELECT ${joinTable}.${sourceColumn}
          FROM ${joinTable}
          WHERE ${table}.${column} = ${joinTable}.${joinColumn}
        )
      `);
      break;
    default:
      throw new Error(`Unsupported database: ${sourceType}`);
  }
};

const listIndexesOnColumn = async (
  knex: Knex,
  table: string,
  column: string,
) => {
  const sourceType = knex.client.driverName;

  switch (sourceType) {
    case 'pg': {
      const indexes = await knex.raw(
        `
        SELECT
          t.relname AS table_name,
          i.relname AS index_name,
          a.attname AS column_name
        FROM
          pg_class t,
          pg_class i,
          pg_index ix,
          pg_attribute a
        WHERE
          t.oid = ix.indrelid
          AND i.oid = ix.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = ANY(ix.indkey)
          AND t.relkind = 'r'
          AND t.relname = ?
          AND a.attname = ?;
        `,
        [table, column],
      );

      return indexes.rows.map((row: any) => row.index_name);
    }
    case 'mysql':
    case 'mysql2': {
      const indexes = await knex.raw(
        `
        SELECT
          INDEX_NAME
        FROM
          INFORMATION_SCHEMA.STATISTICS
        WHERE
          TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        `,
        [knex.client.database(), table, column],
      );

      return indexes[0].map((row: any) => row.INDEX_NAME);
    }
    case 'sqlite3': {
      const indexes = await knex.raw(
        `
        PRAGMA index_list(??)
        `,
        [table],
      );

      return indexes
        .map((row: any) => row.name)
        .filter(
          (name: string) =>
            name.includes(column) ||
            (column === 'base_id' && name.includes('project_id')),
        );
    }

    default:
      throw new Error(`Unsupported database: ${sourceType}`);
  }
};

const up = async (knex: Knex) => {
  log('Migration started');

  log('Adding missing base_id columns');

  const addBaseId = [
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.MODEL_STAT,
  ];

  hrTime = process.hrtime();

  for (const table of addBaseId) {
    if (!(await knex.schema.hasColumn(table, 'base_id'))) {
      await knex.schema.alterTable(table, (table) => {
        table.string('base_id', 20);
      });
    }
  }

  logExecutionTime('Added missing base_id columns');

  const addFkWorkspaceId = [
    MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COLUMNS,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES_OLD,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.VIEWS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.COMMENTS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
  ];

  log('Adding missing fk_workspace_id columns');

  hrTime = process.hrtime();

  for (const table of addFkWorkspaceId) {
    if (!(await knex.schema.hasColumn(table, 'fk_workspace_id'))) {
      await knex.schema.alterTable(table, (table) => {
        table.string('fk_workspace_id', 20);
      });
    }
  }

  logExecutionTime('Added missing fk_workspace_id columns');

  // Migrate data

  log('Migrating data');

  /*
    nc_calendar_view_range_v2	only fk_view_id is available - join with nc_views_v2 on id to get base_id
    nc_col_barcode_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_formula_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_lookup_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_qrcode_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_relations_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_rollup_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_col_select_options_v2	only fk_column_id is available - join with nc_columns_v2 on id to get base_id
    nc_model_stats_v2	only fk_model_id is available - join with nc_models_v2 on id to get base_id

    For fk_workspace_id, join with nc_bases_v2 on id to get fk_workspace_id
  */

  // Migrate base_id

  const migrateBaseId = [
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.MODEL_STAT,
  ];

  for (const table of migrateBaseId) {
    hrTime = process.hrtime();

    if (table === MetaTable.MODEL_STAT) {
      await migrateDataWithJoin(
        knex,
        table,
        'fk_model_id',
        MetaTable.MODELS,
        'id',
        'base_id',
        'base_id',
      );
    } else if (table === MetaTable.CALENDAR_VIEW_RANGE) {
      await migrateDataWithJoin(
        knex,
        MetaTable.CALENDAR_VIEW_RANGE,
        'fk_view_id',
        MetaTable.VIEWS,
        'id',
        'base_id',
        'base_id',
      );
    } else {
      await migrateDataWithJoin(
        knex,
        table,
        'fk_column_id',
        MetaTable.COLUMNS,
        'id',
        'base_id',
        'base_id',
      );
    }

    logExecutionTime(`Migrated base_id for ${table}`);
  }

  // Migrate fk_workspace_id

  const migrateFkWorkspaceId = [
    // MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COLUMNS,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES_OLD,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.VIEWS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.COMMENTS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
  ];

  for (const table of migrateFkWorkspaceId) {
    hrTime = process.hrtime();

    await migrateDataWithJoin(
      knex,
      table,
      'base_id',
      MetaTable.PROJECT,
      'id',
      'fk_workspace_id',
      'fk_workspace_id',
    );

    logExecutionTime(`Migrated fk_workspace_id for ${table}`);
  }

  // Drop existing base_id indexes
  const dropBaseIdIndexes = [
    MetaTable.AUDIT,
    MetaTable.SOURCES_OLD,
    MetaTable.MODELS,
    MetaTable.PROJECT_USERS,
    MetaTable.SYNC_SOURCE,
    MetaTable.EXTENSIONS,
  ];

  log('Dropping existing base_id indexes');

  hrTime = process.hrtime();

  for (const table of dropBaseIdIndexes) {
    const indexes: string[] = await listIndexesOnColumn(knex, table, 'base_id');

    for (const index of indexes) {
      log(`Dropping index ${index} on ${table}.base_id`);

      /*
        Skip primary key indexes
          This is only required on EE migration
          This is required because v3 migrations run after v2 migrations
          So even if we add (base_id, fk_user_id) composite primary key in a migration newer than this, it would still try to drop it for fresh migrations
      */
      if (index.endsWith('_pkey')) {
        continue;
      }

      await knex.schema.alterTable(table, (table) => {
        table.dropIndex('base_id', index);
      });
    }
  }

  logExecutionTime('Dropped existing base_id indexes');

  // Recreate existing source_id indexes if clashing with base_id (old name for source_id)
  const recreateSourceIdIndexes = [MetaTable.MODELS, MetaTable.SYNC_SOURCE];

  log('Recreating existing source_id indexes');

  hrTime = process.hrtime();

  for (const tbl of recreateSourceIdIndexes) {
    const indexes: string[] = await listIndexesOnColumn(knex, tbl, 'source_id');

    // remove duplicate indexes
    const uniqueIndexes = Array.from(new Set(indexes));

    for (const index of uniqueIndexes) {
      // Recreate only if index name will clash with base_id
      if (index !== `${tbl}_base_id_index`) {
        continue;
      }

      log(`Recreating index ${index} on ${tbl}.source_id`);

      await knex.schema.alterTable(tbl, (table) => {
        table.dropIndex('source_id', `${tbl}_base_id_index`);
        table.index('source_id');
      });
    }
  }

  logExecutionTime('Recreated existing source_id indexes');

  // Add indexes

  const addIndexes = [
    // MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COLUMNS,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES_OLD,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.VIEWS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.COMMENTS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.MODEL_STAT,
  ];

  log('Adding indexes');

  for (const table of addIndexes) {
    hrTime = process.hrtime();

    await knex.schema.alterTable(table, (table) => {
      table.index(['base_id', 'fk_workspace_id']);
    });

    logExecutionTime(`Added indexes for ${table}`);
  }

  log('Migration completed');
};

const down = async (knex: Knex) => {
  // Drop base_id
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_RANGE, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_BARCODE, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_LOOKUP, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_QRCODE, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.dropColumn('base_id');
  });
  await knex.schema.alterTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.dropColumn('base_id');
  });

  // Drop fk_workspace_id
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.EXTENSIONS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.SOURCES_OLD, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.SYNC_LOGS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COMMENTS_REACTIONS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.dropColumn('fk_workspace_id');
    },
  );
  await knex.schema.alterTable(MetaTable.CALENDAR_VIEW_RANGE, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_BARCODE, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_LOOKUP, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_QRCODE, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.COL_SELECT_OPTIONS, (table) => {
    table.dropColumn('fk_workspace_id');
  });
  await knex.schema.alterTable(MetaTable.MODEL_STAT, (table) => {
    table.dropColumn('base_id');
  });
};

export { up, down };
