import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { replaceLongBaseIds } from '~/meta/migrations/v2/nc_054_id_length';

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
*/

const log = (message: string) => {
  console.log(`nc_050_tenant_isolation: ${message}`);
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
    case 'mssql':
      await knex.raw(`
        UPDATE ${table}
        SET ${destinationColumn} = ${joinTable}.${sourceColumn}
        FROM ${table}
        JOIN ${joinTable}
        ON ${table}.${column} = ${joinTable}.${joinColumn}
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
    case 'mssql': {
      const indexes = await knex.raw(
        `
        SELECT
          i.name AS index_name
        FROM
          sys.indexes i
        JOIN
          sys.index_columns ic
        ON
          i.object_id = ic.object_id
          AND i.index_id = ic.index_id
        JOIN
          sys.columns c
        ON
          ic.object_id = c.object_id
          AND ic.column_id = c.column_id
        WHERE
          i.object_id = OBJECT_ID(?)
          AND c.name = ?
        `,
        [table, column],
      );

      return indexes.map((row: any) => row.index_name);
    }

    default:
      throw new Error(`Unsupported database: ${sourceType}`);
  }
};

const up = async (knex: Knex) => {
  log('Migration started');

  // Replace long base_ids before adding new columns to avoid value too long error
  await replaceLongBaseIds(knex);

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
  ];

  for (const table of migrateBaseId) {
    hrTime = process.hrtime();

    if (table === MetaTable.CALENDAR_VIEW_RANGE) {
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

  // Drop existing base_id indexes
  const dropBaseIdIndexes = [
    MetaTable.AUDIT,
    MetaTable.SOURCES,
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

      await knex.schema.alterTable(table, (table) => {
        table.dropIndex('base_id', index);
      });
    }
  }

  logExecutionTime('Dropped existing base_id indexes');

  // Recreate existing source_id indexes as name might clash with base_id (old name for source_id)
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
    MetaTable.SOURCES,
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

  log('Adding indexes');

  for (const tbl of addIndexes) {
    hrTime = process.hrtime();

    await knex.schema.alterTable(tbl, (table) => {
      table.index('base_id');
    });

    logExecutionTime(`Added indexes for ${tbl}`);
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
};

export { up, down };
