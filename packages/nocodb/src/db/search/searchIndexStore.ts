import { Logger } from '@nestjs/common';
import { isDeletedCol, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, Model } from '~/models';
import type { SearchIndexMeta } from '~/db/search/searchIndexMeta';
import type { FilterRawClause } from '~/models/Filter';
import { BaseUser } from '~/models';
import {
  fieldValueSql,
  isComputedField,
  MAX_CELL_CHARS,
} from '~/db/search/searchIndexFields';
import {
  execPgWithGuard,
  getQueryGuard,
  SEARCH_PLAN_MARK,
  searchPlanMinIds,
  searchWorkMemBytes,
  shouldGuardQuery,
} from '~/db/queryGuard';
import { searchEnvInt } from '~/db/search/searchEnv';
import { searchSchemaName } from '~/db/search/searchIndexSchema';

export {
  dropSearchSchema,
  searchSchemaName,
} from '~/db/search/searchIndexSchema';

const logger = new Logger('SearchIndex');

const REFRESH_BATCH = 1_000;
const BACKFILL_CHUNK = 2_000;

/** Format 1 kept every base's side tables in one shared schema. */
const LEGACY_SCHEMA = 'nc_search';

/** Every indexed table's values, one row per field and record. */
const LIVE_TABLE = 'cells';
/** Format 7 builds wrote here first, then swapped into the live table. */
const LEGACY_SHADOW_TABLES = ['cells_shadow', 'cells_shadow_dirty'];
/** Format 5 kept one text document per record. */
const LEGACY_TABLES = [
  'records',
  'records_dirty',
  'records_shadow',
  'records_shadow_dirty',
];

const ident = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

/** One table's documents in a base's side table. */
export interface SearchTarget {
  /** `schema.table` */
  path: string;
  modelId: string;
}

/** The documents serving `model`. */
export function searchLiveTarget(
  model: Pick<Model, 'id' | 'base_id'>,
): SearchTarget {
  return {
    path: `${searchSchemaName(model.base_id)}.${LIVE_TABLE}`,
    modelId: model.id,
  };
}

/**
 * The dirty marks next to the side table at `path`: rows written but not
 * re-indexed yet. Apart from the documents, so a mark costs no GIN entry.
 */
export function searchMarksPath(path: string) {
  return `${path}_dirty`;
}

/** The row version each record was last fully indexed at, by its stamp. */
export function searchSeenPath(path: string) {
  return `${path}_seen`;
}

/** A row's stamp, `COALESCE(updated, created)` on `alias`; undefined without either. */
export function rowStampSql(knex: Knex, model: Model, alias?: string) {
  const col = (uidt: UITypes) =>
    model.columns?.find((c) => c.uidt === uidt && c.system && c.column_name)
      ?.column_name;
  const cols = [col(UITypes.LastModifiedTime), col(UITypes.CreatedTime)]
    .filter(Boolean)
    .map((c) => (alias ? `${alias}.${c}` : c) as string);
  if (!cols.length) return undefined;
  return knex.raw(`COALESCE(${cols.map(() => '??').join(', ')})`, cols);
}

/** `alias.fk_model_id = ?`, with its binding. */
function scopeWhere(target: SearchTarget, alias?: string) {
  return {
    sql: `${alias ? `${alias}.` : ''}fk_model_id = ?`,
    bindings: [target.modelId],
  };
}

/**
 * Serialises the writes of one table's documents, across instances. The
 * trailing `:` keeps the key of builds that had a shadow.
 */
export const searchTargetLockKey = (target: SearchTarget) =>
  `nc_search:${target.path}:${target.modelId}:`;

/** `shared`: for chunks of one first build, which write disjoint rows. */
async function lockTarget(
  trx: Knex,
  target: SearchTarget,
  { shared = false }: { shared?: boolean } = {},
) {
  await trx.raw(
    `SELECT ${
      shared ? 'pg_advisory_xact_lock_shared' : 'pg_advisory_xact_lock'
    }(hashtext(?))`,
    [searchTargetLockKey(target)],
  );
}

export function rowIdTypeFor(model: Model): SearchIndexMeta['row_id_type'] {
  return /int|serial/i.test(`${model.primaryKey?.dt ?? ''}`)
    ? 'bigint'
    : 'text';
}

const SEARCH_EXTENSIONS = ['pg_trgm', 'btree_gin'] as const;
type SearchExtension = (typeof SEARCH_EXTENSIONS)[number];

const EXTENSIONS_MISSING =
  'A search index needs the pg_trgm and btree_gin extensions, which this database lacks';
const EXTENSIONS_DENIED =
  'A search index needs the pg_trgm and btree_gin extensions, which this database user may not install';
// insufficient_privilege, feature_not_supported (e.g. not allow-listed)
const EXTENSION_DENIED_CODES = new Set(['42501', '0A000']);

/** How long a refused CREATE EXTENSION keeps background checks from retrying. */
const EXTENSION_DENIED_TTL_MS = 10 * 60_000;
/** When CREATE EXTENSION was last refused on this connection. */
const extensionDenied = new WeakMap<Knex, number>();

const installedExtensionSchemas = async (knex: Knex) => {
  const result = await knex.raw(
    `SELECT e.extname AS name, n.nspname AS schema FROM pg_extension e
     JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = ANY(?)`,
    [[...SEARCH_EXTENSIONS]],
  );
  const schemas: Partial<Record<SearchExtension, string>> = {};
  for (const row of result?.rows ?? []) schemas[row.name] = row.schema;
  return schemas;
};

const allInstalled = (
  schemas: Partial<Record<SearchExtension, string>>,
): schemas is Record<SearchExtension, string> =>
  SEARCH_EXTENSIONS.every((name) => schemas[name]);

// unique_violation, duplicate_schema, duplicate_table, duplicate_object
const CATALOG_RACE_CODES = new Set(['23505', '42P06', '42P07', '42710']);

/**
 * Runs `fn` again once when it loses a create race. An advisory lock doesn't
 * refresh a transaction's catalog cache, so a check after the lock can miss
 * what the lock holder just committed; a new transaction sees it.
 */
async function retryCatalogRace<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!CATALOG_RACE_CODES.has(`${(e as { code?: string })?.code ?? ''}`)) {
      throw e;
    }
    return fn();
  }
}

/**
 * Schemas holding pg_trgm and btree_gin, installing them when missing;
 * throws when it can't.
 */
export async function searchExtensionSchemas(
  knex: Knex,
): Promise<Record<SearchExtension, string>> {
  const found = await installedExtensionSchemas(knex);
  if (allInstalled(found)) return found;
  return retryCatalogRace(() =>
    knex.transaction(async (trx) => {
      // Two first builds would otherwise race on pg_extension's unique index.
      await trx.raw(`SELECT pg_advisory_xact_lock(hashtext('nc_pg_trgm'))`);
      const existing = await installedExtensionSchemas(trx);
      if (allInstalled(existing)) return existing;
      const publicWritable = (
        await trx.raw(
          `SELECT EXISTS (SELECT 1 FROM pg_namespace
                        WHERE nspname = 'public'
                          AND has_schema_privilege(oid, 'CREATE')) AS ok`,
        )
      )?.rows?.[0]?.ok;
      // Trusted since PostgreSQL 13: CREATE on the database is enough.
      for (const name of SEARCH_EXTENSIONS) {
        if (existing[name]) continue;
        await trx.raw(
          publicWritable
            ? `CREATE EXTENSION IF NOT EXISTS ?? WITH SCHEMA public`
            : `CREATE EXTENSION IF NOT EXISTS ??`,
          [name],
        );
      }
      const created = await installedExtensionSchemas(trx);
      if (!allInstalled(created)) {
        throw new Error('pg_trgm or btree_gin is not installed');
      }
      return created;
    }),
  );
}

/**
 * Install the extensions before a build claims the table; resolves to why
 * they can't be, and holds off background checks from retrying a refusal for
 * a while.
 */
export async function installSearchExtensions(knex: Knex) {
  try {
    await searchExtensionSchemas(knex);
    extensionDenied.delete(knex);
    return undefined;
  } catch (e) {
    if (!EXTENSION_DENIED_CODES.has((e as { code?: string })?.code)) throw e;
    logger.warn(`Search index extension install refused: ${shortError(e)}`);
    extensionDenied.set(knex, Date.now());
    return EXTENSIONS_DENIED;
  }
}

/**
 * Why the extensions can't be used here, or undefined when they can (or
 * may). With `retry`, a recent refused install doesn't count: the rights may
 * have changed.
 */
export async function searchExtensionBlocker(
  knex: Knex,
  { retry = false }: { retry?: boolean } = {},
) {
  const names = [...SEARCH_EXTENSIONS];
  const n = names.length;
  const state = (
    await knex.raw(
      `SELECT
         (SELECT count(*) FROM pg_extension
          WHERE extname = ANY(?)) = ${n} AS installed,
         (SELECT count(*) FROM pg_available_extensions
          WHERE name = ANY(?)) = ${n} AS available,
         COALESCE((SELECT rolsuper FROM pg_roles
                   WHERE rolname = current_user), false) AS superuser,
         has_database_privilege(current_database(), 'CREATE') AS can_create,
         -- through jsonb: the trusted column only exists from PostgreSQL 13
         (SELECT count(DISTINCT v.name) FROM pg_available_extension_versions v
          WHERE v.name = ANY(?)
            AND (to_jsonb(v) ->> 'trusted')::boolean) = ${n} AS trusted`,
      [names, names, names],
    )
  )?.rows?.[0];
  if (state?.installed) return undefined;
  if (!state?.available) return EXTENSIONS_MISSING;
  if (!state.superuser && !(state.trusted && state.can_create)) {
    return EXTENSIONS_DENIED;
  }
  const deniedAt = extensionDenied.get(knex);
  return !retry && Date.now() - (deniedAt ?? 0) < EXTENSION_DENIED_TTL_MS
    ? EXTENSIONS_DENIED
    : undefined;
}

/**
 * The base's side tables, created once: the live documents with their
 * trigram index, the shadow a build writes, and the marks of each. The
 * extensions must be installed.
 */
const CELL_COLUMNS_DDL = `
  fk_model_id  text NOT NULL,
  row_id       text NOT NULL,
  fk_column_id text NOT NULL,
  txt          text,
  num          numeric,
  day          date,
  ts           timestamptz,
  refs         text[],
  partial      boolean NOT NULL DEFAULT false`;

const CELL_KEY = '(fk_model_id, row_id, fk_column_id)';

/**
 * The cell indexes of `table` (`schema.name`), named `<name>_<kind>`: on the
 * partitioned `cells`, and alike on each partition, which ATTACH adopts.
 */
function cellIndexes(
  table: string,
  ext: { pg_trgm: string; btree_gin: string },
): Array<[string, unknown[]]> {
  const name = table.split('.').pop();
  // The table, the fields and the term in one index scan.
  const indexes: Array<[string, unknown[]]> = [
    [
      `CREATE INDEX IF NOT EXISTS ?? ON ?? USING gin (
         fk_model_id ??.text_ops, fk_column_id ??.text_ops, txt ??.gin_trgm_ops
       ) WHERE txt IS NOT NULL`,
      [`${name}_trgm`, table, ext.btree_gin, ext.btree_gin, ext.pg_trgm],
    ],
  ];
  for (const value of ['num', 'day', 'ts']) {
    indexes.push([
      `CREATE INDEX IF NOT EXISTS ?? ON ?? (fk_model_id, fk_column_id, ??)
       WHERE ?? IS NOT NULL`,
      [`${name}_${value}`, table, value, value],
    ]);
  }
  // Cells naming a user, to re-index them when the user's name changes.
  indexes.push([
    `CREATE INDEX IF NOT EXISTS ?? ON ?? USING gin (refs) WHERE refs IS NOT NULL`,
    [`${name}_refs`, table],
  ]);
  // Cut-off cells are always matched live.
  indexes.push([
    `CREATE INDEX IF NOT EXISTS ?? ON ?? (fk_model_id, row_id) WHERE partial`,
    [`${name}_partial`, table],
  ]);
  return indexes;
}

export async function ensureSearchTables(knex: Knex, baseId: string) {
  const schema = searchSchemaName(baseId);
  const live = `${schema}.${LIVE_TABLE}`;
  const legacyShadows = LEGACY_SHADOW_TABLES.map((t) => `${schema}.${t}`);
  const ready = async (db: Knex) =>
    (
      await db.raw(
        `SELECT (SELECT relkind FROM pg_class WHERE oid = to_regclass(?)) = 'p'
            AND to_regclass(?) IS NOT NULL
            AND EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = to_regclass(?) AND attname = 'fields'
                AND NOT attisdropped)
            AND to_regclass(?) IS NOT NULL
            AND to_regclass(?) IS NULL AND to_regclass(?) IS NULL AS ok`,
        [
          live,
          `${schema}.${LIVE_TABLE}_trgm`,
          searchMarksPath(live),
          searchSeenPath(live),
          ...legacyShadows,
        ],
      )
    )?.rows?.[0]?.ok;
  if (await ready(knex)) return;
  const ext = await searchExtensionSchemas(knex);
  await retryCatalogRace(() =>
    knex.transaction(async (trx) => {
      await trx.raw(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
        `nc_search_tables:${schema}`,
      ]);
      if (await ready(trx)) return;
      await trx.raw(`CREATE SCHEMA IF NOT EXISTS ??`, [schema]);
      // Format 7 kept every table's cells in one plain table.
      const kind = (
        await trx.raw(
          `SELECT relkind FROM pg_class WHERE oid = to_regclass(?)`,
          [live],
        )
      )?.rows?.[0]?.relkind;
      if (kind && kind !== 'p') {
        await trx.raw(`DROP TABLE ??`, [live]);
      }
      // A partition per table: a first build writes and indexes its own
      // table, then attaches it, and one table's cells never weigh on
      // another's probes.
      await trx.raw(
        `CREATE TABLE IF NOT EXISTS ?? (${CELL_COLUMNS_DDL},
           CONSTRAINT ?? PRIMARY KEY ${CELL_KEY}
         ) PARTITION BY LIST (fk_model_id)`,
        [live, `${LIVE_TABLE}_pk`],
      );
      for (const [sql, bindings] of cellIndexes(live, ext)) {
        await trx.raw(sql, bindings);
      }
      await trx.raw(
        `CREATE TABLE IF NOT EXISTS ?? (
        fk_model_id text NOT NULL,
        row_id      text NOT NULL,
        CONSTRAINT ?? PRIMARY KEY (fk_model_id, row_id)
      )`,
        [searchMarksPath(live), `${LIVE_TABLE}_dirty_pk`],
      );
      // Marks are the flush queue: `propagate` = walk the row to the indexes
      // reading it; `marked_at` lets a flush clear only marks it has read;
      // `fields` = only these fields are owed (NULL = every field).
      // A constant default first: a volatile one would rewrite the table.
      await trx.raw(
        `ALTER TABLE ??
           ADD COLUMN IF NOT EXISTS propagate boolean NOT NULL DEFAULT false,
           ADD COLUMN IF NOT EXISTS marked_at timestamptz NOT NULL
             DEFAULT '-infinity',
           ADD COLUMN IF NOT EXISTS fields text[]`,
        [searchMarksPath(live)],
      );
      await trx.raw(
        `ALTER TABLE ?? ALTER COLUMN marked_at SET DEFAULT clock_timestamp()`,
        [searchMarksPath(live)],
      );
      await trx.raw(
        `CREATE TABLE IF NOT EXISTS ?? (
        fk_model_id text NOT NULL,
        row_id      text NOT NULL,
        stamp       timestamptz,
        CONSTRAINT ?? PRIMARY KEY (fk_model_id, row_id)
      )`,
        [searchSeenPath(live), `${LIVE_TABLE}_seen_pk`],
      );
      // Builds write the live cells now: nothing reads the shadow tables.
      for (const table of [...LEGACY_TABLES, ...LEGACY_SHADOW_TABLES]) {
        await trx.raw(`DROP TABLE IF EXISTS ??`, [`${schema}.${table}`]);
      }
    }),
  );
}

/** A model id as a literal for DDL, which takes no bound values. */
function modelLiteral(knex: Knex, modelId: string) {
  if (!/^[A-Za-z0-9_]+$/.test(modelId)) {
    throw new Error(`Unexpected table id ${modelId}`);
  }
  return knex.raw('?', [modelId]).toQuery();
}

/**
 * The table a first build writes, by build id: attached as the model's
 * partition of `cells` once indexed.
 */
export function searchBuildTarget(
  model: Pick<Model, 'id' | 'base_id'>,
  buildId: string,
): SearchTarget {
  const tag = buildId
    .replace(/[^a-f0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase();
  return {
    path: `${searchSchemaName(model.base_id)}.c_${ident(
      model.id,
    ).toLowerCase()}_${tag}`,
    modelId: model.id,
  };
}

/** Partitions and build tables of `model`, attached or not. */
async function partitionTables(
  knex: Knex,
  model: Pick<Model, 'id' | 'base_id'>,
): Promise<Array<{ path: string; attached: boolean; pending: boolean }>> {
  const schema = searchSchemaName(model.base_id);
  const pending = (await serverVersion(knex)) >= 140000;
  const { rows } = await knex.raw(
    `SELECT c.relname, i.inhrelid IS NOT NULL AS attached,
            ${
              pending ? 'COALESCE(i.inhdetachpending, false)' : 'false'
            } AS pending
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_inherits i ON i.inhrelid = c.oid
     WHERE n.nspname = ? AND c.relkind = 'r' AND c.relname ~ ?`,
    [schema, `^c_${ident(model.id).toLowerCase()}_[0-9a-f]{8}$`],
  );
  return (rows ?? []).map(
    (r: { relname: string; attached: boolean; pending: boolean }) => ({
      path: `${schema}.${r.relname}`,
      attached: r.attached,
      pending: r.pending,
    }),
  );
}

const serverVersions = new WeakMap<Knex, Promise<number>>();
function serverVersion(knex: Knex) {
  let version = serverVersions.get(knex);
  if (!version) {
    version = knex
      .raw(`SELECT current_setting('server_version_num')::int AS v`)
      .then((r) => Number(r?.rows?.[0]?.v ?? 0));
    serverVersions.set(knex, version);
  }
  return version;
}

/** The partition serving `model`'s cells, if one is attached. */
export async function searchPartitionOf(
  knex: Knex,
  model: Pick<Model, 'id' | 'base_id'>,
) {
  return (await partitionTables(knex, model)).find(
    (t) => t.attached && !t.pending,
  )?.path;
}

/** A plain table for a first build's cells: no index until it is done. */
export async function createSearchBuildTable(knex: Knex, target: SearchTarget) {
  const name = target.path.split('.').pop();
  await knex.raw(
    `CREATE TABLE ?? (${CELL_COLUMNS_DDL},
       CONSTRAINT ?? CHECK (fk_model_id = ${modelLiteral(
         knex,
         target.modelId,
       )}))`,
    [target.path, `${name}_model`],
  );
}

/**
 * Index a first build's table and attach it as its model's partition, which
 * must have none. ATTACH adopts the indexes, and the CHECK spares it a scan.
 */
export async function attachSearchBuildTable(
  knex: Knex,
  target: SearchTarget,
  beforeAttach?: () => Promise<void>,
) {
  const name = target.path.split('.').pop();
  const ext = await searchExtensionSchemas(knex);
  const pk = `${target.path.split('.')[0]}.${name}_pk`;
  if (!(await searchTableExists(knex, pk))) {
    await knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? PRIMARY KEY ${CELL_KEY}`, [
      target.path,
      `${name}_pk`,
    ]);
  }
  for (const [sql, bindings] of cellIndexes(target.path, ext)) {
    await knex.raw(sql, bindings);
  }
  // Without statistics the planner reads the cells as few and scans.
  await knex.raw(`ANALYZE ??`, [target.path]);
  const live = `${target.path.split('.')[0]}.${LIVE_TABLE}`;
  const pending =
    (await serverVersion(knex)) >= 140000 ? 'inhdetachpending' : 'false';
  await knex.transaction(async (trx) => {
    await lockTarget(trx, { path: live, modelId: target.modelId });
    await beforeAttach?.();
    const [link] = (
      await trx.raw(
        `SELECT ${pending} AS pending FROM pg_inherits
         WHERE inhrelid = to_regclass(?)`,
        [target.path],
      )
    ).rows;
    if (link?.pending) throw new Error('Search partition is being detached');
    // A build that died right after attaching.
    if (link) return;
    await trx.raw(
      `ALTER TABLE ?? ATTACH PARTITION ?? FOR VALUES IN (${modelLiteral(
        trx,
        target.modelId,
      )})`,
      [live, target.path],
    );
  });
}

/**
 * Drop `model`'s partition and build tables, but `except`: an attached one is
 * detached first, concurrently where Postgres allows, so the base's other
 * tables keep being searched and written meanwhile.
 */
export async function dropSearchPartitions(
  knex: Knex,
  model: Pick<Model, 'id' | 'base_id'>,
  {
    except,
    only,
    waitMs,
  }: { except?: string; only?: string; waitMs?: number } = {},
): Promise<boolean> {
  const live = `${searchSchemaName(model.base_id)}.${LIVE_TABLE}`;
  if (!(await searchTableExists(knex, live))) return true;
  const concurrently = (await serverVersion(knex)) >= 140000;
  for (const table of await partitionTables(knex, model)) {
    if (table.path === except || (only && table.path !== only)) continue;
    if (table.pending) {
      await knex.raw(`ALTER TABLE ?? DETACH PARTITION ?? FINALIZE`, [
        live,
        table.path,
      ]);
    } else if (table.attached) {
      // Cells gone at once, under a lock on this partition alone.
      const truncated = await knex
        .transaction(async (trx) => {
          if (waitMs !== undefined) {
            await trx.raw(`SET LOCAL lock_timeout = ${Math.max(1, waitMs)}`);
          }
          await trx.raw(`TRUNCATE ??`, [table.path]);
          return true;
        })
        .catch((e) => {
          if ((e as { code?: string })?.code === '55P03') return false;
          throw e;
        });
      if (!truncated) return false;
      await knex.raw(
        `ALTER TABLE ?? DETACH PARTITION ??${
          concurrently ? ' CONCURRENTLY' : ''
        }`,
        [live, table.path],
      );
    }
    await knex.raw(`DROP TABLE IF EXISTS ??`, [table.path]);
  }
  return true;
}

/**
 * Drop a first build's own table. With `waitMs`, not while a writer may still
 * hold it (its lock, or the table past `waitMs`): resolves false then. One
 * attached already is detached first.
 */
export async function dropSearchBuildTable(
  knex: Knex,
  model: Pick<Model, 'id' | 'base_id'>,
  target: SearchTarget,
  { waitMs }: { waitMs?: number } = {},
) {
  const table = (await partitionTables(knex, model)).find(
    (t) => t.path === target.path,
  );
  if (!table) return true;
  if (table.attached) {
    return dropSearchPartitions(knex, model, { only: target.path, waitMs });
  }
  return knex
    .transaction(async (trx) => {
      if (waitMs !== undefined) {
        const free = (
          await trx.raw(`SELECT pg_try_advisory_xact_lock(hashtext(?)) AS ok`, [
            searchTargetLockKey(target),
          ])
        )?.rows?.[0]?.ok;
        if (!free) return false;
        await trx.raw(`SET LOCAL lock_timeout = ${Math.max(1, waitMs)}`);
      }
      await trx.raw(`DROP TABLE IF EXISTS ??`, [target.path]);
      return true;
    })
    .catch((e) => {
      if ((e as { code?: string })?.code === '55P03') return false;
      throw e;
    });
}

/**
 * Before a stopped first build goes on: the cells of rows past `after`, which
 * it may have written part of.
 */
export async function deleteSearchCellsPast(
  baseModel: IBaseModelSqlV2,
  target: SearchTarget,
  after: string | number,
) {
  const pk = baseModel.model.primaryKey;
  const knex = baseModel.dbDriver;
  // Exclusive: waits out a chunk the stopped build still has in flight.
  await knex.transaction(async (trx) => {
    await lockTarget(trx, target);
    await trx.raw(
      `DELETE FROM ?? AS c USING (SELECT ??::text AS row_id FROM ? WHERE ?? > ?) AS r
       WHERE c.row_id = r.row_id`,
      [
        target.path,
        pk.column_name,
        tableRef(knex, baseModel.tnPath),
        pk.column_name,
        after,
      ],
    );
  });
}

// query_canceled (a statement timeout)
export const isStatementTimeout = (e: unknown) =>
  (e as { code?: string })?.code === '57014';

export async function searchTableExists(knex: Knex, path: string) {
  const result = await knex.raw(`SELECT to_regclass(?) IS NOT NULL AS ok`, [
    path,
  ]);
  return !!result?.rows?.[0]?.ok;
}

export interface ClearTargetOptions {
  /**
   * Delete the target's marks too (default). `own`: only those for this
   * index; marks still owed to the indexes reading the rows stay.
   */
  marks?: boolean | 'own';
  /** false: only the marks. */
  cells?: boolean;
  /** false: give up (resolving false) when a writer of the target holds it. */
  wait?: boolean;
  /**
   * Checked once the target is locked: true keeps the rows. A build writes
   * under the same lock, so this sees any build that could have.
   */
  keepIf?: () => Promise<boolean>;
}

/** Delete `target`'s documents and marks. Resolves to whether it did. */
export async function clearSearchTarget(
  knex: Knex,
  target: SearchTarget,
  { wait = true, keepIf, marks = true, cells = true }: ClearTargetOptions = {},
) {
  if (!(await searchTableExists(knex, searchMarksPath(target.path)))) {
    return true;
  }
  return knex.transaction(async (trx) => {
    if (wait) {
      await lockTarget(trx, target);
    } else {
      const got = (
        await trx.raw(`SELECT pg_try_advisory_xact_lock(hashtext(?)) AS ok`, [
          searchTargetLockKey(target),
        ])
      )?.rows?.[0]?.ok;
      if (!got) return false;
    }
    if (await keepIf?.()) return false;
    const scope = scopeWhere(target);
    if (cells) {
      await trx.raw(`DELETE FROM ?? WHERE ${scope.sql}`, [
        target.path,
        ...scope.bindings,
      ]);
    }
    if (marks) {
      await trx.raw(
        `DELETE FROM ?? WHERE ${scope.sql}${
          marks === 'own' ? ' AND NOT propagate' : ''
        }`,
        [searchMarksPath(target.path), ...scope.bindings],
      );
    }
    await trx.raw(`DELETE FROM ?? WHERE ${scope.sql}`, [
      searchSeenPath(target.path),
      ...scope.bindings,
    ]);
    return true;
  });
}

/** Delete the cells of fields the index no longer holds. */
export async function deleteSearchFieldCells(
  knex: Knex,
  target: SearchTarget,
  columnIds: string[],
) {
  if (!columnIds.length || !(await searchTableExists(knex, target.path))) {
    return;
  }
  await knex.transaction(async (trx) => {
    await lockTarget(trx, target);
    const scope = scopeWhere(target);
    await trx.raw(
      `DELETE FROM ?? WHERE ${scope.sql} AND fk_column_id = ANY(?::text[])`,
      [target.path, ...scope.bindings, columnIds],
    );
  });
}

/**
 * After a rebuild rewrote many of `model`'s cells: fresh statistics and a
 * merged pending list on its partition.
 */
export async function settleSearchTable(
  knex: Knex,
  model: Pick<Model, 'id' | 'base_id'>,
) {
  const partition = await searchPartitionOf(knex, model).catch(() => undefined);
  if (!partition) return;
  await knex.raw(`ANALYZE ??`, [partition]).catch((e) => {
    logger.warn(`Search table analyze failed: ${shortError(e)}`);
  });
  // A probe reads the pending list entry by entry: merge the rebuild's now.
  await knex
    .raw(`SELECT gin_clean_pending_list(to_regclass(?))`, [`${partition}_trgm`])
    .catch((e) => {
      logger.warn(`Search pending list merge failed: ${shortError(e)}`);
    });
}

/** Side tables of `model` from before they were shared per base. */
export async function dropLegacySearchTables(knex: Knex, model: Model) {
  const schema = searchSchemaName(model.base_id);
  const table = `t_${ident(model.id)}`;
  const result = await knex.raw(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = ? AND (tablename = ? OR tablename LIKE ?)`,
    [schema, table, `${table.replace(/_/g, '\\_')}\\_%`],
  );
  for (const row of result?.rows ?? []) {
    await knex.raw(`DROP TABLE IF EXISTS ??`, [`${schema}.${row.tablename}`]);
  }
  await knex.raw(`DROP TABLE IF EXISTS ??`, [`${LEGACY_SCHEMA}.${table}`]);
}

/** Every cell and mark of a deleted `model`, of older formats too. */
export async function dropSearchTables(knex: Knex, model: Model) {
  await clearSearchTarget(knex, searchLiveTarget(model), { cells: false });
  await dropSearchPartitions(knex, model);
  await dropLegacySearchTables(knex, model);
}

/** A write for a table whose partition is gone. */
export const isMissingPartition = (e: unknown) =>
  (e as { code?: string })?.code === '23514' &&
  /no partition of relation/.test(`${(e as Error)?.message ?? ''}`);

function tableRef(knex: Knex, tnPath: string | Knex.Raw) {
  return typeof tnPath === 'string' ? knex.raw('??', [tnPath]) : tnPath;
}

/** A base user as cells name them: display name and email. */
export interface CellUser {
  id: string;
  label: string;
}

/** The base's users for user cells: display name and email, one per line. */
export async function cellUsers(
  baseModel: IBaseModelSqlV2,
): Promise<CellUser[]> {
  const users = await BaseUser.getUsersList(baseModel.context, {
    base_id: baseModel.model.base_id,
    include_internal_user: true,
  });
  return (users ?? []).map((u) => ({
    id: `${u.id}`,
    label: [u.display_name, u.email].filter(Boolean).join('\n'),
  }));
}

/** A cell's VALUES row, typed as the cells table stores it. */
const CELL_ROW_SQL =
  '(?::text, (?)::text, (?)::numeric, (?)::date, (?)::timestamptz, (?)::text[])';
const CELL_ROW_COLUMNS = 'fk_column_id, txt, num, day, ts, refs';
/** The users user cells name, bound as {@link cellUsers} JSON. */
const CELL_USERS_SQL =
  'SELECT * FROM jsonb_to_recordset(?::jsonb) AS u(id text, label text)';
const CELL_USERS_CTE = `nc_cell_users AS (${CELL_USERS_SQL})`;

/** One field's VALUES row: its id, then txt, num, day, ts and refs. */
interface CellEntry {
  columnId: string;
  values: Knex.Raw[];
  users: boolean;
  /** Computed per row by an expression that can fail on some rows' data. */
  computed: boolean;
}

/** The entries of `fields`; a field whose expression won't build is left out. */
async function cellEntries(
  baseModel: IBaseModelSqlV2,
  fields: Column[],
): Promise<CellEntry[]> {
  const entries: CellEntry[] = [];
  for (const column of fields) {
    try {
      const row = await cellRow(baseModel, column);
      if (row) {
        entries.push({
          columnId: column.id,
          ...row,
          computed: isComputedField(column),
        });
      }
    } catch (e) {
      logSearchIndexWarning(
        `Search index skips field ${column.id} of ${
          baseModel.model.id
        }: ${shortError(e)}`,
      );
    }
  }
  return entries;
}

async function cellRow(
  baseModel: IBaseModelSqlV2,
  column: Column,
): Promise<{ values: Knex.Raw[]; users: boolean } | undefined> {
  const knex = baseModel.dbDriver;
  const value = await fieldValueSql(baseModel, column);
  if (!value) return undefined;
  const none = knex.raw('NULL');
  if (value.userIds) {
    const ids = `(${value.userIds.toQuery().replace(/\?/g, '\\?')})`;
    // In the order the cell lists them; ids of users no longer in the base
    // still name the cell, so a rename back finds it.
    const listed = `unnest(string_to_array(${ids}, ',')) WITH ORDINALITY AS x(id, ord)`;
    const values = [
      knex.raw('?', [column.id]),
      knex.raw(
        `(SELECT string_agg(u.label, E'\\n' ORDER BY x.ord)
          FROM ${listed} JOIN nc_cell_users AS u ON u.id = btrim(x.id))`,
      ),
      none,
      none,
      none,
      knex.raw(
        `(SELECT array_agg(btrim(x.id) ORDER BY x.ord) FROM ${listed}
          WHERE btrim(x.id) <> '')`,
      ),
    ];
    return { values, users: true };
  }
  return {
    values: [
      knex.raw('?', [column.id]),
      value.txt ?? none,
      value.num ?? none,
      value.day ?? none,
      value.ts ?? none,
      none,
    ],
    users: false,
  };
}

/** Value columns of a cell, in insert order. */
const CELL_VALUES = 'txt, num, day, ts, refs, partial';
const valuesDiffer = (a: string, b: string) =>
  CELL_VALUES.split(', ')
    .map((c) => `${a}.${c} IS DISTINCT FROM ${b}.${c}`)
    .join(' OR ');
const valueUpdates = CELL_VALUES.split(', ')
  .map((c) => `${c} = EXCLUDED.${c}`)
  .join(', ');

// data_exception class, and type errors an expression only hits on some data.
const FIELD_DATA_ERROR_CODES = new Set(['42804', '42846', '42883']);
const isFieldDataError = (e: unknown) => {
  const code = `${(e as { code?: string })?.code ?? ''}`;
  return code.startsWith('22') || FIELD_DATA_ERROR_CODES.has(code);
};

/**
 * Re-derive the cells of `ids` from the user table in one statement. When a
 * computed field fails on these rows' data, the stored fields are written
 * together and each computed field alone: only the failing one is skipped.
 */
async function refreshRows(
  baseModel: IBaseModelSqlV2,
  target: SearchTarget,
  entries: CellEntry[],
  ids: Array<string | number>,
  keepDirty: boolean,
  users: () => Promise<CellUser[]>,
  onlyEntries = false,
  firstBuild = false,
  noSeen = false,
) {
  try {
    await refreshEntries(
      baseModel,
      target,
      entries,
      ids,
      keepDirty,
      users,
      onlyEntries,
      firstBuild,
      noSeen,
    );
    return;
  } catch (e) {
    if (!isFieldDataError(e) || !entries.some((c) => c.computed)) throw e;
  }
  // Unmarked once every part is written, not by the first.
  const startedAt = keepDirty ? undefined : await dbNow(baseModel.dbDriver);
  const scoped = (part: CellEntry[]) =>
    refreshEntries(baseModel, target, part, ids, true, users, true);
  const stored = entries.filter((c) => !c.computed);
  if (stored.length) await scoped(stored);
  for (const entry of entries.filter((c) => c.computed)) {
    try {
      await scoped([entry]);
    } catch (e) {
      if (!isFieldDataError(e)) throw e;
      logSearchIndexWarning(
        `Search index skips field ${entry.columnId} of ${
          baseModel.model.id
        } for ${ids.length} rows: ${shortError(e)}`,
      );
    }
  }
  if (startedAt) {
    await unmarkRows(
      baseModel.dbDriver,
      target,
      ids.map((id) => ({ row_id: `${id}`, marked_at: startedAt })),
      onlyEntries ? entries.map((e) => e.columnId) : undefined,
    );
  }
}

/**
 * Write the cells of `entries` for `ids` in one statement: empty values and
 * deleted rows are removed, unchanged ones are not rewritten, and their
 * marks are cleared unless `keepDirty`. `scoped` removes only these fields'
 * cells; otherwise a field not in `entries` loses its cells of these rows.
 * `firstBuild` only inserts: see {@link IndexRowsOptions.firstBuild}.
 */
async function refreshEntries(
  baseModel: IBaseModelSqlV2,
  target: SearchTarget,
  entries: CellEntry[],
  ids: Array<string | number>,
  keepDirty: boolean,
  users: () => Promise<CellUser[]>,
  scoped = false,
  firstBuild = false,
  noSeen = false,
) {
  const pk = baseModel.model.primaryKey;
  if (!pk || !ids.length || !entries.length) return;
  const knex = baseModel.dbDriver;

  const rows = entries.map((e) => e.values);
  const hasUsers = entries.some((e) => e.users);
  const fieldIds = entries.map((e) => e.columnId);

  const idTexts = ids.map((id) => `${id}`);
  const iScope = scopeWhere(target, 'i');
  const dScope = scopeWhere(target, 'd');
  // A mark set after this transaction began may be for a write this read
  // doesn't see: it stays for the next flush.
  // A scoped refresh clears only marks owing no other field.
  const unmark = keepDirty
    ? ''
    : `unmarked AS (
         DELETE FROM ?? AS d WHERE ${dScope.sql} AND d.row_id = ANY(?::text[])
           AND d.marked_at < now()${scoped ? ' AND d.fields <@ ?::text[]' : ''}
       ),`;
  const usersCte = hasUsers ? `${CELL_USERS_CTE},` : '';
  // A full-row refresh records the version it read: the reconcile's catch-up
  // then skips the row until it is written again.
  const stamp =
    !scoped &&
    !firstBuild &&
    !noSeen &&
    rowStampSql(knex, baseModel.model, 't');
  const seen = stamp
    ? `seen AS (
         INSERT INTO ?? AS s (fk_model_id, row_id, stamp)
         SELECT ?::text, t.??::text, ? FROM ? AS t WHERE t.?? = ANY(?)
         ON CONFLICT (fk_model_id, row_id) DO UPDATE SET stamp = EXCLUDED.stamp
           WHERE s.stamp IS DISTINCT FROM EXCLUDED.stamp
       ),
       seen_gone AS (
         DELETE FROM ?? AS s WHERE s.fk_model_id = ? AND s.row_id = ANY(?::text[])
           AND s.row_id <> ALL (SELECT t.??::text FROM ? AS t WHERE t.?? = ANY(?))
       ),`
    : '';

  const usersJson = hasUsers ? JSON.stringify(await users()) : undefined;
  // A row in the trash has no cells: they'd only fill probes until a purge.
  const deleted = baseModel.model.columns?.find((c) => isDeletedCol(c));
  const liveCtes = `WITH ${usersCte}
       src AS (
         SELECT t.??::text AS row_id, v.*
         FROM ? AS t
         CROSS JOIN LATERAL (VALUES ${rows
           .map(() => CELL_ROW_SQL)
           .join(', ')}) AS v(${CELL_ROW_COLUMNS})
         WHERE t.?? = ANY(?)${deleted ? ' AND t.?? IS NOT TRUE' : ''}
       ),
       live AS (
         SELECT row_id, fk_column_id,
           left(txt, ${MAX_CELL_CHARS}) AS txt, num, day, ts, refs,
           COALESCE(length(txt) > ${MAX_CELL_CHARS}, false) AS partial
         FROM src
         WHERE txt <> '' OR num IS NOT NULL OR day IS NOT NULL
            OR ts IS NOT NULL
       )`;
  const liveBindings = [
    ...(usersJson ? [usersJson] : []),
    pk.column_name,
    tableRef(knex, baseModel.tnPath),
    ...rows.flat(),
    pk.column_name,
    ids,
    ...(deleted ? [deleted.column_name] : []),
  ];
  // Written in field order: a field's cells then share heap pages, which a
  // probe of some fields rechecks (2–15x fewer pages than in row order).
  const insertInto = `INSERT INTO ?? AS i (fk_model_id, row_id, fk_column_id, ${CELL_VALUES})
       SELECT ?::text, row_id, fk_column_id, ${CELL_VALUES}`;
  const onConflict = `ON CONFLICT (fk_model_id, row_id, fk_column_id) DO UPDATE SET ${valueUpdates}`;

  if (firstBuild) {
    // Into a table with no key yet: nothing to compare against or clear.
    await knex.transaction(async (trx) => {
      await lockTarget(trx, target, { shared: true });
      await trx.raw(
        `${liveCtes}
         ${insertInto}
         FROM live ORDER BY fk_column_id, row_id`,
        [...liveBindings, target.path, target.modelId],
      );
    });
    return;
  }

  const refresh = (trx: Knex) =>
    trx.raw(
      `${liveCtes},
       cleared AS (
         DELETE FROM ?? AS i
         WHERE ${iScope.sql} AND i.row_id = ANY(?::text[])
           ${scoped ? 'AND i.fk_column_id = ANY(?::text[])' : ''}
           AND NOT EXISTS (SELECT 1 FROM live l
                           WHERE l.row_id = i.row_id
                             AND l.fk_column_id = i.fk_column_id)
       ),
       ${unmark}
       ${seen}
       -- An upsert locks (and logs) a conflicting row even when its WHERE fails.
       -- The ids bound too: within a partition the key's table prefix does not
       -- narrow, and the planner would sort the whole partition to merge.
       changed AS (
         SELECT l.* FROM live l
         LEFT JOIN ?? AS i ON ${iScope.sql} AND i.row_id = l.row_id
                          AND i.row_id = ANY(?::text[])
                          AND i.fk_column_id = l.fk_column_id
         WHERE i.row_id IS NULL OR ${valuesDiffer('i', 'l')}
       )
       ${insertInto}
       FROM changed ORDER BY fk_column_id, row_id
       ${onConflict}
         WHERE ${valuesDiffer('i', 'EXCLUDED')}`,
      [
        ...liveBindings,
        target.path,
        ...iScope.bindings,
        idTexts,
        ...(scoped ? [fieldIds] : []),
        ...(keepDirty
          ? []
          : [
              searchMarksPath(target.path),
              ...dScope.bindings,
              idTexts,
              ...(scoped ? [fieldIds] : []),
            ]),
        ...(stamp
          ? [
              searchSeenPath(target.path),
              target.modelId,
              pk.column_name,
              stamp,
              tableRef(knex, baseModel.tnPath),
              pk.column_name,
              ids,
              searchSeenPath(target.path),
              target.modelId,
              idTexts,
              pk.column_name,
              tableRef(knex, baseModel.tnPath),
              pk.column_name,
              ids,
            ]
          : []),
        target.path,
        ...iScope.bindings,
        idTexts,
        target.path,
        target.modelId,
      ],
    );
  // One refresh of a table's cells at a time across instances: one that read
  // a row earlier would otherwise write its older cells last.
  await knex.transaction(async (trx) => {
    await lockTarget(trx, target);
    await refresh(trx);
  });
}

/**
 * Ids of every row past `after`, or of the rows matching `where`, in keyset
 * chunks, with up to `concurrency` chunks handled at once. The first failure
 * stops it. `onProgress` gets the last id up to which every chunk is done.
 */
export async function forEachIdChunk(
  baseModel: IBaseModelSqlV2,
  where: Knex.Raw | undefined,
  fn: (ids: Array<string | number>) => Promise<void>,
  {
    concurrency = 1,
    chunkSize = BACKFILL_CHUNK,
    after,
    onProgress,
  }: {
    concurrency?: number;
    chunkSize?: number;
    after?: string | number;
    onProgress?: (doneThrough: string | number) => void;
  } = {},
) {
  const pk = baseModel.model.primaryKey;
  let last = after;
  const running = new Set<Promise<void>>();
  let failure: { error: unknown } | undefined;
  // Dispatched chunks in key order, until every one before them is done.
  const pending: Array<{ last: string | number; done: boolean }> = [];
  const settle = (chunk: (typeof pending)[number]) => {
    chunk.done = true;
    let through: string | number | undefined;
    while (pending[0]?.done) through = pending.shift().last;
    if (through !== undefined) onProgress?.(through);
  };
  try {
    while (!failure) {
      const qb = baseModel.dbDriver
        .from(baseModel.tnPath)
        .select(pk.column_name)
        .orderBy(pk.column_name)
        .limit(chunkSize);
      if (last !== undefined) qb.where(pk.column_name, '>', last);
      if (where) qb.whereRaw(where);
      const rows: Record<string, string | number>[] = await qb;
      if (!rows.length) break;
      const ids = rows.map((r) => r[pk.column_name]);
      const chunk = { last: ids[ids.length - 1], done: false };
      pending.push(chunk);
      const task: Promise<void> = fn(ids)
        .then(
          () => settle(chunk),
          (error) => {
            failure ??= { error };
          },
        )
        .finally(() => running.delete(task));
      running.add(task);
      last = ids[ids.length - 1];
      if (rows.length < chunkSize) break;
      while (running.size >= concurrency && !failure) {
        await Promise.race(running);
      }
    }
  } finally {
    await Promise.all(running);
  }
  if (failure) throw failure.error;
}

/** Chunks a first build writes at once. */
const FIRST_BUILD_CONCURRENCY = 2;

export interface IndexRowsOptions {
  /** With `ids` null: only rows matching this, in keyset chunks. */
  where?: Knex.Raw;
  /** With `ids` null: only rows past this id, as a resumed build. */
  after?: string | number;
  /** With `ids` null: the last id up to which every chunk is written. */
  onProgress?: (doneThrough: string | number) => void;
  /** Before each chunk is written. */
  beforeChunk?: (ids: Array<string | number>) => Promise<void>;
  /** After each chunk is written. */
  onChunk?: (ids: Array<string | number>) => Promise<void>;
  /** Leave the marks: a newer write's flush re-indexes those rows. */
  keepDirty?: boolean;
  /** Write only `fields`, leaving the rows' other cells as they are. */
  scoped?: boolean;
  /**
   * A first build's own table, with no key: writes to the table are held
   * until the build ends, so cells are only inserted, and chunks, disjoint
   * by row, run concurrently.
   */
  firstBuild?: boolean;
  /** Record no row versions: the caller records them once its fan-out is done. */
  noSeen?: boolean;
}

/** Write the cells of `fields` for `ids` (null = every row) into `target`. */
export async function indexRows(
  baseModel: IBaseModelSqlV2,
  target: SearchTarget,
  fields: Column[],
  ids: Array<string | number> | null,
  {
    where,
    after,
    onProgress,
    beforeChunk,
    onChunk,
    keepDirty,
    scoped,
    firstBuild,
    noSeen,
  }: IndexRowsOptions = {},
) {
  if (!fields.length) return;
  // Built and read once per call: a backfill writes many chunks.
  let users: Promise<CellUser[]> | undefined;
  const loadUsers = () => (users ??= cellUsers(baseModel));
  let entries: Promise<CellEntry[]> | undefined;
  const write = async (chunk: Array<string | number>) => {
    await beforeChunk?.(chunk);
    await refreshRows(
      baseModel,
      target,
      await (entries ??= cellEntries(baseModel, fields)),
      chunk,
      !!keepDirty,
      loadUsers,
      scoped,
      firstBuild,
      noSeen,
    );
    await onChunk?.(chunk);
  };
  if (ids === null) {
    await forEachIdChunk(baseModel, where, write, {
      concurrency: firstBuild ? FIRST_BUILD_CONCURRENCY : 1,
      after,
      onProgress,
    });
    return;
  }
  for (let i = 0; i < ids.length; i += REFRESH_BATCH) {
    await write(ids.slice(i, i + REFRESH_BATCH));
  }
}

/** Row ids a walk of the cells for gone rows reads at once. */
const GONE_ROWS_BATCH = 5_000;

/**
 * Delete the cells of rows no longer in the table, walking the cells by row
 * id in batches, each under the target's lock.
 */
export async function deleteGoneRowCells(
  baseModel: IBaseModelSqlV2,
  target: SearchTarget,
  rowIdType: SearchIndexMeta['row_id_type'],
  /** In one statement: a first build's table, with no key to walk. */
  once = false,
) {
  const pk = baseModel.model.primaryKey;
  if (!pk) return;
  const knex = baseModel.dbDriver;
  // Cast to the key's own type where it isn't text, so its index is used.
  const match =
    rowIdType === 'bigint'
      ? 't.?? = r.row_id::bigint'
      : /uuid/i.test(`${pk.dt ?? ''}`)
      ? 't.?? = r.row_id::uuid'
      : 't.??::text = r.row_id';
  if (once) {
    await knex.transaction(async (trx) => {
      await lockTarget(trx, target);
      await trx.raw(
        `DELETE FROM ?? AS r
         WHERE NOT EXISTS (SELECT 1 FROM ? AS t WHERE ${match})`,
        [target.path, tableRef(knex, baseModel.tnPath), pk.column_name],
      );
    });
    return;
  }
  let after = '';
  for (;;) {
    const last: string | undefined = await knex.transaction(async (trx) => {
      await lockTarget(trx, target);
      const { rows } = await trx.raw(
        `WITH r AS (
           SELECT DISTINCT row_id FROM ??
           WHERE fk_model_id = ? AND row_id > ?
           ORDER BY row_id LIMIT ${GONE_ROWS_BATCH}
         ),
         gone AS (
           SELECT r.row_id FROM r
           WHERE NOT EXISTS (SELECT 1 FROM ? AS t WHERE ${match})
         ),
         deleted AS (
           DELETE FROM ?? AS c USING gone
           WHERE c.fk_model_id = ? AND c.row_id = gone.row_id
         )
         SELECT max(row_id) AS last, count(*) AS n FROM r`,
        [
          target.path,
          target.modelId,
          after,
          tableRef(knex, baseModel.tnPath),
          pk.column_name,
          target.path,
          target.modelId,
        ],
      );
      return Number(rows?.[0]?.n) >= GONE_ROWS_BATCH ? rows[0].last : undefined;
    });
    if (last === undefined) return;
    after = last;
  }
}

/** Up to `limit` ids of rows matching `stamp`, read under a statement timeout. */
function stampedRowIds(
  knex: Knex,
  tnPath: string | Knex.Raw,
  pk: string,
  stamp: Knex.Raw,
  limit: number,
  timeoutMs: number,
  seen?: { path: string; modelId: string; stamp: Knex.Raw },
): Promise<{ ids: Array<string | number>; matched: boolean }> {
  return knex.transaction(async (trx) => {
    await trx.raw(`SET LOCAL statement_timeout = ${timeoutMs}`);
    // Due rows first: the limit counts only them, and a matched row says
    // writes happened even when all are indexed already.
    const due = seen
      ? trx.raw(
          `NOT EXISTS (SELECT 1 FROM ?? AS nc_seen
             WHERE nc_seen.fk_model_id = ? AND nc_seen.row_id = ??::text
               AND nc_seen.stamp >= ?)`,
          [seen.path, seen.modelId, pk, seen.stamp],
        )
      : trx.raw('true');
    const rows: Array<{ id: string | number; due: boolean }> = await trx
      .from(tnPath)
      .select({ id: pk })
      .select(trx.raw('? AS due', [due]))
      .whereRaw(stamp)
      .orderBy('due', 'desc')
      .limit(limit);
    return {
      ids: rows.filter((r) => r.due).map((r) => r.id),
      matched: rows.length > 0,
    };
  });
}

/**
 * The next `size` rows by pk after `after`: the ids among them matching
 * `stamp`, and the last pk read (undefined past the end). Each call reads at
 * most `size` rows, whatever share of them match.
 */
function stampedRowIdsInChunk(
  knex: Knex,
  tnPath: string | Knex.Raw,
  pk: string,
  stamp: Knex.Raw,
  after: string | number | undefined,
  size: number,
  timeoutMs: number,
  seen?: { path: string; modelId: string; stamp: Knex.Raw },
): Promise<{ ids: Array<string | number>; last?: string | number }> {
  return knex.transaction(async (trx) => {
    await trx.raw(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const hit = seen
      ? trx.raw(
          `(? AND NOT EXISTS (SELECT 1 FROM ?? AS nc_seen
             WHERE nc_seen.fk_model_id = ? AND nc_seen.row_id = ??::text
               AND nc_seen.stamp >= ?))`,
          [stamp, seen.path, seen.modelId, pk, seen.stamp],
        )
      : stamp;
    const chunk = trx
      .from(tnPath)
      .select({ id: pk })
      .select(trx.raw('? AS hit', [hit]))
      .orderBy(pk)
      .limit(size);
    if (after !== undefined) chunk.where(pk, '>', after);
    const { rows } = await trx.raw(
      `WITH r AS (SELECT * FROM ? AS q),
       l AS (SELECT id FROM r ORDER BY id DESC LIMIT 1)
       SELECT r.id, r.hit, r.id = l.id AS last, (SELECT count(*) FROM r) AS n
       FROM r CROSS JOIN l WHERE r.hit OR r.id = l.id`,
      [chunk],
    );
    const read: Array<{
      id: string | number;
      hit: boolean;
      last: boolean;
      n: string | number;
    }> = rows ?? [];
    return {
      ids: read.filter((r) => r.hit).map((r) => r.id),
      last:
        read.length && Number(read[0].n) >= size
          ? read.find((r) => r.last)?.id
          : undefined,
    };
  });
}

/** Row versions read before a fan-out, recorded once it is done. */
export interface RowStamps {
  ids: string[];
  stamps: Array<string | null>;
}

/**
 * The current version of `ids`. Read before the work they cover: a write
 * landing meanwhile then leaves the row due for the reconcile.
 */
export async function readRowStamps(
  baseModel: IBaseModelSqlV2,
  ids: Array<string | number>,
): Promise<RowStamps | undefined> {
  const knex = baseModel.dbDriver;
  const pk = baseModel.model.primaryKey;
  const stamp = rowStampSql(knex, baseModel.model, 't');
  if (!pk || !stamp || !ids.length) return undefined;
  const { rows } = await knex.raw(
    `SELECT t.??::text AS id, (?)::timestamptz::text AS stamp
     FROM ? AS t WHERE t.?? = ANY(?)`,
    [
      pk.column_name,
      stamp,
      tableRef(knex, baseModel.tnPath),
      pk.column_name,
      ids,
    ],
  );
  const read: Array<{ id: string; stamp: string | null }> = rows ?? [];
  if (!read.length) return undefined;
  return { ids: read.map((r) => r.id), stamps: read.map((r) => r.stamp) };
}

/** Record versions read by {@link readRowStamps}: the rows' fan-out is done. */
export async function recordRowsSeen(
  knex: Knex,
  target: SearchTarget,
  seen: RowStamps | undefined,
) {
  if (!seen?.ids.length) return;
  await knex.raw(
    `INSERT INTO ?? AS s (fk_model_id, row_id, stamp)
     SELECT ?::text, r.id, r.stamp
     FROM unnest(?::text[], ?::timestamptz[]) AS r(id, stamp)
     ON CONFLICT (fk_model_id, row_id) DO UPDATE SET stamp = EXCLUDED.stamp
       WHERE s.stamp IS DISTINCT FROM EXCLUDED.stamp`,
    [searchSeenPath(target.path), target.modelId, seen.ids, seen.stamps],
  );
}

/** Reads of a user table by its stamps; one object, so a test can stub them. */
export const stampedRows = {
  ids: stampedRowIds,
  inChunk: stampedRowIdsInChunk,
};

/** Marked rows a write marks one by one; past it, the table is marked stale. */
export const SEARCH_MARKED_ROWS = 20_000;
/** How long a mark waits for a lock. */
const MARK_LOCK_TIMEOUT = '2s';
/** Ids per mark transaction. */
const MARK_BATCH = 5_000;

/**
 * Mark `ids` as not re-indexed yet: marked rows are always candidates, so a
 * search finds them before a flush rewrites their documents, and the marks
 * are what the flush job reads. `propagate`: the rows were written, so the
 * flush also walks them to the indexes that read them. A mark set again is
 * re-stamped, so a flush that read the old one leaves it. In pk order, so
 * concurrent marks and flushes can't deadlock.
 */
export async function markRowsDirty(
  knex: Knex,
  target: SearchTarget,
  ids: Array<string | number>,
  {
    propagate = false,
    fields,
  }: { propagate?: boolean; fields?: string[] } = {},
) {
  for (let i = 0; i < ids.length; i += MARK_BATCH) {
    const chunk = ids.slice(i, i + MARK_BATCH);
    await knex.transaction(async (trx) => {
      await trx.raw(`SET LOCAL lock_timeout = '${MARK_LOCK_TIMEOUT}'`);
      await trx.raw(
        `INSERT INTO ?? AS d (fk_model_id, row_id, propagate, fields)
         SELECT ?::text, r, ?, ?::text[]
         FROM (SELECT DISTINCT r FROM unnest(?::text[]) AS r) AS u
         ORDER BY r
         ON CONFLICT (fk_model_id, row_id) DO UPDATE
           SET marked_at = clock_timestamp(),
               propagate = d.propagate OR EXCLUDED.propagate,
               fields = CASE
                 WHEN d.fields IS NULL OR EXCLUDED.fields IS NULL THEN NULL
                 ELSE ARRAY(SELECT DISTINCT unnest(d.fields || EXCLUDED.fields))
               END`,
        [
          searchMarksPath(target.path),
          target.modelId,
          propagate,
          fields?.length ? fields : null,
          chunk.map((id) => `${id}`),
        ],
      );
    });
  }
}

/** A mark as a flush read it. */
export interface SearchMark {
  row_id: string;
  propagate?: boolean;
  /** Only these fields are owed; null = every field. */
  fields?: string[] | null;
  /** As stored; a mark re-stamped since is not cleared with it. */
  marked_at: string;
}

/**
 * Up to `limit` marks set before `before`, in pk order. `propagating`: only
 * those still to be walked to the indexes reading the rows.
 */
export async function readMarks(
  knex: Knex,
  target: SearchTarget,
  limit: number,
  before: string,
  { propagating = false }: { propagating?: boolean } = {},
): Promise<SearchMark[]> {
  const scope = scopeWhere(target);
  const result = await knex.raw(
    `SELECT row_id, propagate, fields, marked_at::text AS marked_at FROM ??
     WHERE ${scope.sql} AND marked_at < ?::timestamptz${
      propagating ? ' AND propagate' : ''
    }
     ORDER BY row_id LIMIT ?`,
    [searchMarksPath(target.path), ...scope.bindings, before, limit],
  );
  return result?.rows ?? [];
}

/** Clears `marks`, each only if it wasn't set again after it was read. */
export async function unmarkRows(
  knex: Knex,
  target: SearchTarget,
  marks: SearchMark[],
  /** Written only these fields: a mark owing another one stays. */
  fields?: string[],
) {
  if (!marks.length) return;
  const scope = scopeWhere(target, 'd');
  await knex.raw(
    `DELETE FROM ?? AS d
     USING unnest(?::text[], ?::timestamptz[]) AS m(row_id, marked_at)
     WHERE ${scope.sql} AND d.row_id = m.row_id
       AND d.marked_at <= m.marked_at${
         fields ? ' AND d.fields <@ ?::text[]' : ''
       }`,
    [
      searchMarksPath(target.path),
      marks.map((m) => m.row_id),
      marks.map((m) => m.marked_at),
      ...scope.bindings,
      ...(fields ? [fields] : []),
    ],
  );
}

/**
 * Keeps `marks` for this table's own index but clears their `propagate`:
 * walked to the indexes reading the rows, each only if it wasn't set again.
 */
export async function settleMarkPropagation(
  knex: Knex,
  target: SearchTarget,
  marks: SearchMark[],
) {
  if (!marks.length) return;
  const scope = scopeWhere(target, 'd');
  await knex.raw(
    `UPDATE ?? AS d SET propagate = false
     FROM unnest(?::text[], ?::timestamptz[]) AS m(row_id, marked_at)
     WHERE ${scope.sql} AND d.row_id = m.row_id
       AND d.marked_at <= m.marked_at`,
    [
      searchMarksPath(target.path),
      marks.map((m) => m.row_id),
      marks.map((m) => m.marked_at),
      ...scope.bindings,
    ],
  );
}

/** The database's clock, so it compares with `marked_at`. */
export async function dbNow(knex: Knex): Promise<string> {
  const result = await knex.raw(`SELECT clock_timestamp()::text AS now`);
  return result.rows[0].now;
}

// undefined_table, undefined_column, invalid_schema_name
const MISSING_OBJECT_CODES = new Set(['42P01', '42703', '3F000']);

/**
 * The planner reads the table and the term as independent, so a term common
 * in another table can make a capped probe look cheaper as a scan of every
 * table's documents. Every branch of the probe has an index to use instead.
 */
const PROBE_SETTINGS = ['SET LOCAL enable_seqscan = off'];

/**
 * For a match probe under a LIMIT: the planner may walk the primary key and
 * filter, expecting matches early, and read every cell of a table that has
 * none. A bitmap scan reads only the candidates.
 */
const MATCH_PROBE_SETTINGS = [
  ...PROBE_SETTINGS,
  'SET LOCAL enable_indexscan = off',
];

/** Cells of a table read, in key order, to judge how common a term is there. */
export function searchSampleCells() {
  return searchEnvInt('NC_SEARCH_SAMPLE_CELLS', 20_000);
}

/** A table's first `cells` cells, aliased `nc_cell`. */
function sampleCellsSql(modelRef: string, cells: number) {
  return `(SELECT row_id, fk_column_id, txt, num, day, ts, refs FROM ??
           WHERE fk_model_id = ${modelRef}
           ORDER BY row_id, fk_column_id LIMIT ${cells}) AS nc_cell`;
}

/**
 * Under the request's statement timeout and abort, like the list query.
 * Values stay bound: inlined, a `?` in a string literal would be read as a
 * placeholder.
 */
async function guardedRows<T>(
  knex: Knex,
  query: Knex.Raw | Knex.QueryBuilder,
  settings: readonly string[] = PROBE_SETTINGS,
): Promise<T[]> {
  const { sql, bindings } = query.toSQL();
  const guard = getQueryGuard();
  const rows = shouldGuardQuery(guard, sql)
    ? await execPgWithGuard(knex, sql, guard, bindings, settings)
    : await knex.transaction(async (trx) => {
        for (const setting of settings) await trx.raw(setting);
        return (await trx.raw(sql, bindings))?.rows;
      });
  return rows ?? [];
}

/**
 * What a term can match, by cell kind: a text pattern, a number, a day, and
 * a day per timezone for instants. Columns are field ids.
 */
export interface CellMatch {
  /** ILIKE pattern, for `txt` cells of `textCols`. */
  pattern?: string;
  textCols: string[];
  num?: number;
  numCols: string[];
  /** `YYYY-MM-DD`: `day` cells of `dayCols`, and `ts` cells in each group's zone. */
  day?: string;
  dayCols: string[];
  tsGroups: Array<{ cols: string[]; timezone: string }>;
  /** User cells of `userCols` naming one of these users: matched by id, not text. */
  userIds?: string[];
  userCols?: string[];
}

/** `cells` rows matching `match`, as SQL with bindings; undefined for none. */
function cellMatchSql(match: CellMatch, alias = '') {
  const p = alias ? `${alias}.` : '';
  const parts: string[] = [];
  const bindings: unknown[] = [];
  if (match.pattern && match.textCols.length) {
    parts.push(`(${p}fk_column_id = ANY(?::text[]) AND ${p}txt ILIKE ?)`);
    bindings.push(match.textCols, match.pattern);
  }
  if (match.num !== undefined && match.numCols.length) {
    parts.push(`(${p}fk_column_id = ANY(?::text[]) AND ${p}num = ?::numeric)`);
    bindings.push(match.numCols, `${match.num}`);
  }
  if (match.day && match.dayCols.length) {
    parts.push(`(${p}fk_column_id = ANY(?::text[]) AND ${p}day = ?::date)`);
    bindings.push(match.dayCols, match.day);
  }
  if (match.userIds?.length && match.userCols?.length) {
    parts.push(`(${p}fk_column_id = ANY(?::text[]) AND ${p}refs && ?::text[])`);
    bindings.push(match.userCols, match.userIds);
  }
  for (const group of match.day ? match.tsGroups : []) {
    if (!group.cols.length) continue;
    parts.push(
      `(${p}fk_column_id = ANY(?::text[])
        AND ${p}ts >= ((?::date)::timestamp AT TIME ZONE ?)
        AND ${p}ts < (((?::date) + 1)::timestamp AT TIME ZONE ?))`,
    );
    bindings.push(
      group.cols,
      match.day,
      group.timezone,
      match.day,
      group.timezone,
    );
  }
  return parts.length
    ? { sql: `(${parts.join(' OR ')})`, bindings }
    : undefined;
}

/**
 * Matching cells a grid search reads before its data query. Past this, the
 * term is common and rows are checked one by one in the grid's order.
 */
export function gridProbeCap() {
  return searchEnvInt('NC_SEARCH_GRID_PROBE_CAP', 50_000);
}

/**
 * Cells (rows x fields) of the rows behind the index that a grid search
 * derives live. Past it, after a large write, those rows are matched by their
 * cells as they stand until the flush catches up.
 */
export function behindLiveCells() {
  return searchEnvInt('NC_SEARCH_BEHIND_LIVE_CELLS', 100_000, 0);
}

/** Rows with a cut-off cell of `textCols`: their cells never hold the whole text. */
export function partialRowIds(
  knex: Knex,
  path: string,
  modelId: string,
  textCols: string[],
): Promise<string[] | undefined> {
  if (!textCols.length) return Promise.resolve([]);
  return cappedRowIds(
    knex,
    `SELECT row_id FROM ?? WHERE fk_model_id = ? AND partial
       AND fk_column_id = ANY(?::text[])`,
    [path, modelId, textCols],
    gridProbeCap(),
  );
}

/** Rows marked behind by a write, up to `cap`; `undefined` at the cap. */
export function markedRowIds(
  knex: Knex,
  path: string,
  modelId: string,
  cap: number,
): Promise<string[] | undefined> {
  return cappedRowIds(
    knex,
    `SELECT row_id FROM ?? WHERE fk_model_id = ?`,
    [searchMarksPath(path), modelId],
    cap,
  );
}

/** Row ids of up to `cap` rows from `sql`; `undefined` at the cap. */
async function cappedRowIds(
  knex: Knex,
  sql: string,
  bindings: unknown[],
  cap: number,
  settings?: readonly string[],
): Promise<string[] | undefined> {
  const rows = await guardedRows<{ row_id: string }>(
    knex,
    knex.raw(`${sql} LIMIT ?`, [...bindings, cap]),
    settings,
  );
  if (rows.length >= cap) return undefined;
  return [...new Set(rows.map((r) => `${r.row_id}`))];
}

/**
 * The rows matching `matched`, from a sample of the table's cells instead of
 * a probe: all of them when the sample holds every cell, `undefined` when it
 * says the probe would reach `cap` (a waste: past the cap rows are checked one
 * by one), else null: the probe decides. `cells`: the matching cells, exact
 * when the sample holds every cell, else estimated.
 */
async function sampledMatchIds(
  knex: Knex,
  path: string,
  modelId: string,
  matched: { sql: string; bindings: unknown[] },
  cap: number,
  rows: number | undefined,
): Promise<{
  ids: string[] | undefined | null;
  cells?: { count: number; exact: boolean };
}> {
  const sampleCells = searchSampleCells();
  const [sample] = await guardedRows<{
    cells: string | number;
    sampled_rows: string | number;
    hits: string | number;
    ids: string[] | null;
  }>(
    knex,
    knex.raw(
      `SELECT count(*) AS cells,
              count(DISTINCT row_id) AS sampled_rows,
              count(*) FILTER (WHERE ${matched.sql}) AS hits,
              CASE WHEN count(*) < ${sampleCells}
                THEN array_agg(DISTINCT row_id) FILTER (WHERE ${matched.sql})
              END AS ids
       FROM ${sampleCellsSql('?', sampleCells)}`,
      [...matched.bindings, ...matched.bindings, path, modelId],
    ),
  );
  if (!sample) return { ids: null };
  const hits = Number(sample.hits);
  if (Number(sample.cells) < sampleCells) {
    const cells = { count: hits, exact: true };
    if (hits >= cap) return { ids: undefined, cells };
    return { ids: (sample.ids ?? []).map((id) => `${id}`), cells };
  }
  const sampledRows = Number(sample.sampled_rows);
  if (!rows || !sampledRows) return { ids: null };
  const estimate = (hits * rows) / sampledRows;
  return {
    ids: estimate >= cap ? undefined : null,
    cells: { count: estimate, exact: false },
  };
}

/**
 * A grid search's row ids, read from the index before its data query:
 * `matched`, the rows with a cell matching `match`, and `behind`, the rows
 * whose cells may be behind (marked, or a cut-off text cell of `textCols`).
 * Each is `undefined` past the cap. No DISTINCT: it would read every match
 * before the limit.
 */
export interface GridProbe {
  matched?: string[];
  behind?: string[];
  /** Bytes the planner allows a hashed subplan (`hash_mem`). */
  hashMem?: number;
  /** Past the probe cap, under the hash cap: matched as one set of the cells. */
  hashed?: boolean;
  /** Marked rows are matched by their cells: only cut-off rows are behind. */
  marksByCells?: boolean;
}

/**
 * Matching cells up to which a term past the probe cap is matched as one
 * hashed set; past it, row by row. At or below the probe cap: off.
 */
export function gridHashCap() {
  return searchEnvInt('NC_SEARCH_GRID_HASH_CAP', 100_000, 0);
}

const HASH_MEM_TTL_MS = 60_000;
const hashMemCache = new WeakMap<
  Knex,
  { at: number; settings: Promise<{ workMem: number; multiplier: number }> }
>();

/** The server's `work_mem` in bytes and its `hash_mem_multiplier`. */
function hashMemSettings(
  knex: Knex,
): Promise<{ workMem: number; multiplier: number }> {
  const cached = hashMemCache.get(knex);
  if (cached && Date.now() - cached.at < HASH_MEM_TTL_MS) {
    return cached.settings;
  }
  const settings = knex
    .raw(
      `SELECT pg_size_bytes(current_setting('work_mem')) AS work_mem,
         coalesce(nullif(current_setting('hash_mem_multiplier', true), '')::float8, 1)
         AS multiplier`,
    )
    .then((res) => ({
      workMem: Number(res?.rows?.[0]?.work_mem),
      multiplier: Number(res?.rows?.[0]?.multiplier),
    }));
  hashMemCache.set(knex, { at: Date.now(), settings });
  settings.catch(() => hashMemCache.delete(knex));
  return settings;
}

/**
 * `hash_mem` for this request's reads, in bytes: the search's own
 * `work_mem` when its planner settings apply, else the server's.
 */
async function hashMemBytes(knex: Knex): Promise<number> {
  const { workMem, multiplier } = await hashMemSettings(knex);
  const guard = getQueryGuard();
  const searchWorkMem =
    guard?.search && guard.planSettings ? searchWorkMemBytes() : undefined;
  return (searchWorkMem ?? workMem) * multiplier;
}

/**
 * Probes once per request for each table and term. `rows`, the table's rows
 * as last built, lets a sample skip a probe that would reach the cap.
 */
export function probeGridSearch(
  knex: Knex,
  path: string,
  modelId: string,
  match: CellMatch,
  {
    cap = gridProbeCap(),
    rows,
    behindCap = cap,
  }: { cap?: number; rows?: number; behindCap?: number } = {},
): Promise<GridProbe> {
  const guard = getQueryGuard();
  const key = JSON.stringify([path, modelId, match, cap, behindCap]);
  const cached = guard?.searchProbes?.get(key);
  if (cached) return cached;

  const matchedIds = async (): Promise<{
    ids: string[] | undefined;
    cells?: { count: number; exact: boolean };
  }> => {
    const matched = cellMatchSql(match);
    const sampleMatch = cellMatchSql(match, 'nc_cell');
    if (!matched || !sampleMatch) return { ids: [] };
    const sampled = await sampledMatchIds(
      knex,
      path,
      modelId,
      sampleMatch,
      cap,
      rows,
    );
    if (sampled.ids !== null) return { ids: sampled.ids, cells: sampled.cells };
    return {
      ids: await cappedRowIds(
        knex,
        `SELECT row_id FROM ?? WHERE fk_model_id = ? AND ${matched.sql}`,
        [path, modelId, ...matched.bindings],
        cap,
        MATCH_PROBE_SETTINGS,
      ),
    };
  };

  const underHashCap = async (cells?: { count: number; exact: boolean }) => {
    const hashCap = gridHashCap();
    const matched = cellMatchSql(match);
    if (!matched || hashCap <= cap) return false;
    if (cells?.exact) return cells.count < hashCap;
    // Well past the cap by the sample: counting would only confirm it.
    if (cells && cells.count >= 2 * hashCap) return false;
    const [row] = await guardedRows<{ n: string | number }>(
      knex,
      knex.raw(
        `SELECT count(*) AS n FROM (SELECT 1 FROM ?? WHERE fk_model_id = ?
           AND ${matched.sql} LIMIT ?) AS nc_sized`,
        [path, modelId, ...matched.bindings, hashCap],
      ),
      MATCH_PROBE_SETTINGS,
    );
    return Number(row?.n) < hashCap;
  };

  const run = (async (): Promise<GridProbe> => {
    // Only tunes a plan choice: a failed read keeps the list.
    const hashMem = hashMemBytes(knex).catch(() => undefined);
    const { ids: matched, cells } = await matchedIds();
    const [hashed, behind] = await Promise.all([
      matched === undefined ? underHashCap(cells) : false,
      cappedRowIds(
        knex,
        `SELECT row_id FROM ?? WHERE fk_model_id = ?
         UNION
         SELECT row_id FROM ?? WHERE fk_model_id = ? AND partial
           AND fk_column_id = ANY(?::text[])`,
        [searchMarksPath(path), modelId, path, modelId, match.textCols],
        behindCap,
      ),
    ]);
    return { matched, hashed, behind, hashMem: await hashMem };
  })();
  if (guard) {
    guard.searchProbes ??= new Map();
    guard.searchProbes.set(key, run);
    run.catch(() => guard.searchProbes?.delete(key));
  }
  return run;
}

/**
 * How a list of row ids compares with the primary key: `listType` is the
 * key's own type, so its index applies; undefined compares as text.
 */
function pkListType(
  pk: Column,
  rowIdType: SearchIndexMeta['row_id_type'],
): { cast: 'bigint' | 'text'; listType?: 'bigint' | 'uuid' | 'text' } {
  const cast = rowIdType === 'bigint' ? 'bigint' : 'text';
  const dt = `${pk.dt ?? ''}`;
  const listType =
    cast === 'bigint'
      ? 'bigint'
      : /^uuid$/i.test(dt)
      ? 'uuid'
      : /char|text/i.test(dt)
      ? 'text'
      : undefined;
  return { cast, listType };
}

/**
 * Filters for an index-only search of the live cells at `path`, as raw
 * clauses on the user table's primary key:
 * - `candidates`: rows with a matching cell, plus rows whose cells may be
 *   behind;
 * - `settled`: rows that are neither, which the index alone decides.
 * The caller checks rows not `settled` with live conditions.
 *
 * With full id sets from `probe`, both are one primary-key list, which the
 * planner can look up by index (an OR with a subquery can't). A term past the
 * probe cap is matched as one hashed set of its cells while under the hash
 * cap, and row by row past it: hashing every match of a very common term
 * takes seconds.
 *
 * A list under an OR or NOT is only fast as a hashed subplan, which Postgres
 * builds only if it fits `hash_mem`; else it rescans the list for every row.
 * A list too big for that is dropped for the probe's over-cap paths.
 */
export function cellSearchClauses(
  baseModel: IBaseModelSqlV2,
  rowIdType: SearchIndexMeta['row_id_type'],
  path: string,
  match: CellMatch,
  probe: GridProbe,
): { candidates: FilterRawClause; settled: FilterRawClause } {
  const modelId = baseModel.model.id;
  const pk = baseModel.model.primaryKey;
  const { cast, listType } = pkListType(pk, rowIdType);
  const pkName = `"${pk.column_name.replace(/"/g, '""')}"`;
  const pkCol = (alias?: string) => `${alias ? `"${alias}".` : ''}${pkName}`;
  const pkRef = (alias?: string) =>
    `${pkCol(alias)}${cast === 'text' ? '::text' : ''}`;
  // The planner's size estimate: key width (32 for text) plus a tuple header.
  const idBytes =
    (listType === 'bigint' ? 8 : listType === 'uuid' ? 16 : 32) + 24;
  const hashable = (count: number) =>
    !probe.hashMem || count * idBytes <= probe.hashMem;
  // A hashed set, not `= ANY`: with matches late in the sort order, the
  // planner walks the sort index and scans the whole array for every row.
  const inList = (alias: string | undefined, ids: string[]) => ({
    sql: `${listType ? pkCol(alias) : pkRef(alias)} IN (SELECT unnest(?::${
      listType ?? 'text'
    }[]) OFFSET 0)`,
    bindings: [ids],
  });
  // Qualified: inside a subquery on the cells, a bare name could bind there.
  const outerPk = (alias?: string) => ({
    sql: `??.${pkName}::text`,
    bindings: [alias ?? baseModel.getTnPath(baseModel.model)],
  });
  const matched = cellMatchSql(match, 'nc_cell');
  const partialSql = (type: string) =>
    `SELECT row_id::${type} FROM ?? WHERE fk_model_id = ? AND partial
       AND fk_column_id = ANY(?::text[])`;
  const partialBindings = [path, modelId, match.textCols];
  const behind = probe.marksByCells
    ? { sql: partialSql(cast), bindings: partialBindings }
    : {
        sql: `SELECT row_id::${cast} FROM ?? WHERE fk_model_id = ?
          UNION
          ${partialSql(cast)}`,
        bindings: [searchMarksPath(path), modelId, ...partialBindings],
      };
  return {
    candidates: (qb, alias) => {
      if (matched && !probe.matched && probe.hashed) {
        // One set with the behind rows, no OR: a semi-join, which can spill
        // past work_mem; under an OR it would be a per-row subplan.
        const type = listType ?? 'text';
        const members = [
          `SELECT nc_cell.row_id::${type} FROM ?? AS nc_cell
             WHERE nc_cell.fk_model_id = ? AND ${matched.sql}`,
        ];
        const setBindings: unknown[] = [path, modelId, ...matched.bindings];
        if (!probe.behind) {
          if (!probe.marksByCells) {
            members.push(
              `SELECT row_id::${type} FROM ?? WHERE fk_model_id = ?`,
            );
            setBindings.push(searchMarksPath(path), modelId);
          }
          members.push(partialSql(type));
          setBindings.push(...partialBindings);
        } else if (probe.behind.length) {
          members.push(`SELECT unnest(?::${type}[])`);
          setBindings.push(probe.behind);
        }
        qb.whereRaw(
          `${SEARCH_PLAN_MARK} ${
            listType ? pkCol(alias) : pkRef(alias)
          } IN (${members.join(' UNION ALL ')} OFFSET 0)`,
          setBindings,
        );
        return;
      }
      const parts: string[] = [];
      const bindings: unknown[] = [];
      let { matched: matchedIds, behind: behindIds } = probe;
      const listed = new Set(behindIds ?? []);
      if (matched && matchedIds) {
        for (const id of matchedIds) listed.add(id);
      }
      // Alone, the list is a semi-join, which needs no hashed subplan.
      const alone = behindIds && (!matched || matchedIds);
      if (!alone && !hashable(listed.size)) {
        matchedIds = behindIds = undefined;
        listed.clear();
      }
      if (matched && !matchedIds) {
        const outer = outerPk(alias);
        // OFFSET 0 keeps it a per-row check: never pulled up or hashed.
        parts.push(
          `EXISTS (SELECT 1 FROM ?? AS nc_cell
             WHERE nc_cell.fk_model_id = ? AND nc_cell.row_id = ${outer.sql}
               AND ${matched.sql} OFFSET 0)`,
        );
        bindings.push(path, modelId, ...outer.bindings, ...matched.bindings);
      }
      if (listed.size) {
        const list = inList(alias, [...listed]);
        parts.push(list.sql);
        bindings.push(...list.bindings);
      }
      if (!behindIds) {
        parts.push(`${pkRef(alias)} IN (${behind.sql})`);
        bindings.push(...behind.bindings);
      }
      qb.whereRaw(
        parts.length
          ? `${
              listed.size > searchPlanMinIds() ? `${SEARCH_PLAN_MARK} ` : ''
            }(${parts.join(' OR ')})`
          : 'false',
        bindings,
      );
    },
    settled: (qb, alias) => {
      if (!probe.behind || !hashable(probe.behind.length)) {
        qb.whereRaw(`${pkRef(alias)} NOT IN (${behind.sql})`, behind.bindings);
      } else if (probe.behind.length) {
        const list = inList(alias, probe.behind);
        qb.whereRaw(`NOT (${list.sql})`, list.bindings);
      } else {
        qb.whereRaw('true');
      }
    },
  };
}

/** `match` narrowed to one field. */
function fieldCellMatch(match: CellMatch, columnId: string): CellMatch {
  const only = (cols: string[]) => cols.filter((id) => id === columnId);
  return {
    ...match,
    textCols: only(match.textCols),
    numCols: only(match.numCols),
    dayCols: only(match.dayCols),
    tsGroups: match.tsGroups.map((g) => ({ ...g, cols: only(g.cols) })),
    userCols: match.userCols && only(match.userCols),
  };
}

/**
 * Rows whose cells of `columns`, derived live from the table, match `match`:
 * the cells a build writes, tested by the probe's own predicate, so a row
 * matches the same whether it's indexed or not. Checked row by row.
 */
export async function liveCellMatchClause(
  baseModel: IBaseModelSqlV2,
  columns: Column[],
  match: CellMatch,
): Promise<FilterRawClause> {
  const pk = baseModel.model.primaryKey;
  // Stored fields first: OR stops at the first match.
  const entries = (await cellEntries(baseModel, columns)).sort(
    (a, b) => Number(a.computed) - Number(b.computed),
  );
  let users = false;
  const parts: string[] = [];
  const bindings: unknown[] = [];
  for (const entry of entries) {
    const matched = cellMatchSql(
      fieldCellMatch(match, entry.columnId),
      'nc_cell',
    );
    if (!matched) continue;
    users ||= entry.users;
    parts.push(
      `(SELECT ${matched.sql}
        FROM (VALUES ${CELL_ROW_SQL}) AS nc_cell(${CELL_ROW_COLUMNS}))`,
    );
    bindings.push(...matched.bindings, ...entry.values);
  }
  const usersJson = users
    ? JSON.stringify(await cellUsers(baseModel))
    : undefined;
  return (qb, alias) => {
    if (!pk || !parts.length) {
      qb.whereRaw('false');
      return;
    }
    // OFFSET 0 keeps it a per-row check: a paged read stops at its last match.
    // MATERIALIZED: the users are decoded once, not again for each row.
    qb.whereRaw(
      `EXISTS (${
        usersJson
          ? `WITH nc_cell_users AS MATERIALIZED (${CELL_USERS_SQL}) `
          : ''
      }SELECT 1 FROM ? AS t WHERE t.?? = ??.??
         AND (${parts.join(' OR ')}) OFFSET 0)`,
      [
        ...(usersJson ? [usersJson] : []),
        tableRef(baseModel.dbDriver, baseModel.tnPath),
        pk.column_name,
        alias ?? baseModel.getTnPath(baseModel.model),
        pk.column_name,
        ...bindings,
      ],
    );
  };
}

/**
 * The rows of `ids` that `live` matches, as a primary key list. Checked in a
 * statement of its own, without the search read's plan settings: with nested
 * loops off, a lookup's live value scans its related table once per row.
 */
export async function behindLiveMatchClause(
  baseModel: IBaseModelSqlV2,
  rowIdType: SearchIndexMeta['row_id_type'],
  ids: string[],
  live: FilterRawClause,
): Promise<FilterRawClause> {
  const pk = baseModel.model.primaryKey;
  if (!pk || !ids.length) return (qb) => qb.whereRaw('false');
  const knex = baseModel.dbDriver;
  const { listType } = pkListType(pk, rowIdType);
  const inIds = (alias?: string) => ({
    sql: `??.??${listType ? '' : '::text'} IN (SELECT unnest(?::${
      listType ?? 'text'
    }[]) OFFSET 0)`,
    bindings: [
      alias ?? baseModel.getTnPath(baseModel.model),
      pk.column_name,
    ] as unknown[],
  });
  const query = knex
    .select(knex.raw('??::text AS row_id', [pk.column_name]))
    .from(baseModel.getTnPath(baseModel.model));
  const filter = inIds();
  query.whereRaw(filter.sql, [...filter.bindings, ids]);
  live(query);
  const rows = await guardedRows<{ row_id: string }>(knex, query, [
    'SET LOCAL jit = off',
  ]);
  const matched = rows.map((r) => `${r.row_id}`);
  return (qb, alias) => {
    if (!matched.length) {
      qb.whereRaw('false');
      return;
    }
    const list = inIds(alias);
    qb.whereRaw(list.sql, [...list.bindings, matched]);
  };
}

/**
 * Up to `perModel` rows per table with a cell matching `match` (any field of
 * the table), for several tables of one base's cells at `path`; keyed by
 * model id, in `modelIds` order. Marked and cut-off rows are left out.
 * Candidates only.
 */
export async function searchCandidateRowIdsByModel(
  knex: Knex,
  path: string,
  modelIds: string[],
  match: Omit<CellMatch, 'textCols' | 'numCols' | 'dayCols' | 'tsGroups'> & {
    timezone: string;
  },
  perModel: number,
): Promise<Map<string, Array<string | number>>> {
  const byModel = new Map<string, Array<string | number>>();
  if (!modelIds.length) return byModel;
  const parts: string[] = [];
  const bindings: unknown[] = [];
  if (match.pattern) {
    parts.push('txt ILIKE ?');
    bindings.push(match.pattern);
  }
  if (match.num !== undefined) {
    parts.push('num = ?::numeric');
    bindings.push(`${match.num}`);
  }
  if (match.day) {
    parts.push(
      `day = ?::date`,
      `(ts >= ((?::date)::timestamp AT TIME ZONE ?)
        AND ts < (((?::date) + 1)::timestamp AT TIME ZONE ?))`,
    );
    bindings.push(
      match.day,
      match.day,
      match.timezone,
      match.day,
      match.timezone,
    );
  }
  if (!parts.length) return byModel;
  const cond = parts.join(' OR ');
  // One probe per table, each capped on its own: first a sample, which finds
  // a common term early and is the whole answer for a table it covers; then
  // the trigram index for the other tables it fell short in. One branch per
  // table, its id bound: from a join, every partition would be opened.
  const sampleCells = searchSampleCells();
  const limit = Math.max(1, Math.floor(perModel));
  const sample = async () => {
    // The ids stop at `perModel`; only a table that comes up short has its
    // first cells counted (keys only), to tell whether the sample covered it.
    const rows = await guardedRows<{
      fk_model_id: string;
      cells: string | number | null;
      ids: Array<string | number> | null;
    }>(
      knex,
      knex.raw(
        `SELECT fk_model_id, ids, cells FROM (${modelIds
          .map(
            (_, i) => `SELECT ?::text AS fk_model_id, ${i} AS ord, r.ids,
                CASE WHEN COALESCE(cardinality(r.ids), 0) < ${limit}
                  THEN (SELECT count(*) FROM (SELECT 1 FROM ??
                          WHERE fk_model_id = ? LIMIT ${sampleCells}) AS c)
                END AS cells
              FROM (
                SELECT array_agg(row_id) AS ids FROM (
                  SELECT DISTINCT row_id FROM ${sampleCellsSql(
                    '?',
                    sampleCells,
                  )}
                  WHERE (${cond}) LIMIT ${limit}
                ) AS d
              ) AS r`,
          )
          .join(' UNION ALL ')}) AS s ORDER BY ord`,
        modelIds.flatMap((id) => [id, path, id, path, id, ...bindings]),
      ),
    );
    const short: string[] = [];
    for (const row of rows) {
      const ids = row.ids ?? [];
      if (ids.length) byModel.set(row.fk_model_id, ids);
      if (row.cells !== null && Number(row.cells) >= sampleCells) {
        short.push(row.fk_model_id);
      }
    }
    return short;
  };
  const probe = async (ids: string[]) => {
    const rows = await guardedRows<{
      fk_model_id: string;
      row_id: string | number;
    }>(
      knex,
      knex.raw(
        `SELECT fk_model_id, row_id FROM (${ids
          .map(
            (_, i) => `SELECT ?::text AS fk_model_id, ${i} AS ord, r.row_id
              FROM (
                SELECT DISTINCT row_id FROM ?? WHERE fk_model_id = ? AND (${cond})
                LIMIT ${limit}
              ) AS r`,
          )
          .join(' UNION ALL ')}) AS s ORDER BY ord`,
        ids.flatMap((id) => [id, path, id, ...bindings]),
      ),
      MATCH_PROBE_SETTINGS,
    );
    for (const row of rows) {
      const list = byModel.get(row.fk_model_id) ?? [];
      list.push(row.row_id);
      byModel.set(row.fk_model_id, list);
    }
  };
  try {
    const short = await sample();
    if (short.length) {
      for (const id of short) byModel.delete(id);
      await probe(short);
    }
    const order = new Map(modelIds.map((id, i) => [id, i]));
    return new Map(
      [...byModel].sort(
        ([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
      ),
    );
  } catch (e) {
    if (!MISSING_OBJECT_CODES.has((e as { code?: string })?.code)) throw e;
    logger.warn(`Search index probe failed on ${path}: ${shortError(e)}`);
  }
  return byModel;
}

/** Whether pg_trgm reads non-ASCII letters as word characters here. */
const unicodeWords = new WeakMap<Knex, Promise<boolean>>();
export function trigramReadsUnicode(knex: Knex) {
  let cached = unicodeWords.get(knex);
  if (!cached) {
    cached = knex
      .raw(
        `SELECT datctype FROM pg_database WHERE datname = current_database()`,
      )
      .then((r) => !/^(C|POSIX)$/i.test(`${r?.rows?.[0]?.datctype ?? 'C'}`))
      .catch(() => false);
    unicodeWords.set(knex, cached);
  }
  return cached;
}

/** `pk = ANY(rows)`; no rows matches nothing. */
export function searchClause(
  baseModel: IBaseModelSqlV2,
  rowIdType: SearchIndexMeta['row_id_type'],
  rowIds: Array<string | number>,
) {
  const pk = baseModel.model.primaryKey;
  return (qb: Knex.QueryBuilder, alias?: string) => {
    if (!rowIds.length) {
      qb.whereRaw('1 = 0');
      return;
    }
    const pkRef = alias ? `${alias}.${pk.column_name}` : pk.column_name;
    qb.whereRaw(
      rowIdType === 'bigint'
        ? '?? = ANY(?::bigint[])'
        : '??::text = ANY(?::text[])',
      [pkRef, rowIds.map((id) => `${id}`)],
    );
  };
}

/**
 * Bytes `target`'s cells take in the shared table, about: their stored values
 * plus a row header and keys each, without the indexes.
 */
export async function searchTargetSize(knex: Knex, target: SearchTarget) {
  const scope = scopeWhere(target);
  try {
    const result = await knex.raw(
      `SELECT COALESCE(sum(COALESCE(pg_column_size(txt), 0)
                          + COALESCE(pg_column_size(refs), 0) + 72), 0)::bigint AS n
       FROM ?? WHERE ${scope.sql}`,
      [target.path, ...scope.bindings],
    );
    return Number(result?.rows?.[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export function logSearchIndexError(message: string, e: unknown) {
  logger.error(`${message}: ${shortError(e)}`);
}

export function logSearchIndexWarning(message: string) {
  logger.warn(message);
}

export function logSearchIndexInfo(message: string) {
  logger.log(message);
}

// Knex prefixes the full SQL (with every bound id) to a driver error.
function shortError(e: unknown) {
  const text = `${(e as Error)?.message ?? e}`;
  return text.length > 300 ? `…${text.slice(-300)}` : text;
}
