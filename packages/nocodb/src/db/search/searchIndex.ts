import { randomUUID } from 'crypto';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { SearchIndexBuildSummary } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { DependencyPath, IndexField } from '~/db/search/searchIndexFields';
import type { IndexRowsOptions } from '~/db/search/searchIndexStore';
import type {
  SearchDependent,
  SearchIndexBuild,
  SearchIndexField,
  SearchIndexMeta,
  SearchIndexResume,
} from '~/db/search/searchIndexMeta';
import { Column, Model, Source } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import {
  cellKindOf,
  fieldExpressionVersion,
  resolveIndexFields,
} from '~/db/search/searchIndexFields';
import { searchIndexServerKey } from '~/db/search/searchIndexServer';
import {
  clearSearchIndexStale,
  detachedContext,
  getRawSearchIndexMeta,
  getSearchDependents,
  getSearchIndexMeta,
  getSearchIndexMode,
  getSearchJunctionFor,
  isSearchIndexingEnabled,
  patchSearchIndexMeta,
  replaceSearchDependents,
  SEARCH_INDEX_FORMAT,
} from '~/db/search/searchIndexMeta';
import {
  attachSearchBuildTable,
  clearSearchTarget,
  createSearchBuildTable,
  deleteGoneRowCells,
  deleteSearchCellsPast,
  deleteSearchFieldCells,
  dropLegacySearchTables,
  dropSearchBuildTable,
  dropSearchPartitions,
  dropSearchTables,
  ensureSearchTables,
  indexRows,
  installSearchExtensions,
  isMissingPartition,
  logSearchIndexError,
  logSearchIndexInfo,
  logSearchIndexWarning,
  markRowsDirty,
  rowIdTypeFor,
  searchBuildTarget,
  searchClause,
  searchExtensionBlocker,
  searchLiveTarget,
  searchTableExists,
  settleSearchTable,
  trigramReadsUnicode,
} from '~/db/search/searchIndexStore';
import { searchEnvInt, searchEnvNumber } from '~/db/search/searchEnv';

export {
  getSearchDependents,
  getSearchIndexMeta,
  logSearchIndexError,
  SEARCH_INDEX_FORMAT,
};
export type { SearchIndexMeta };

const BUILD_HEARTBEAT_MS = 30_000;
/** A build not heartbeaten for this long was left by a dead process. */
const BUILD_STALE_MS = 120_000;

const time = (value?: string | Date) =>
  value ? new Date(value).getTime() : Number.NaN;

export function isSearchIndexBuildStale(meta: SearchIndexMeta | undefined) {
  if (!meta?.build) return false;
  return Date.now() - time(meta.build.heartbeat_at) > BUILD_STALE_MS;
}

/** Failed builds in a row after which only an explicit build tries again. */
export const SEARCH_INDEX_MAX_FAILURES = 5;
/** Wait after a first failure; doubled for each one after it. */
const RETRY_BASE_MS = 30 * 60_000;
/**
 * Builds stopped by a shutdown in a row that don't count as failures: a deploy
 * or two. Past it each counts, as an orchestrator also stops a process with
 * SIGTERM when the build is what hurts it.
 */
export const SEARCH_INDEX_FREE_INTERRUPTS = 2;

/**
 * Whether a build or rebuild started in the background should wait after
 * failed ones: an exponential backoff, then not at all past the cap.
 */
export function isSearchIndexBackingOff(meta: SearchIndexMeta | undefined) {
  const retryAt = searchIndexRetryAt(meta);
  if (retryAt === undefined) return false;
  return retryAt === null || Date.now() < time(retryAt);
}

const BUILD_ERROR_KEY = 'search_index:build_error';
const BUILD_ERROR_TTL_S = 30 * 24 * 60 * 60;
const buildErrorKey = (modelId: string) => `${BUILD_ERROR_KEY}:${modelId}`;

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EPIPE',
]);

/**
 * A failed build's cause as shown to base owners: a fixed text per known
 * error class. The driver's message (hosts, IPs, provider wording) stays in
 * the logs.
 */
export function searchIndexErrorCause(e: unknown) {
  const code = `${(e as { code?: unknown })?.code ?? ''}`;
  if (code === '42501' || code === '0A000' || code === '58P01') {
    return 'The database does not allow the search extensions (pg_trgm, btree_gin)';
  }
  if (code === '57014') return 'The database timed out building the index';
  if (code.startsWith('53')) {
    return 'The database ran out of resources building the index';
  }
  if (
    code.startsWith('08') ||
    code === '57P01' ||
    CONNECTION_ERROR_CODES.has(code) ||
    /Timeout acquiring a connection/i.test(`${(e as Error)?.message ?? ''}`)
  ) {
    return 'The connection to the database failed';
  }
  return 'Index build failed';
}

/**
 * A failed build's cause, for the status API only: kept out of the model
 * meta, which every member's client receives.
 */
async function recordBuildError(modelId: string, e: unknown) {
  await NocoCache.setExpiring(
    'root',
    buildErrorKey(modelId),
    { error: searchIndexErrorCause(e), at: new Date().toISOString() },
    BUILD_ERROR_TTL_S,
  ).catch(() => undefined);
}

export async function getSearchIndexBuildError(
  modelId: string,
): Promise<string | undefined> {
  const value = await NocoCache.get(
    'root',
    buildErrorKey(modelId),
    CacheGetType.TYPE_OBJECT,
  ).catch(() => null);
  return (value as { error?: string } | null)?.error;
}

/** Failed builds in a row; one recorded before the count was kept counts as one. */
export const searchIndexFailures = (meta: SearchIndexMeta | undefined) =>
  meta?.failures ?? (meta?.failed_at ? 1 : 0);

/**
 * When a background build may run again after failed ones: undefined with no
 * failure, null past the cap (only an explicit build retries).
 */
export function searchIndexRetryAt(
  meta: SearchIndexMeta | undefined,
): string | null | undefined {
  const failures = searchIndexFailures(meta);
  if (!failures) return undefined;
  if (failures >= SEARCH_INDEX_MAX_FAILURES) return null;
  return new Date(
    time(meta.failed_at) + RETRY_BASE_MS * 2 ** (failures - 1),
  ).toISOString();
}

/**
 * Writes are tracked on an indexed table (held while it first builds, kept
 * for a build to resume) and on any table an index reads through a link or
 * lookup.
 */
export function isSearchIndexTracked(model: Model) {
  if (!isSearchIndexingEnabled()) return false;
  const meta = getSearchIndexMeta(model);
  return (
    meta?.state === 'building' ||
    meta?.state === 'ready' ||
    !!meta?.resume ||
    getSearchDependents(model).length > 0
  );
}

/**
 * Whether a write to the table links or unlinks rows some index shows: a
 * junction, auto-created or custom, of a many-to-many link an index reads.
 * From the cached model meta: a junction no index reads costs nothing.
 */
export function isSearchIndexJunction(model: Model) {
  if (!isSearchIndexingEnabled()) return false;
  return getSearchJunctionFor(model).length > 0;
}

/**
 * Where a stopped build left off: kept by its end, or still on a build whose
 * process died. Undefined when none.
 */
function stoppedBuildResume(
  meta: SearchIndexMeta | undefined,
): SearchIndexResume | undefined {
  if (meta?.resume) return meta.resume;
  const build = meta?.build;
  if (!build || build.after === undefined || !isSearchIndexBuildStale(meta)) {
    return undefined;
  }
  return {
    after: build.after,
    started_at: build.started_at,
    fields: build.fields ?? [],
    ...(build.in_place && { in_place: true }),
    ...(build.table && { table: build.table }),
  };
}

/**
 * A first build stopped part way that the next one goes on with: the marks
 * of rows it wrote before then are still owed to its index.
 */
export function isSearchIndexResumePending(meta: SearchIndexMeta | undefined) {
  return meta?.state !== 'ready' && !!stoppedBuildResume(meta);
}

/**
 * The resume point of a stopped build writing the same `ids` the same way,
 * none of them changed since it began.
 */
function resumeOf(
  previous: SearchIndexMeta | undefined,
  ids: string[],
  {
    serving,
    rowIdType,
    fields,
  }: {
    serving: boolean;
    rowIdType: string;
    fields: Record<string, SearchIndexField>;
  },
) {
  const resume = stoppedBuildResume(previous);
  if (!resume || !!resume.in_place !== serving) return undefined;
  if (previous.row_id_type !== rowIdType) return undefined;
  const same =
    resume.fields.length === ids.length &&
    ids.every((id) => resume.fields.includes(id));
  if (!same) return undefined;
  // A field changed since: marked on a served index, or with other settings
  // than its stamp where nothing marks it (a stopped first build).
  const changed = ids.some((id) => {
    const was = previous.fields?.[id];
    if (!!was?.marked_at && was.marked_at > resume.started_at) return true;
    return was?.v !== fields[id]?.v || was?.d !== fields[id]?.d;
  });
  return changed ? undefined : resume;
}

/** Writes wait while the table has no index yet but one is being built. */
export function isSearchIndexHoldingWrites(meta: SearchIndexMeta | undefined) {
  return meta?.state === 'building' && !!meta.build;
}

/**
 * A field the index answers for: fully indexed with the current expression
 * and column settings. A type change or option rename rewrites cells without
 * hooks, so the field isn't searched until a rebuild writes it.
 */
export function isColumnServedByIndex(
  column: Column,
  meta: SearchIndexMeta | undefined,
) {
  if (meta?.state !== 'ready') return false;
  const field = meta.fields?.[column.id];
  return !!field?.built_at && field.v === fieldExpressionVersion(column);
}

// Live-matched through a per-row subquery or expression: a full scan's cost.
const SLOW_LIVE_TYPES = new Set<string>([
  UITypes.Formula,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.User,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]);

/** A field the index doesn't cover whose live condition costs a full scan. */
export function isSlowLiveField(column: Column) {
  return SLOW_LIVE_TYPES.has(column.uidt);
}

/**
 * Whether pg_trgm extracts a trigram from `%term%`. It pads a word with two
 * blanks after a literal non-word character and one before one, so `a_b`
 * and `-ab` qualify; `ab` and a bare `東京` don't.
 */
export function likeHasTrigram(term: string, unicodeWords: boolean) {
  const words = unicodeWords ? /[\p{L}\p{N}]+/gu : /[A-Za-z0-9]+/g;
  for (const m of term.matchAll(words)) {
    const end = m.index + m[0].length;
    const padded =
      [...m[0]].length + (m.index > 0 ? 2 : 0) + (end < term.length ? 1 : 0);
    if (padded >= 3) return true;
  }
  return false;
}

/** `%term%` with ILIKE's wildcards escaped. */
export function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The term as an ILIKE pattern, or undefined when the index can't narrow it. */
export async function toSearchPattern(knex: Knex, term: string) {
  if (!likeHasTrigram(term, await trigramReadsUnicode(knex))) return undefined;
  return likePattern(term);
}

export function updatedAtColumn(model: Model) {
  return model.columns?.find(
    (c) => c.uidt === UITypes.LastModifiedTime && c.system && c.column_name,
  );
}

/** Inserts leave UpdatedAt NULL; CreatedAt marks them. */
export function createdAtColumn(model: Model) {
  return model.columns?.find(
    (c) => c.uidt === UITypes.CreatedTime && c.system && c.column_name,
  );
}

/**
 * Rows last written after `at`, by UpdatedAt or else CreatedAt. Compared
 * apart rather than through COALESCE, so an index on either can be used.
 */
export function stampAfterSql(knex: Knex, model: Model, at: string) {
  const updated = updatedAtColumn(model);
  const created = createdAtColumn(model);
  if (updated && created) {
    return knex.raw('(?? > ? OR (?? IS NULL AND ?? > ?))', [
      updated.column_name,
      at,
      updated.column_name,
      created.column_name,
      at,
    ]);
  }
  const only = updated ?? created;
  return only ? knex.raw('?? > ?', [only.column_name, at]) : undefined;
}

/** Clock skew between app instances and the database. */
export const SEARCH_INDEX_SLACK_MS = 5_000;

const buildsInProgress = new Set<string>();
/** Running builds in this process by build id: each marks itself interrupted. */
const buildInterrupts = new Map<string, () => Promise<void>>();

/**
 * On shutdown: mark this process's builds interrupted and stale at once, so
 * another instance takes them over without waiting, and stop them.
 */
export async function interruptSearchIndexBuilds() {
  await Promise.all([...buildInterrupts.values()].map((stop) => stop()));
}
/** Builds in this process not done yet, their onReady catch-up included. */
let runningBuilds = 0;
export const searchIndexBuildsRunning = () => runningBuilds;
/** Build jobs this process queued and hasn't started; counted down where they run. */
let queuedBuilds = 0;
export const searchIndexBuildsQueued = () => queuedBuilds;
export function countQueuedSearchIndexBuild(delta: 1 | -1) {
  queuedBuilds = Math.max(0, queuedBuilds + delta);
}

/**
 * Backfills running at once on one database server, across the instances
 * sharing the cache; per process without a cache.
 */
function maxConcurrentBuilds() {
  return searchEnvInt('NC_SEARCH_INDEX_MAX_BUILDS', 2);
}

const BUILD_SLOT_KEY = 'search_index:build_slot';
/** Builds running in this process, by database server. */
const localBackfills = new Map<string, number>();
const countLocalBackfill = (server: string, delta: 1 | -1) => {
  const n = (localBackfills.get(server) ?? 0) + delta;
  if (n > 0) localBackfills.set(server, n);
  else localBackfills.delete(server);
};

interface BuildSlot {
  renew(): void;
  release(): Promise<void>;
}

/**
 * One of `server`'s backfill slots, or undefined when all are taken. A slot
 * held by a dead process lapses after `BUILD_STALE_MS`; a build renews its own.
 */
async function takeBuildSlot(
  holder: string,
  server: string,
): Promise<BuildSlot | undefined> {
  const max = maxConcurrentBuilds();
  if ((localBackfills.get(server) ?? 0) >= max) return undefined;
  countLocalBackfill(server, 1);
  const ttl = Math.ceil(BUILD_STALE_MS / 1000);
  for (let i = 0; i < max; i++) {
    const key = `${BUILD_SLOT_KEY}:${server}:${i}`;
    // An unreachable cache leaves the per-process cap.
    const taken = await NocoCache.setIfNotExist('root', key, holder, ttl).catch(
      (e) => {
        logSearchIndexError('Search index build slot check failed', e);
        return true;
      },
    );
    if (!taken) continue;
    let released = false;
    return {
      renew: () => {
        NocoCache.expireIfValue('root', key, holder, ttl).catch((e) =>
          logSearchIndexError('Search index build slot renewal failed', e),
        );
      },
      release: async () => {
        if (released) return;
        released = true;
        countLocalBackfill(server, -1);
        await NocoCache.delIfValue('root', key, holder).catch(() => undefined);
      },
    };
  }
  countLocalBackfill(server, -1);
  return undefined;
}

export const hasUnbuiltFields = (meta: SearchIndexMeta) =>
  Object.values(meta.fields ?? {}).some((f) => !f.built_at);

// undefined_table, invalid_schema_name: side tables not created yet, or
// dropped; or the table's partition is gone.
const MISSING_TABLE_CODES = new Set(['42P01', '3F000']);
export const isMissingTable = (e: unknown) =>
  MISSING_TABLE_CODES.has((e as { code?: string })?.code) ||
  isMissingPartition(e);

async function loadModel(context: NcContext, modelId: string) {
  const model = await Model.get(context, modelId);
  if (model) await model.getColumns();
  return model;
}

export async function getModelSql(
  context: NcContext,
  model: Model,
  knex: Knex,
) {
  return Model.getBaseModelSQL(context, { model, dbDriver: knex });
}

/**
 * Why `model` can't have an index, or undefined when it can. `retry` is for an
 * explicit build, which tries a recently refused extension install again.
 */
export async function searchIndexBlocker(
  context: NcContext,
  model: Model,
  knex?: Knex,
  opts?: { retry?: boolean },
) {
  const source = await Source.get(context, model.source_id);
  if (!source?.isMeta() || !/^(pg|postgres)/.test(source.type ?? '')) {
    return 'A search index needs a table in the built-in PostgreSQL database';
  }
  if (!model.primaryKey || model.primaryKeys?.length > 1) {
    return 'A search index needs a table with a single primary key';
  }
  if (!updatedAtColumn(model) || !createdAtColumn(model)) {
    return 'A search index needs a table with created and last modified time fields';
  }
  return knex ? searchExtensionBlocker(knex, opts) : undefined;
}

/** Cells (rows × fields) past which only an explicit build indexes a table; 0 or below = no limit. */
export function searchIndexAutoMaxCells() {
  return Math.max(
    0,
    searchEnvNumber('NC_SEARCH_INDEX_AUTO_MAX_CELLS', 5_000_000, -Infinity),
  );
}

const SIZE_COUNT_TIMEOUT_MS = 5_000;

/**
 * Rows per Postgres' statistics; a table never analyzed is counted up to
 * `cap`. A read that fails or runs out of time answers `cap`: over budget.
 */
async function estimateRowCount(
  context: NcContext,
  model: Model,
  knex: Knex,
  cap: number,
): Promise<number> {
  const baseModel = await getModelSql(context, model, knex);
  const stats = await knex
    .raw(
      `SELECT c.reltuples::float8 AS n
         FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
        WHERE s.nspname = COALESCE(?, current_schema()) AND c.relname = ?`,
      [baseModel.schema ?? null, model.table_name],
    )
    .catch(() => null);
  if (!stats) return cap;
  const estimate = Number(stats.rows?.[0]?.n);
  if (estimate > 0) return estimate;
  const table =
    typeof baseModel.tnPath === 'string'
      ? knex.raw('??', [baseModel.tnPath])
      : baseModel.tnPath;
  const counted = await knex
    .transaction(async (trx) => {
      await trx.raw(`SET LOCAL statement_timeout = ${SIZE_COUNT_TIMEOUT_MS}`);
      return trx.raw(
        'SELECT count(*)::float8 AS n FROM (SELECT 1 FROM ? LIMIT ?) t',
        [table, cap],
      );
    })
    .catch(() => null);
  const n = counted?.rows?.[0]?.n;
  return n === undefined || n === null ? cap : Number(n);
}

/**
 * Why a background first build of `model` waits for an explicit one: it is
 * estimated past {@link searchIndexAutoMaxCells}. A build with saved progress
 * goes on.
 */
export async function searchIndexSizeBlocker(
  context: NcContext,
  model: Model,
  knex: Knex,
) {
  const max = searchIndexAutoMaxCells();
  if (
    !max ||
    getSearchIndexMeta(model)?.resume ||
    getSearchIndexMode(model) === 'on'
  ) {
    return undefined;
  }
  const columns = await model.getColumns();
  const fields = columns.filter((c) => cellKindOf(c, columns)).length;
  if (!fields) return undefined;
  const rows = await estimateRowCount(
    context,
    model,
    knex,
    Math.floor(max / fields) + 1,
  );
  if (rows * fields <= max) return undefined;
  return `About ${Math.round(
    rows * fields,
  )} cells, over the ${max} an automatic build writes: build it explicitly`;
}

const SIZE_VERDICT_TTL_MS = 10 * 60_000;
const sizeVerdicts = new Map<
  string,
  { at: number; max: number; reason: string | undefined }
>();

/**
 * {@link searchIndexSizeBlocker} for a table without an index, remembered a
 * while per table: searches ask on every keystroke.
 */
export async function searchIndexTooLarge(
  context: NcContext,
  model: Model,
  knex: Knex,
) {
  if (getRawSearchIndexMeta(model)) return undefined;
  const max = searchIndexAutoMaxCells();
  const cached = sizeVerdicts.get(model.id);
  if (
    cached &&
    cached.max === max &&
    Date.now() - cached.at < SIZE_VERDICT_TTL_MS
  ) {
    return cached.reason;
  }
  const reason = await searchIndexSizeBlocker(context, model, knex).catch(
    () => undefined,
  );
  if (sizeVerdicts.size > 10_000) sizeVerdicts.clear();
  sizeVerdicts.set(model.id, { at: Date.now(), max, reason });
  return reason;
}

/** Point every table this index reads through at it, replacing old entries. */
async function registerDependents(
  context: NcContext,
  modelId: string,
  previousTables: string[],
  resolved: IndexField[],
) {
  const byTable = new Map<string, Required<SearchDependent>[]>();
  for (const field of resolved) {
    for (const path of field.paths) {
      const list = byTable.get(path.end) ?? [];
      let entry = list.find((d) => d.links.join() === path.links.join());
      if (!entry) {
        entry = { table_id: modelId, links: path.links, fields: [] };
        list.push(entry);
      }
      if (!entry.fields.includes(field.column.id)) {
        entry.fields.push(field.column.id);
      }
      byTable.set(path.end, list);
    }
  }
  const junctions = await pathJunctions(
    context,
    resolved.flatMap((f) => f.paths),
  );
  const tables = new Set([...previousTables, ...byTable.keys(), ...junctions]);
  for (const tableId of tables) {
    await replaceSearchDependents(
      context,
      tableId,
      modelId,
      byTable.get(tableId) ?? [],
      junctions.has(tableId),
    );
  }
  return [...new Set([...byTable.keys(), ...junctions])];
}

/** Same-base junction tables of the many-to-many links along `paths`. */
async function pathJunctions(context: NcContext, paths: DependencyPath[]) {
  const junctions = new Set<string>();
  for (const colId of new Set(paths.flatMap((p) => p.links))) {
    const link = await Column.get(context, { colId });
    const options = await link
      ?.getColOptions<LinkToAnotherRecordColumn>()
      .catch(() => undefined);
    if (
      options?.type === RelationTypes.MANY_TO_MANY &&
      options.fk_mm_model_id &&
      (!options.fk_mm_base_id || options.fk_mm_base_id === context.base_id)
    ) {
      junctions.add(options.fk_mm_model_id);
    }
  }
  return junctions;
}

/** The version stamp of each field the index can hold. */
function fieldVersions(fields: IndexField[]) {
  const map: Record<string, SearchIndexField> = {};
  for (const field of fields) map[field.column.id] = fieldStamp(field);
  return map;
}

function fieldStamp(field: IndexField): SearchIndexField {
  const stamp: SearchIndexField = { v: fieldExpressionVersion(field.column) };
  if (field.linkedDigest) stamp.d = field.linkedDigest;
  return stamp;
}

/** Columns of `model` the documents are written from. */
function indexedColumns(
  model: Model,
  fields: Record<string, SearchIndexField>,
): Column[] {
  return (model.columns ?? []).filter((c) => fields[c.id]);
}

/**
 * The build's fields as written at `startedAt`, except fields marked or added
 * after `before` was read: those stay unbuilt for the next rebuild.
 */
function builtFields(
  built: Record<string, SearchIndexField>,
  before: Record<string, SearchIndexField> | undefined,
  current: Record<string, SearchIndexField> | undefined,
  startedAt: string,
) {
  const fields: Record<string, SearchIndexField> = {};
  for (const [id, f] of Object.entries(built)) {
    fields[id] = { ...f, built_at: startedAt };
  }
  for (const [id, f] of Object.entries(current ?? {})) {
    const markedSince =
      !!f.marked_at && f.marked_at !== before?.[id]?.marked_at;
    if (!f.built_at && (!built[id] || markedSince)) fields[id] = f;
  }
  return fields;
}

/** The fields a ready index owes: not built, or built with other settings. */
function owedFields(
  previous: SearchIndexMeta,
  fields: Record<string, SearchIndexField>,
) {
  return Object.keys(fields).filter((id) => {
    const f = previous.fields[id];
    return !f?.built_at || f.v !== fields[id].v || f.d !== fields[id].d;
  });
}

/**
 * `current` with the fields an in-place build wrote stamped built, except
 * those removed or marked again since it started.
 */
function inPlaceBuiltFields(
  ids: string[],
  built: Record<string, SearchIndexField>,
  before: Record<string, SearchIndexField>,
  current: Record<string, SearchIndexField> | undefined,
  startedAt: string,
) {
  const fields = { ...current };
  for (const id of ids) {
    const was = before[id];
    const now = current?.[id];
    if (was && !now) continue;
    if (now?.marked_at && now.marked_at !== was?.marked_at) continue;
    fields[id] = { ...built[id], built_at: startedAt };
  }
  return fields;
}

/** Patch the index meta only while `buildId` is still the running build. */
function patchBuild(
  context: NcContext,
  modelId: string,
  buildId: string,
  patch: (meta: SearchIndexMeta) => SearchIndexMeta | false,
  opts?: { resetSyncedAt?: boolean },
) {
  return patchSearchIndexMeta(
    context,
    modelId,
    (meta) => (meta?.build?.id === buildId ? patch(meta) : false),
    opts,
  );
}

/**
 * `after`: where the build stopped, so the next one goes on from there. Not
 * kept past the failure cap: no build would come to use it.
 */
function endBuild(
  meta: SearchIndexMeta,
  error: string,
  after?: string | number,
): SearchIndexMeta {
  const { build, resume: _resume, ...rest } = meta;
  const paused = !!build?.paused;
  const interrupts =
    build?.interrupted && !paused
      ? (meta.interrupts ?? 0) + 1
      : meta.interrupts;
  const counted =
    !paused &&
    (!build?.interrupted || interrupts > SEARCH_INDEX_FREE_INTERRUPTS);
  const failures = counted ? (meta.failures ?? 0) + 1 : meta.failures;
  const failed: SearchIndexMeta = {
    ...rest,
    ...(after !== undefined &&
      build &&
      (failures ?? 0) < SEARCH_INDEX_MAX_FAILURES && {
        resume: {
          after,
          started_at: build.started_at,
          fields: build.fields ?? [],
          ...(build.in_place && { in_place: true }),
          ...(build.table && { table: build.table }),
        },
      }),
    error: paused
      ? 'Index build paused'
      : build?.interrupted
      ? 'Index build interrupted'
      : error,
    interrupts,
    ...(counted && {
      failed_at: new Date().toISOString(),
      failures,
    }),
  };
  return meta.state === 'building' ? { ...failed, state: 'failed' } : failed;
}

/**
 * A first build that failed: linked tables stop tracking writes for it,
 * unless a build will resume it.
 */
async function releaseFailedDependents(context: NcContext, modelId: string) {
  const meta = getSearchIndexMeta(await Model.get(context, modelId));
  if (meta?.state !== 'failed' || meta.resume || !meta.dep_tables?.length) {
    return;
  }
  const cleared = await patchSearchIndexMeta(context, modelId, (m) =>
    m?.state === 'failed' && !m.resume ? { ...m, dep_tables: [] } : false,
  );
  if (cleared) await registerDependents(context, modelId, meta.dep_tables, []);
}

/**
 * Fail a build whose process died and release held writes. Its cells and
 * marks stay for the next build to go on from where it stopped; a first
 * build that saved no progress loses its cells. Rows still being written by
 * the old build are left to the next pass.
 */
export async function failStaleSearchIndexBuild(
  context: NcContext,
  model: Model,
  knex?: Knex,
) {
  const meta = getSearchIndexMeta(model);
  if (!meta?.build || !isSearchIndexBuildStale(meta)) return false;
  const after = endBuild(meta, '', meta.build.after).resume?.after;
  // A first build's own table, unless a build can go on from it.
  if (knex && meta.state === 'building' && after === undefined) {
    const dropped = meta.build.table
      ? await dropSearchBuildTable(
          knex,
          model,
          { path: meta.build.table, modelId: model.id },
          { waitMs: 100 },
        ).catch(() => true)
      : true;
    if (!dropped) return false;
    await clearSearchTarget(knex, searchLiveTarget(model), {
      cells: false,
      marks: 'own',
    }).catch(() => undefined);
  }
  const failed = await patchBuild(context, model.id, meta.build.id, (m) =>
    endBuild(m, 'Index build stopped', after),
  );
  if (!failed) return false;
  logSearchIndexWarning(`Search index build for ${model.id} went stale`);
  await releaseFailedDependents(context, model.id).catch((e) =>
    logSearchIndexError(`Search index cleanup failed for ${model.id}`, e),
  );
  return true;
}

export interface BuildOptions {
  /** After the new table is served; `since` is when its backfill started. */
  onReady?: (model: Model, since: string) => Promise<void>;
  /** A user's rebuild: every field, rewritten in place when served. */
  explicit?: boolean;
}

export interface SearchIndexBuildStart {
  meta: SearchIndexMeta;
  /** Settles when the build started by this call ends; unset when none started. */
  done?: Promise<void>;
  /** Every backfill slot was taken. */
  noSlot?: boolean;
}

/**
 * The model, if it can be indexed: a 400 otherwise, before any claim, so a
 * refusal comes back to the caller instead of after a backfill.
 */
export async function prepareSearchIndexBuild(
  context: NcContext,
  modelId: string,
  knex: Knex,
) {
  const model = await loadModel(context, modelId);
  if (!model) NcError.get(context).tableNotFound(modelId);
  const blocker = await searchIndexBlocker(context, model, knex, {
    retry: true,
  });
  if (blocker) NcError.get(context).badRequest(blocker);
  const denied = await installSearchExtensions(knex);
  if (denied) NcError.get(context).badRequest(denied);
  return model;
}

/**
 * Build (or rebuild) a table's index. A ready index is rewritten in place and
 * keeps serving, as writes made meanwhile are caught up by UpdatedAt;
 * otherwise the cells are written directly and writes are held until the
 * first build is ready. A build stopped part way is resumed where it left off.
 */
export async function buildSearchIndex(
  context: NcContext,
  modelId: string,
  knex: Knex,
  opts: BuildOptions = {},
): Promise<SearchIndexBuildStart> {
  context = detachedContext(context);
  // Claimed before the first await, so two calls here can't both start.
  if (buildsInProgress.has(modelId)) {
    return { meta: getSearchIndexMeta(await Model.get(context, modelId)) };
  }
  buildsInProgress.add(modelId);
  let running = false;
  try {
    const result = await startBuild(context, modelId, knex, opts);
    running = !!result.done;
    return result;
  } finally {
    if (!running) buildsInProgress.delete(modelId);
  }
}

async function startBuild(
  context: NcContext,
  modelId: string,
  knex: Knex,
  opts: BuildOptions,
): Promise<SearchIndexBuildStart> {
  const model = await prepareSearchIndexBuild(context, modelId, knex);

  const previous = getSearchIndexMeta(model);
  // A build heartbeating elsewhere stands; a stale one is replaced.
  if (previous?.build && !isSearchIndexBuildStale(previous)) {
    return { meta: previous };
  }

  const buildId = randomUUID();
  // Before the claim: a table waiting for a slot holds no writes.
  const slot = await takeBuildSlot(
    `${process.pid}:${buildId}`,
    await searchIndexServerKey(context),
  );
  if (!slot) return { meta: previous, noSlot: true };
  try {
    return await claimAndRun(context, model, knex, opts, buildId, slot);
  } catch (e) {
    await slot.release();
    throw e;
  }
}

async function claimAndRun(
  context: NcContext,
  model: Model,
  knex: Knex,
  { onReady, explicit }: BuildOptions,
  buildId: string,
  slot: BuildSlot,
): Promise<SearchIndexBuildStart> {
  const modelId = model.id;
  const previous = getSearchIndexMeta(model);
  const rowIdType = rowIdTypeFor(model);
  const resolved = await resolveIndexFields(context, model);
  const fields = fieldVersions(resolved);
  const fieldIds = Object.keys(fields);
  const serving =
    previous?.state === 'ready' &&
    previous.row_id_type === rowIdType &&
    !!updatedAtColumn(model);
  // A served index is rewritten in place: the owed fields, or every one when
  // asked. Nothing served: the live cells are written directly.
  const writes = serving && !explicit ? owedFields(previous, fields) : fieldIds;
  if (serving && !writes.length) {
    await slot.release();
    return { meta: previous };
  }
  const direct = !serving;
  // Every field: cells of rows and fields gone since go too.
  const full = writes.length === fieldIds.length;
  let resume = resumeOf(previous, writes, { serving, rowIdType, fields });
  // A first build goes on in its own table, which must still be there.
  if (
    resume &&
    direct &&
    !(resume.table && (await searchTableExists(knex, resume.table)))
  ) {
    resume = undefined;
  }
  const startedAt = resume?.started_at ?? new Date().toISOString();
  const live = searchLiveTarget(model);
  // Not served yet: written into a table of its own, then attached.
  const own = direct
    ? resume?.table
      ? { path: resume.table, modelId }
      : searchBuildTarget(model, buildId)
    : undefined;
  const build: SearchIndexBuild = {
    id: buildId,
    started_at: startedAt,
    heartbeat_at: new Date().toISOString(),
    fields: writes,
    ...(serving && { in_place: true }),
    ...(resume && { after: resume.after }),
    ...(own && { table: own.path }),
  };
  // Dependents first, so writes to linked tables are tracked from here on.
  const depTables = await registerDependents(
    context,
    modelId,
    previous?.dep_tables ?? [],
    resolved,
  );
  // Another instance may have claimed it since `previous` was read.
  const claimed = await patchSearchIndexMeta(context, modelId, (m) => {
    if (m?.build && !isSearchIndexBuildStale(m)) return false;
    if (serving) {
      if (m?.state !== 'ready') return false;
      const { resume: _resume, ...rest } = m;
      return { ...rest, dep_tables: depTables, build };
    }
    return {
      format: SEARCH_INDEX_FORMAT,
      state: 'building',
      row_id_type: rowIdType,
      fields,
      dep_tables: depTables,
      build,
      // Kept until a build is ready, so retries keep backing off.
      failures: m?.failures,
      failed_at: m?.failed_at,
      interrupts: m?.interrupts,
    };
  });
  if (!claimed) {
    await slot.release();
    return {
      meta: getSearchIndexMeta(await Model.get(context, modelId)) ?? previous,
    };
  }
  if (resume) {
    logSearchIndexInfo(
      `Search index build for ${modelId} resumes after row ${resume.after}`,
    );
  }

  const ownsBuild = async () =>
    getSearchIndexMeta(await Model.get(context, modelId))?.build?.id ===
    build.id;
  // A first build's table, and its marks unless another build owns them.
  const clearDirectCells = async () => {
    if (!own) return;
    // Not when a build that resumed into it owns it now.
    const now = getSearchIndexMeta(
      await Model.get(context, modelId).catch(() => undefined),
    );
    const taken =
      (now?.build?.id !== build.id && now?.build?.table === own.path) ||
      now?.resume?.table === own.path;
    if (!taken) {
      await dropSearchBuildTable(knex, model, own).catch(() => undefined);
    }
    await clearSearchTarget(knex, live, {
      cells: false,
      marks: 'own',
      keepIf: async () =>
        !(await ownsBuild()) && (await hasSearchIndexMeta(context, modelId)),
    }).catch(() => undefined);
  };

  // Every row up to this pk is written.
  let doneThrough = resume?.after;
  /** `resumable`: cells stay, so the next build goes on from `doneThrough`. */
  const failBuild = async (error: string, resumable = false) => {
    const current = getSearchIndexMeta(
      await Model.get(context, modelId).catch(() => undefined),
    );
    const after = !resumable
      ? undefined
      : current?.build?.id === build.id
      ? endBuild(current, error, doneThrough).resume?.after
      : doneThrough;
    if (direct && after === undefined) await clearDirectCells();
    await patchBuild(context, modelId, build.id, (m) =>
      endBuild(m, error, after),
    ).catch(() => undefined);
    await releaseFailedDependents(context, modelId).catch((e) =>
      logSearchIndexError(`Search index cleanup failed for ${modelId}`, e),
    );
  };

  let interrupted = false;
  // The slot is renewed until run() settles, so the cap counts a build still
  // stopping; an interrupted build no longer heartbeats its claim.
  const heartbeat = setInterval(() => {
    slot.renew();
    if (interrupted) return;
    patchBuild(context, modelId, build.id, (m) =>
      m.build?.interrupted
        ? false
        : {
            ...m,
            build: {
              ...m.build,
              heartbeat_at: new Date().toISOString(),
              ...(doneThrough !== undefined && { after: doneThrough }),
            },
          },
    ).catch((e) =>
      logSearchIndexError(`Search index heartbeat failed for ${modelId}`, e),
    );
  }, BUILD_HEARTBEAT_MS);
  heartbeat.unref?.();
  const stopIfInterrupted = async () => {
    if (interrupted) throw new Error('Index build interrupted');
  };
  // Dropped or taken over: a direct build stops writing the live cells.
  let replaced = false;
  const stopIfReplaced = async () => {
    await stopIfInterrupted();
    if (await ownsBuild()) return;
    replaced = true;
    throw new Error('Index build replaced');
  };
  const interrupt = async (opts?: { paused?: boolean }) => {
    interrupted = true;
    await patchBuild(context, modelId, build.id, (m) => ({
      ...m,
      build: {
        ...m.build,
        interrupted: true,
        ...(opts?.paused && { paused: true }),
        heartbeat_at: new Date(0).toISOString(),
        ...(doneThrough !== undefined && { after: doneThrough }),
      },
    })).catch((e) =>
      logSearchIndexError(`Search index interrupt failed for ${modelId}`, e),
    );
  };
  buildInterrupts.set(build.id, interrupt);

  // After the interrupt is registered: a shutdown during setup counts too.
  try {
    await ensureSearchTables(knex, model.base_id);
    if (direct && resume) {
      await deleteSearchCellsPast(
        await getModelSql(context, model, knex),
        own,
        resume.after,
      );
    } else if (direct) {
      // An earlier index's partition, or a dead build's table.
      await dropSearchPartitions(knex, model);
      await createSearchBuildTable(knex, own);
    }
  } catch (e) {
    buildInterrupts.delete(build.id);
    clearInterval(heartbeat);
    // Release the claim now rather than holding writes until it goes stale.
    await recordBuildError(modelId, e);
    await failBuild('Index build failed', true);
    throw e;
  }

  // Released before onReady, so a follow-up build it starts isn't refused.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    buildsInProgress.delete(modelId);
  };

  let rowsWritten = 0;
  const counting =
    (check: () => Promise<void>) => async (ids: Array<string | number>) => {
      rowsWritten += ids.length;
      await check();
    };
  const summarize = (
    kind: SearchIndexBuildSummary['kind'],
  ): SearchIndexBuildSummary => {
    const finishedAt = new Date();
    return {
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - Date.parse(startedAt),
      rows: rowsWritten,
      fields: writes.length,
      kind,
    };
  };

  const run = async () => {
    await stopIfInterrupted();
    const baseModel = await getModelSql(context, model, knex);
    const written = Object.fromEntries(writes.map((id) => [id, fields[id]]));
    // Marks stay: a row written meanwhile is flushed with every field.
    await indexRows(
      baseModel,
      own ?? live,
      indexedColumns(model, written),
      null,
      {
        after: resume?.after,
        onProgress: (id) => {
          doneThrough = id;
        },
        keepDirty: true,
        // Checked before each write: a build taken over stops writing.
        beforeChunk: stopIfReplaced,
        // Indexing turned off: stops like a shutdown, to resume when back on.
        onChunk: counting(async () => {
          if (!interrupted && !isSearchIndexingEnabled()) {
            await interrupt({ paused: true });
          }
          await stopIfInterrupted();
        }),
        ...(direct ? { firstBuild: true } : { scoped: !full }),
      },
    );
    await stopIfInterrupted();
    if (serving && full) await deleteGoneRowCells(baseModel, live, rowIdType);
    // Dropped or taken over meanwhile: a direct build's cells aren't wanted.
    if (!(await ownsBuild())) {
      if (direct) await clearDirectCells();
      return;
    }
    if (direct) {
      // Rows deleted while it was stopped.
      if (resume) await deleteGoneRowCells(baseModel, own, rowIdType, true);
      await dropSearchPartitions(knex, model, { except: own.path });
      await attachSearchBuildTable(knex, own, stopIfReplaced);
    } else if (full) {
      await settleSearchTable(knex, model);
    }
    await slot.release();
    clearInterval(heartbeat);
    const summary = summarize(direct ? 'direct' : full ? 'full' : 'fields');
    const ready = await patchBuild(
      context,
      modelId,
      build.id,
      (m) =>
        full
          ? {
              format: SEARCH_INDEX_FORMAT,
              state: 'ready',
              row_id_type: rowIdType,
              fields: builtFields(
                fields,
                previous?.fields,
                m.fields,
                startedAt,
              ),
              dep_tables: depTables,
              built_at: startedAt,
              last_build: summary,
            }
          : {
              ...withoutBuildState(m),
              fields: inPlaceBuiltFields(
                writes,
                fields,
                previous?.fields ?? {},
                m.fields,
                startedAt,
              ),
              last_build: summary,
            },
      { resetSyncedAt: full },
    );
    if (!ready) {
      // Dropped meanwhile: the cells just written aren't wanted.
      if (!(await hasSearchIndexMeta(context, modelId))) {
        await dropSearchTables(knex, model);
      }
      return;
    }
    logSearchIndexInfo(
      `Search index built for ${modelId} (${summary.kind}): ${summary.rows} rows, ${summary.fields} fields in ${summary.duration_ms} ms`,
    );
    if (full) await dropLegacySearchTables(knex, model).catch(() => undefined);
    await NocoCache.del('root', buildErrorKey(modelId)).catch(() => undefined);
    release();
    // The build read every row written before it started.
    if (full) await clearSearchIndexStale(context, modelId, startedAt);
    // Rows written while it ran may have been read before the write.
    await onReady?.(model, startedAt);
  };

  runningBuilds++;
  const done = run()
    .catch(async (e) => {
      if (replaced) {
        if (direct) await clearDirectCells();
        return;
      }
      logSearchIndexError(`Search index build failed for ${modelId}`, e);
      await recordBuildError(modelId, e);
      // A shutdown stops it part way: the next build goes on from there.
      await failBuild('Index build failed', interrupted);
    })
    .finally(() => {
      buildInterrupts.delete(build.id);
      clearInterval(heartbeat);
      release();
      runningBuilds--;
      void slot.release();
    });

  const meta = await Model.get(context, modelId)
    .then(getSearchIndexMeta)
    .catch(() => undefined);
  return { meta: meta ?? previous, done };
}

/** `meta` without a build or what the last one left: a build is done. */
function withoutBuildState(meta: SearchIndexMeta): SearchIndexMeta {
  const {
    build: _build,
    resume: _resume,
    error: _error,
    failed_at: _failedAt,
    failures: _failures,
    interrupts: _interrupts,
    ...rest
  } = meta;
  return rest;
}

/** Whether `modelId` has index meta now, of any state or format. */
async function hasSearchIndexMeta(context: NcContext, modelId: string) {
  return !!getRawSearchIndexMeta(await Model.get(context, modelId));
}

export async function dropSearchIndex(
  context: NcContext,
  modelId: string,
  knex: Knex,
) {
  context = detachedContext(context);
  const model = await loadModel(context, modelId);
  if (!model) NcError.get(context).tableNotFound(modelId);
  const meta = getRawSearchIndexMeta(model);
  await patchSearchIndexMeta(context, modelId, (m) => (m ? null : false));
  await registerDependents(context, modelId, meta?.dep_tables ?? [], []);
  // A build claimed since writes its own cells.
  if (!(await hasSearchIndexMeta(context, modelId))) {
    await dropSearchTables(knex, model);
  }
}

/** A hard-deleted table: its side tables and its dependents entries. */
export async function cleanupDeletedSearchIndex(
  context: NcContext,
  model: Model,
  knex: Knex,
) {
  const meta = getSearchIndexMeta(model);
  if (meta?.dep_tables?.length) {
    await registerDependents(context, model.id, meta.dep_tables, []);
  }
  // Side tables exist only on PostgreSQL. Not waited for: a large table's
  // documents take a while to delete, and nothing can index it again.
  if (/^(pg|postgres)/.test(String(knex.client?.config?.client ?? ''))) {
    void dropSearchTables(knex, model).catch((e) =>
      logSearchIndexError(`Search index cleanup failed for ${model.id}`, e),
    );
  }
}

/** Index the given rows (null = every row) of a ready table. */
export async function refreshSearchIndex(
  context: NcContext,
  model: Model,
  knex: Knex,
  ids: Array<string | number> | null,
  {
    onlyFields,
    ...opts
  }: IndexRowsOptions & {
    /** Re-derive only these fields, leaving the rows' other cells. */
    onlyFields?: ReadonlySet<string>;
  } = {},
) {
  const meta = getSearchIndexMeta(model);
  if (meta?.state !== 'ready') return;
  await model.getColumns();
  const live = searchLiveTarget(model);
  const baseModel = await getModelSql(context, model, knex);
  let fields = indexedColumns(model, meta.fields);
  if (onlyFields) {
    fields = fields.filter((c) => onlyFields.has(c.id));
    if (!fields.length) return;
  }
  try {
    await indexRows(
      baseModel,
      live,
      fields,
      ids,
      onlyFields ? { ...opts, scoped: true } : opts,
    );
  } catch (e) {
    const missing =
      isMissingPartition(e) ||
      !(await searchTableExists(knex, live.path).catch(() => true));
    if (!missing) throw e;
    // Meta without cells (a copied table, a dropped schema): stop serving.
    await patchSearchIndexMeta(context, model.id, (m) =>
      m?.state === 'ready' && !m.build
        ? {
            ...m,
            state: 'failed',
            error: 'Search table missing',
            failed_at: new Date().toISOString(),
          }
        : false,
    );
    return;
  }
}

/**
 * Mark rows as not re-indexed yet, so a search finds them before the flush
 * job rewrites them. The marks are that job's queue, also for a first build
 * running or to resume: it flushes them once ready. On a table only other
 * indexes read, they are written for it alone. `propagate`: the rows were
 * written, so the flush walks them to those indexes. Resolves to whether a
 * mark was written.
 */
export async function markSearchIndexDirty(
  model: Model,
  knex: Knex,
  ids: Array<string | number>,
  {
    propagate = false,
    fields,
  }: { propagate?: boolean; fields?: string[] } = {},
) {
  if (!ids.length) return false;
  const meta = getSearchIndexMeta(model);
  const tracked =
    meta?.state === 'ready' ||
    !!meta?.build ||
    !!meta?.resume ||
    (propagate && getSearchDependents(model).length > 0);
  if (!tracked) return false;
  return markRowsDirty(knex, searchLiveTarget(model), ids, {
    propagate,
    fields,
  }).then(
    () => true,
    (e) => {
      if (!isMissingTable(e)) throw e;
      return false;
    },
  );
}

const fieldSyncs = new Map<string, Promise<unknown>>();

/**
 * Bring an index's field list in line with the table: forget removed fields
 * and delete their cells, and mark added or changed ones (by expression
 * version and column settings, by the linked columns a link or lookup reads,
 * or by `columnIds`) as not built. A marked field isn't searched until a
 * build writes it; resolves to whether one is needed.
 */
export function markSearchIndexFields(
  context: NcContext,
  modelId: string,
  knex: Knex,
  opts: { columnIds?: string[] } = {},
): Promise<boolean> {
  context = detachedContext(context);
  const previous = fieldSyncs.get(modelId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(() => markFields(context, modelId, knex, opts));
  const tail = run.catch(() => undefined);
  fieldSyncs.set(modelId, tail);
  void tail.then(() => {
    if (fieldSyncs.get(modelId) === tail) fieldSyncs.delete(modelId);
  });
  return run;
}

async function markFields(
  context: NcContext,
  modelId: string,
  knex: Knex,
  { columnIds = [] }: { columnIds?: string[] },
) {
  const model = await loadModel(context, modelId);
  const meta = model && getSearchIndexMeta(model);
  // While a first build runs too: its result must not cover a field changed meanwhile.
  if (meta?.state !== 'ready' && meta?.state !== 'building') return false;

  const resolved = await resolveIndexFields(context, model);
  const wanted = new Map(resolved.map((f) => [f.column.id, f]));
  const removed = Object.keys(meta.fields).filter((id) => !wanted.has(id));
  const forced = new Set(columnIds);
  const markedAt = new Date().toISOString();
  const marked: Record<string, SearchIndexField> = {};
  let unbuilt = false;

  for (const [id, field] of wanted) {
    const current = meta.fields[id];
    const stamp = fieldStamp(field);
    const stale =
      !current ||
      current.v !== stamp.v ||
      current.d !== stamp.d ||
      forced.has(id);
    if (stale) marked[id] = { ...stamp, marked_at: markedAt };
    if (stale || !current.built_at) unbuilt = true;
  }
  const rebuild =
    meta.state === 'ready' &&
    unbuilt &&
    !meta.build &&
    !isSearchIndexBackingOff(meta);
  if (!removed.length && !Object.keys(marked).length) return rebuild;

  // Applied to the meta as it is now: a build may have finished since the read.
  const written = await patchSearchIndexMeta(context, modelId, (m) => {
    if (m?.state !== 'ready' && m?.state !== 'building') return false;
    const fields = { ...m.fields, ...marked };
    for (const id of removed) delete fields[id];
    return { ...m, fields };
  });
  if (!written) return false;
  if (removed.length) {
    // Dead cells would still take ⌘K's per-table candidate slots.
    await deleteSearchFieldCells(knex, searchLiveTarget(model), removed).catch(
      (e) =>
        logSearchIndexError(
          `Search index cells of removed fields not deleted for ${modelId}`,
          e,
        ),
    );
  }
  const depTables = await registerDependents(
    context,
    modelId,
    meta.dep_tables ?? [],
    resolved,
  );
  await patchSearchIndexMeta(context, modelId, (m) =>
    m ? { ...m, dep_tables: depTables } : false,
  );
  return rebuild;
}

/** The candidate rows: `pk = ANY(rowIds)`. */
export function searchIndexClause(
  baseModel: IBaseModelSqlV2,
  rowIds: Array<string | number>,
) {
  return searchClause(
    baseModel,
    getSearchIndexMeta(baseModel.model).row_id_type,
    rowIds,
  );
}
