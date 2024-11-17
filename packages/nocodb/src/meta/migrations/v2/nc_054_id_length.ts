import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const log = (message: string) => {
  console.log(`nc_054_id_length: ${message}`);
};

let hrTime = process.hrtime();

const logExecutionTime = (message: string) => {
  const [seconds, nanoseconds] = process.hrtime(hrTime);
  const elapsedSeconds = seconds + nanoseconds / 1e9;
  log(`${message} in ${elapsedSeconds}s`);
};

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const generateUniqueBaseId = async (knex: Knex) => {
  const baseId = `p${nanoidv2()}`;

  const base = await knex(MetaTable.PROJECT).where('id', baseId).first();

  if (base) {
    return generateUniqueBaseId(knex);
  }

  return baseId;
};

const listBasesWithLongIds = async (knex: Knex) => {
  const sourceType = knex.client.driverName;

  switch (sourceType) {
    case 'pg': {
      const bases = await knex.raw(
        `SELECT id FROM ?? WHERE LENGTH(id) > 20`,
        MetaTable.PROJECT,
      );

      return bases.rows.map((row: any) => row.id);
    }
    case 'mysql':
    case 'mysql2': {
      const bases = await knex.raw(
        `SELECT id FROM ?? WHERE CHAR_LENGTH(id) > 20`,
        MetaTable.PROJECT,
      );

      return bases[0].map((row: any) => row.id);
    }
    case 'sqlite3': {
      const bases = await knex.raw(
        `SELECT id FROM ?? WHERE LENGTH(id) > 20`,
        MetaTable.PROJECT,
      );

      return bases.map((row: any) => row.id);
    }
    case 'mssql': {
      const bases = await knex.raw(
        `SELECT id FROM ?? WHERE LEN(id) > 20`,
        MetaTable.PROJECT,
      );

      return bases.map((row: any) => row.id);
    }

    default:
      throw new Error(`Unsupported database: ${sourceType}`);
  }
};

export const replaceLongBaseIds = async (knex: Knex) => {
  const basesWithLongIds = await listBasesWithLongIds(knex);

  for (const baseId of basesWithLongIds) {
    const newBaseId = await generateUniqueBaseId(knex);

    if (!baseId || !newBaseId) {
      throw new Error(`Failed to replace ${baseId} with ${newBaseId}`);
    }

    const tablesToChangeBaseId = [
      MetaTable.API_TOKENS,
      MetaTable.AUDIT,
      MetaTable.PROJECT_USERS,
      MetaTable.CALENDAR_VIEW_COLUMNS,
      MetaTable.CALENDAR_VIEW,
      MetaTable.COLUMNS,
      MetaTable.COMMENTS_REACTIONS,
      MetaTable.COMMENTS,
      MetaTable.MODEL_ROLE_VISIBILITY,
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
      MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
      MetaTable.VIEWS,
    ];

    for (const table of tablesToChangeBaseId) {
      await knex(table).where('base_id', baseId).update({ base_id: newBaseId });
    }

    await knex(MetaTable.PROJECT).where('id', baseId).update({ id: newBaseId });

    log(`Replaced ${baseId} with ${newBaseId} (because it was too long)`);
  }
};

const tablesToAlterBaseId = [
  MetaTable.API_TOKENS,
  MetaTable.AUDIT,
  MetaTable.PROJECT_USERS,
  MetaTable.COLUMNS,
  MetaTable.COMMENTS_REACTIONS,
  MetaTable.COMMENTS,
  MetaTable.MODEL_ROLE_VISIBILITY,
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
  MetaTable.MAP_VIEW,
  MetaTable.MAP_VIEW_COLUMNS,
  MetaTable.MODELS,
  MetaTable.SORT,
  MetaTable.SOURCES,
  MetaTable.SYNC_LOGS,
  MetaTable.SYNC_SOURCE,
  MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
  MetaTable.VIEWS,
];

const tablesToAlterSourceId = [
  MetaTable.CALENDAR_VIEW,
  MetaTable.CALENDAR_VIEW_COLUMNS,
];

const up = async (knex: Knex) => {
  hrTime = process.hrtime();

  await replaceLongBaseIds(knex);

  logExecutionTime('Replaced long base IDs');

  for (const table of tablesToAlterBaseId) {
    hrTime = process.hrtime();
    await knex.schema.alterTable(table, (tableQb) => {
      tableQb.string('base_id', 20).alter();
    });
    logExecutionTime(`Altered ${table}.base_id to 20 characters`);
  }

  for (const table of tablesToAlterSourceId) {
    hrTime = process.hrtime();
    await knex.schema.alterTable(table, (tableQb) => {
      tableQb.string('source_id', 20).alter();
    });
    logExecutionTime(`Altered ${table}.source_id to 20 characters`);
  }
};

const down = async (knex: Knex) => {
  for (const table of tablesToAlterBaseId) {
    await knex.schema.alterTable(table, (tableQb) => {
      tableQb.string('base_id', 128).alter();
    });
  }

  for (const table of tablesToAlterSourceId) {
    await knex.schema.alterTable(table, (tableQb) => {
      tableQb.string('source_id', 128).alter();
    });
  }
};

export { up, down };
