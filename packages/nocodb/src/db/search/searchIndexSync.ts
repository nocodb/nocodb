import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { SearchCatchUpWalk } from '~/db/search/searchIndexMeta';
import type { SearchIndexBuildStart } from '~/db/search/searchIndex';
import type {
  SearchIndexBuildJobData,
  SearchIndexFieldSyncJobData,
} from '~/interface/Jobs';
import type { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { Model, Source } from '~/models';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { NcConcurrent } from '~/utils/NcConcurrent';
import { CacheGetType, MetaTable } from '~/utils/globals';
import { isGlobalSearchAllowed } from '~/helpers/globalSearchGate';
import {
  buildSearchIndex,
  countQueuedSearchIndexBuild,
  dropSearchIndex,
  failStaleSearchIndexBuild,
  getModelSql,
  getSearchDependents,
  getSearchIndexMeta,
  hasUnbuiltFields,
  isSearchIndexBackingOff,
  isSearchIndexBuildStale,
  isSearchIndexResumePending,
  logSearchIndexError,
  markSearchIndexFields,
  prepareSearchIndexBuild,
  SEARCH_INDEX_SLACK_MS,
  searchIndexBlocker,
  searchIndexSizeBlocker,
  stampAfterSql,
} from '~/db/search/searchIndex';
import {
  clearSearchIndexStale,
  detachedContext,
  getRawSearchIndexMeta,
  getSearchCatchUpWalk,
  getSearchIndexMode,
  getSearchSyncedAt,
  isSearchIndexingEnabled,
  markSearchIndexStale,
  SEARCH_INDEX_FORMAT,
  setSearchCatchUpWalk,
  setSearchSyncedAt,
  updateModelMeta,
} from '~/db/search/searchIndexMeta';
import { SEARCH_INDEX_STATE_KEYS } from '~/db/search/searchIndexKeys';
import { searchIndexQueue, sourceKnex } from '~/db/search/searchIndexQueue';
import { isSearchIndexDeferred } from '~/db/search/searchIndexScope';
import {
  dbNow,
  isStatementTimeout,
  logSearchIndexWarning,
  readMarks,
  rowStampSql,
  searchExtensionBlocker,
  searchLiveTarget,
  searchSeenPath,
  settleMarkPropagation,
  stampedRows,
  unmarkRows,
} from '~/db/search/searchIndexStore';
import { searchEnvInt, searchEnvNumber } from '~/db/search/searchEnv';

const AUTO_CHECK_EVERY_MS = 10 * 60_000;
/** A watermark left in place while nothing is found moves after this long. */
const WATERMARK_MAX_AGE_MS = 60 * 60_000;

/** Rows read back per table per catch-up; past it they are re-indexed by stamp. */
export function catchUpCap() {
  return searchEnvNumber('NC_SEARCH_INDEX_CATCH_UP_CAP', 50_000);
}

/** How long one catch-up read may run; past it the table is walked in chunks. */
const catchUpTimeoutMs = () =>
  searchEnvInt('NC_SEARCH_INDEX_CATCH_UP_TIMEOUT_MS', 30_000);
/** Rows per read of a catch-up walk. */
const walkChunkRows = () =>
  searchEnvInt('NC_SEARCH_INDEX_CATCH_UP_WALK_CHUNK', 50_000);
/** Reads per table per reconcile; the walk resumes at the next one. */
const walkChunksPerPass = () =>
  searchEnvInt('NC_SEARCH_INDEX_CATCH_UP_WALK_CHUNKS', 20);

/** A catch-up's rows found; `resume` is set while its walk isn't done. */
export interface SearchCatchUp {
  found: number;
  /** Rows were written since the watermark, though all were indexed already. */
  matched?: boolean;
  /** Read in chunks: the plain read timed out. */
  walked?: boolean;
  resume?: SearchCatchUpWalk;
}

/** Catch up on writes made while the backfill ran and on fields changed meanwhile. */
function catchUpAfterBuild(context: NcContext, knex: Knex) {
  return async (model: Model, since: string) => {
    searchIndexQueue.flushNow(context, model.id);
    await catchUpSearchIndexWrites(context, model, knex, since);
    // Linked-table writes during the backfill went to the table swapped out.
    const depTables = getSearchIndexMeta(
      await Model.get(context, model.id),
    )?.dep_tables;
    for (const tableId of depTables ?? []) {
      const linked = await Model.get(context, tableId);
      // A junction only: its writes were tracked through the linked rows.
      if (linked && getSearchDependents(linked).length) {
        await catchUpSearchIndexWrites(context, linked, knex, since);
      }
    }
    await syncSearchIndexFields(context, model.id, knex);
  };
}

/** How long a build waits before trying again for a slot. */
function slotRetryMs() {
  return searchEnvNumber('NC_SEARCH_INDEX_SLOT_RETRY_MS', 30_000);
}

const QUEUED_KEY = 'search_index:queued';
/** A queued job not started by then no longer holds off another. */
const QUEUED_TTL_S = 15 * 60;
const queuedKey = (modelId: string) => `${QUEUED_KEY}:${modelId}`;

/** Whether a build job is queued for the table and hasn't started. */
export async function isSearchIndexBuildQueued(modelId: string) {
  const queued = await NocoCache.get(
    'root',
    queuedKey(modelId),
    CacheGetType.TYPE_OBJECT,
  ).catch(() => null);
  return !!queued;
}

/** Dropped with the index: a job queued before then finds the mode off. */
export async function clearSearchIndexBuildQueued(modelId: string) {
  await NocoCache.del('root', queuedKey(modelId)).catch(() => undefined);
}

function jobsService() {
  return Noco.nestApp?.get<IJobsService>('JobsService', { strict: false });
}

/** A plan that can't be read builds nothing. */
const planAllows = (context: NcContext) =>
  isGlobalSearchAllowed(context).catch(() => false);

/**
 * The plan check per workspace, once per pass. Undefined when the plan
 * couldn't be read: nothing is built, and nothing dropped, on a guess.
 */
function workspacePlanChecks() {
  const checks = new Map<string, Promise<boolean | undefined>>();
  return (context: NcContext) => {
    const key = context.workspace_id ?? '';
    let check = checks.get(key);
    if (!check) {
      check = isGlobalSearchAllowed(context).catch((e) => {
        logSearchIndexError(`Search plan check failed for ${key}`, e);
        return undefined;
      });
      checks.set(key, check);
    }
    return check;
  };
}

/**
 * Queue a build job, unless one is queued already. An explicit build always
 * queues one, so a user's build isn't lost behind one that gives up its turn.
 */
async function enqueueSearchIndexBuild(
  context: NcContext,
  modelId: string,
  {
    explicit = false,
    retry = false,
    delay = 0,
  }: { explicit?: boolean; retry?: boolean; delay?: number },
) {
  const key = queuedKey(modelId);
  const value = JSON.stringify({ queued_at: new Date().toISOString() });
  const ttl = QUEUED_TTL_S + Math.ceil(delay / 1000);
  if (explicit && !retry) {
    await NocoCache.del('root', key).catch(() => undefined);
  }
  // An unreachable cache queues it anyway: the build's own claim decides.
  const taken = await NocoCache.setIfNotExist('root', key, value, ttl).catch(
    () => true,
  );
  if (!taken && !(explicit && !retry)) return false;
  countQueuedSearchIndexBuild(1);
  try {
    const data: Omit<SearchIndexBuildJobData, 'jobName'> = {
      context,
      user: undefined,
      modelId,
      explicit,
      retry,
    };
    await jobsService().add(
      JobTypes.SearchIndexBuild,
      data,
      delay ? { delay } : undefined,
    );
  } catch (e) {
    countQueuedSearchIndexBuild(-1);
    await NocoCache.delIfValue('root', key, value).catch(() => undefined);
    throw e;
  }
  return true;
}

/**
 * Build the table's index in a job, then catch up on writes made meanwhile.
 * A table that can't be indexed is refused (400) here, before anything is
 * queued. Without the jobs service (no Nest app) it builds in this process.
 */
export async function startSearchIndexBuild(
  context: NcContext,
  modelId: string,
  knex: Knex,
  { explicit = false }: { explicit?: boolean } = {},
) {
  if (!isSearchIndexingEnabled()) return false;
  context = detachedContext(context);
  if (!(await planAllows(context))) return false;
  const model = await prepareSearchIndexBuild(context, modelId, knex);
  const meta = getSearchIndexMeta(model);
  if (meta?.build && !isSearchIndexBuildStale(meta)) return false;
  if (!jobsService()) {
    await buildSearchIndex(context, modelId, knex, {
      onReady: catchUpAfterBuild(context, knex),
      explicit,
    });
    return true;
  }
  return enqueueSearchIndexBuild(context, modelId, { explicit });
}

/**
 * The build job: start the build and, with `wait`, return once it has ended.
 * A build with every slot taken queues itself again, delayed; an auto build
 * dropped here would otherwise wait for the next search past AUTO_CHECK_EVERY_MS.
 */
export async function runSearchIndexBuildJob(
  data: SearchIndexBuildJobData,
  { wait }: { wait: boolean },
) {
  const context = detachedContext(data.context);
  const { modelId, explicit, retry } = data;
  let started: SearchIndexBuildStart | undefined;
  try {
    // Cleared once the build is claimed, so a build onReady starts is queued.
    try {
      if (!isSearchIndexingEnabled()) return;
      // Queued before a downgrade.
      if (!(await planAllows(context))) return;
      const model = await Model.get(context, modelId);
      if (!model || getSearchIndexMode(model) === 'off') return;
      const meta = getSearchIndexMeta(model);
      // Built elsewhere meanwhile; a ready index can still owe a rebuild, as
      // after the failure cap.
      if (retry && meta?.state === 'ready' && !hasUnbuiltFields(meta)) return;
      const knex = await sourceKnex(context, model);
      started = await buildSearchIndex(context, modelId, knex, {
        onReady: catchUpAfterBuild(context, knex),
        explicit,
      });
    } finally {
      countQueuedSearchIndexBuild(-1);
      await NocoCache.del('root', queuedKey(modelId)).catch(() => undefined);
    }
    if (!started) return;
    if (started.noSlot) {
      await enqueueSearchIndexBuild(context, modelId, {
        explicit,
        retry: true,
        delay: slotRetryMs() * (0.5 + Math.random()),
      });
    }
    if (wait) await started.done;
  } catch (e) {
    logSearchIndexError(`Search index build failed for ${modelId}`, e);
  }
}

/**
 * Field changes on a ready index: a changed or added field isn't searched
 * until the build this starts writes it, alone, into the served cells.
 */
export async function syncSearchIndexFields(
  context: NcContext,
  modelId: string,
  knex: Knex,
  opts: { columnIds?: string[] } = {},
) {
  const rebuild = await markSearchIndexFields(context, modelId, knex, opts);
  if (rebuild) await startSearchIndexBuild(context, modelId, knex);
  return rebuild;
}

/**
 * Rebuild `columnIds` whatever their state, e.g. fields a deferred write
 * filled after a build may have read them. Never throws.
 */
export async function rebuildSearchIndexFields(
  context: NcContext,
  modelId: string,
  columnIds: string[],
) {
  if (!columnIds.length || !isSearchIndexingEnabled()) return;
  try {
    context = detachedContext(context);
    const model = await Model.get(context, modelId);
    if (!model || !getSearchIndexMeta(model)) return;
    const knex = await sourceKnex(context, model);
    await syncSearchIndexFields(context, modelId, knex, { columnIds });
  } catch (e) {
    logSearchIndexError(`Search index field rebuild failed for ${modelId}`, e);
  }
}

/**
 * Queue rows written after `since` (by UpdatedAt, or CreatedAt for rows never
 * edited) on an indexed table or a table an index reads through. Covers
 * writes the in-memory queue lost. With `wait`, re-indexes them now and
 * throws on failure instead of queueing. Past the cap they are taken by
 * stamp, the table stale until indexed. When the read times out, the table
 * is walked in bounded chunks, stopping after `maxChunks`. Null when there is
 * no timestamp to catch up by.
 */
/** Skips rows whose current version a flush already indexed. */
function seenFilter(knex: Knex, model: Model) {
  const stamp = rowStampSql(knex, model);
  return stamp
    ? {
        path: searchSeenPath(searchLiveTarget(model).path),
        modelId: model.id,
        stamp,
      }
    : undefined;
}

export async function catchUpSearchIndexWrites(
  context: NcContext,
  model: Model,
  knex: Knex,
  since: string,
  {
    wait = false,
    maxChunks = Infinity,
  }: { wait?: boolean; maxChunks?: number } = {},
): Promise<SearchCatchUp | null> {
  const startedAt = new Date().toISOString();
  await model.getColumns();
  // ISO: a bound Date is sent as local time without an offset.
  const from = new Date(
    new Date(since).getTime() - SEARCH_INDEX_SLACK_MS,
  ).toISOString();
  const stamp = stampAfterSql(knex, model, from);
  const pk = model.primaryKey;
  if (!stamp || !pk) return null;
  const baseModel = await getModelSql(context, model, knex);
  const cap = catchUpCap();
  let ids: Array<string | number>;
  let matched = false;
  try {
    const read = await stampedRows.ids(
      knex,
      baseModel.tnPath,
      pk.column_name,
      stamp,
      cap + 1,
      catchUpTimeoutMs(),
      seenFilter(knex, model),
    );
    ids = read.ids;
    matched = read.matched;
  } catch (e) {
    if (!isStatementTimeout(e)) throw e;
    // No index on the stamps: read it a chunk at a time instead.
    return walkSearchIndexCatchUp(
      context,
      model,
      knex,
      { from, started_at: startedAt },
      { wait, maxChunks },
    );
  }
  if (!ids.length) return { found: 0, matched };
  if (ids.length > cap) {
    // One pass per table, and only over these rows.
    const indexed = getSearchIndexMeta(model)?.state === 'ready';
    if (indexed) await searchIndexQueue.markStale(context, model.id);
    if (wait) {
      const startedAt = new Date().toISOString();
      await searchIndexQueue.apply(context, model.id, { since: from });
      if (indexed) await clearSearchIndexStale(context, model.id, startedAt);
    } else {
      searchIndexQueue.enqueue(
        context,
        model.id,
        { since: from },
        { stale: true },
      );
    }
    return { found: ids.length };
  }
  if (wait) await searchIndexQueue.apply(context, model.id, ids);
  else searchIndexQueue.enqueue(context, model.id, ids);
  return { found: ids.length };
}

/**
 * Re-index the rows stamped after `walk.from`, reading the table in pk order
 * a chunk at a time, so no read covers the whole table. Stops after
 * `maxChunks` reads, with `resume` set to carry on from there.
 */
export async function walkSearchIndexCatchUp(
  context: NcContext,
  model: Model,
  knex: Knex,
  walk: SearchCatchUpWalk,
  {
    wait = false,
    maxChunks = Infinity,
  }: { wait?: boolean; maxChunks?: number },
): Promise<SearchCatchUp | null> {
  await model.getColumns();
  const stamp = stampAfterSql(knex, model, walk.from);
  const pk = model.primaryKey;
  if (!stamp || !pk) return null;
  const baseModel = await getModelSql(context, model, knex);
  let after = walk.after;
  let found = 0;
  for (let read = 0; read < maxChunks; read++) {
    const chunk = await stampedRows.inChunk(
      knex,
      baseModel.tnPath,
      pk.column_name,
      stamp,
      after,
      walkChunkRows(),
      catchUpTimeoutMs(),
      seenFilter(knex, model),
    );
    if (chunk.ids.length) {
      found += chunk.ids.length;
      if (wait) await searchIndexQueue.apply(context, model.id, chunk.ids);
      else searchIndexQueue.enqueue(context, model.id, chunk.ids);
    }
    if (chunk.last === undefined) return { found, walked: true };
    after = chunk.last;
  }
  return { found, walked: true, resume: { ...walk, after } };
}

const autoChecks = new Map<string, number>();

/**
 * On a search: start the index a table should have (mode `on` or `auto`),
 * or catch a ready one up with field changes. Runs in the background; the
 * search itself is not delayed. Checks a table at most every 10 minutes;
 * returns whether this call did.
 */
export function maybeAutoBuildSearchIndex(baseModel: IBaseModelSqlV2) {
  if (!isSearchIndexingEnabled()) return false;
  const model = baseModel.model;
  const now = Date.now();
  if (now - (autoChecks.get(model.id) ?? 0) < AUTO_CHECK_EVERY_MS) return false;
  autoChecks.set(model.id, now);
  void autoBuild(baseModel).catch((e) =>
    logSearchIndexError(`Search index auto-build failed for ${model.id}`, e),
  );
  return true;
}

async function autoBuild(baseModel: IBaseModelSqlV2) {
  const { model } = baseModel;
  const context = detachedContext(baseModel.context);
  const knex = baseModel.dbDriver;
  if (getSearchIndexMode(model) === 'off') return;

  const meta = getSearchIndexMeta(model);
  if (meta?.build) {
    if (isSearchIndexBuildStale(meta)) {
      await failStaleSearchIndexBuild(context, model, knex);
    }
    return;
  }
  if (meta?.state === 'ready') {
    await syncSearchIndexFields(context, model.id, knex);
    return;
  }
  if (meta?.state === 'failed' && isSearchIndexBackingOff(meta)) return;
  if (await searchIndexBlocker(context, model, knex)) return;
  if (await searchIndexSizeBlocker(context, model, knex)) return;
  await startSearchIndexBuild(context, model.id, knex);
}

/** Live tables, in live bases, whose meta holds index state or dependents. */
async function listTrackedTables() {
  const rows: Array<{ id: string; base_id: string; fk_workspace_id: string }> =
    await Noco.ncMeta
      .knexConnection(`${MetaTable.MODELS} as m`)
      .join(`${MetaTable.PROJECT} as b`, 'b.id', 'm.base_id')
      .select('m.id', 'm.base_id', 'm.fk_workspace_id')
      .orderBy('m.id')
      .where((qb) =>
        qb
          .where('m.meta', 'like', '%"search_index"%')
          .orWhere('m.meta', 'like', '%"search_dependents"%'),
      )
      .where((qb) => qb.whereNull('m.deleted').orWhere('m.deleted', false))
      .where((qb) => qb.whereNull('b.deleted').orWhere('b.deleted', false));
  return rows;
}

/** Tables marked at once when indexing resumes. */
const STALE_MARK_CONCURRENCY = 16;

/**
 * Every served index is behind as of `at`: writes made while indexing was off
 * were not tracked. Search says `catching_up` until a reconcile covers them.
 */
export async function markSearchIndexesStale(at: string) {
  const tables = await listTrackedTables();
  await NcConcurrent(
    tables.map((row) => async () => {
      const context = {
        workspace_id: row.fk_workspace_id,
        base_id: row.base_id,
      } as NcContext;
      // Per table: one failure must not stop the rest from being marked.
      try {
        const model = await Model.get(context, row.id);
        if (!model || getSearchIndexMeta(model)?.state !== 'ready') return;
        await markSearchIndexStale(context, row.id, at);
      } catch (e) {
        logSearchIndexError(`Search index stale mark failed for ${row.id}`, e);
      }
    }),
    { concurrency: STALE_MARK_CONCURRENCY },
  );
}

/**
 * A field changed on `tableId`: its own index and indexes reading through
 * it. Only fields whose linked columns changed are marked, so an unrelated
 * field on a linked table rebuilds nothing. `build: false` only marks them.
 */
export async function syncSearchIndexAfterFieldChange(
  context: NcContext,
  tableId: string,
  { build = true }: { build?: boolean } = {},
) {
  const model = await Model.get(context, tableId);
  if (!model) return;
  const ownMeta = getSearchIndexMeta(model);
  const dependents = getSearchDependents(model);
  if (!ownMeta && !dependents.length) return;
  const knex = await sourceKnex(context, model);
  const sync = build ? syncSearchIndexFields : markSearchIndexFields;
  if (ownMeta) await sync(context, model.id, knex);
  const seen = new Set<string>();
  for (const dependent of dependents) {
    if (seen.has(dependent.table_id)) continue;
    seen.add(dependent.table_id);
    await sync(context, dependent.table_id, knex);
  }
}

// Field changes arrive in bursts (bulk field edits, a link's two sides).
const FIELD_SYNC_DELAY_MS = 2_000;
const fieldSyncsAdded = new Map<string, number>();

/** Queue a field sync of `tableId` on the worker: one per table per window. */
export function scheduleSearchIndexFieldSync(
  context: NcContext,
  tableId: string,
) {
  if (!isSearchIndexingEnabled()) return;
  // Marked now, built after the burst: meanwhile a search reports the fields
  // as catching up instead of matching their old cells.
  searchIndexQueue.background(
    syncSearchIndexAfterFieldChange(detachedContext(context), tableId, {
      build: false,
    }).catch((e) =>
      logSearchIndexError(`Search index field mark failed for ${tableId}`, e),
    ),
  );
  // The deferring caller builds the fields once its writes are done.
  if (isSearchIndexDeferred(tableId)) return;
  const now = Date.now();
  for (const [key, at] of fieldSyncsAdded) {
    if (at < now - 10 * 60_000) fieldSyncsAdded.delete(key);
  }
  const window = Math.floor(now / FIELD_SYNC_DELAY_MS);
  const key = `${JobTypes.SearchIndexFieldSync}:${tableId}:${window}`;
  if (fieldSyncsAdded.has(key)) return;
  fieldSyncsAdded.set(key, now);
  const data: Omit<SearchIndexFieldSyncJobData, 'jobName'> = {
    context: detachedContext(context),
    user: undefined,
    modelId: tableId,
    key,
  };
  const jobs = jobsService();
  if (!jobs) {
    const timer = setTimeout(() => {
      void runSearchIndexFieldSyncJob(data as SearchIndexFieldSyncJobData);
    }, FIELD_SYNC_DELAY_MS);
    timer.unref?.();
    return;
  }
  jobs
    .add(JobTypes.SearchIndexFieldSync, data, {
      jobId: key,
      delay: FIELD_SYNC_DELAY_MS,
      removeOnComplete: true,
      removeOnFail: true,
    })
    .catch((e) => {
      fieldSyncsAdded.delete(key);
      logSearchIndexError(
        `Search index field sync queueing failed for ${tableId}`,
        e,
      );
    });
}

/**
 * The field sync job. Its key is freed as it starts, so a change landing
 * meanwhile gets a sync of its own. Never throws: the reconcile syncs fields
 * too.
 */
export async function runSearchIndexFieldSyncJob(
  data: SearchIndexFieldSyncJobData,
) {
  fieldSyncsAdded.delete(data.key);
  try {
    if (!isSearchIndexingEnabled()) return;
    await syncSearchIndexAfterFieldChange(
      detachedContext(data.context),
      data.modelId,
    );
  } catch (e) {
    logSearchIndexError(
      `Search index field sync failed for ${data.modelId}`,
      e,
    );
  }
}

/** The reconcile period; 0 or below turns the reconcile off. */
export function searchIndexReconcileEveryMs() {
  const minutes = searchEnvNumber(
    'NC_SEARCH_INDEX_CATCHUP_MINUTES',
    10,
    -Infinity,
  );
  return minutes > 0 ? minutes * 60_000 : 0;
}

/** The reconcile job, repeated per period; one instance runs each period. */
export async function runSearchIndexReconcileJob() {
  const every = searchIndexReconcileEveryMs();
  if (!every || !isSearchIndexingEnabled()) return;
  await runClaimedSearchIndexReconcile(every);
}

let reconciling = false;

const RECONCILE_KEY = 'search_index:reconcile';
const RECONCILE_RENEW_MS = 60_000;

/**
 * One reconcile per period across instances: the first to claim the key runs
 * it. The claim is renewed while the pass runs, so a long pass isn't joined
 * by a second instance, and held for the rest of the period once it ends.
 * Renewed and released only while this instance still holds it. With the
 * cache off every instance claims it; refreshes still serialise per side
 * table. Resolves to whether this instance ran it.
 */
export async function runClaimedSearchIndexReconcile(everyMs: number) {
  const startedAt = Date.now();
  const holder = `${process.pid}:${startedAt}`;
  const ttl = Math.max(1, Math.floor(everyMs / 1000) - 5);
  if (!(await NocoCache.setIfNotExist('root', RECONCILE_KEY, holder, ttl))) {
    return false;
  }
  const renew = setInterval(() => {
    NocoCache.expireIfValue('root', RECONCILE_KEY, holder, ttl).catch((e) =>
      logSearchIndexError('Search index reconcile claim renewal failed', e),
    );
  }, Math.min(RECONCILE_RENEW_MS, (ttl * 1000) / 3));
  renew.unref?.();
  try {
    await reconcileSearchIndexes();
    await backfillSearchIndexes().catch((e) =>
      logSearchIndexError('Search index backfill failed', e),
    );
  } finally {
    clearInterval(renew);
    const left = Math.floor((startedAt + everyMs - Date.now()) / 1000) - 5;
    await (left >= 1
      ? NocoCache.expireIfValue('root', RECONCILE_KEY, holder, left)
      : NocoCache.delIfValue('root', RECONCILE_KEY, holder)
    ).catch(() => undefined);
  }
  return true;
}

/** Builds the backfill queues per reconcile pass; 0 turns it off. */
export function searchIndexBackfillPerPass() {
  return searchEnvInt('NC_SEARCH_INDEX_BACKFILL_PER_PASS', 4, 0);
}

/** Reads per backfill pass, each continuing after the last. */
const BACKFILL_ROUNDS = 10;
/** Reads in a row that queue nothing end the pass; the next goes on from there. */
const BACKFILL_IDLE_READS = 2;
const BACKFILL_SKIP_KEY = 'search_index:backfill_skip';
/** A table that can't be indexed is looked at again after this. */
const BACKFILL_SKIP_TTL_S = 24 * 60 * 60;
const backfillSkipKey = (modelId: string) => `${BACKFILL_SKIP_KEY}:${modelId}`;
const BACKFILL_CURSOR_KEY = 'search_index:backfill_cursor';
const BACKFILL_CURSOR_TTL_S = 7 * 24 * 60 * 60;
const loggedExtensionBlockers = new Set<string>();

/**
 * Workspaces whose plan had no search, left out of later passes' reads for a
 * while: otherwise each pass re-reads their tables before reaching others.
 */
const BLOCKED_WORKSPACE_TTL_MS = 30 * 60_000;
const BLOCKED_WORKSPACES_MAX = 5_000;
const blockedWorkspaces = new Map<string, number>();

/** Forgets the workspaces the backfill left out for their plan. */
export function forgetBackfillBlockedWorkspaces() {
  blockedWorkspaces.clear();
}

interface BackfillCandidate {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  updated_at: Date | string | null;
  meta?: string | Record<string, unknown>;
}

/**
 * The last candidate a pass looked at. The next pass continues after it, so
 * candidates that never take the budget (a plan without search, a table that
 * can't be indexed) can't hold the same window forever.
 */
interface BackfillCursor {
  /** `updated_at`: epoch ms when the driver returns a Date, else as returned. */
  at: number | string;
  id: string;
}

/** Kept here only while the cache is off; the cache shares it across instances. */
let localBackfillCursor: BackfillCursor | null = null;

async function readBackfillCursor(): Promise<BackfillCursor | null> {
  if (NocoCache.isCacheDisabled) return localBackfillCursor;
  const cached = await NocoCache.get(
    'root',
    BACKFILL_CURSOR_KEY,
    CacheGetType.TYPE_OBJECT,
  ).catch(() => null);
  return cached?.id ? cached : null;
}

async function writeBackfillCursor(cursor: BackfillCursor | null) {
  if (NocoCache.isCacheDisabled) {
    localBackfillCursor = cursor;
    return;
  }
  await (cursor
    ? NocoCache.setExpiring(
        'root',
        BACKFILL_CURSOR_KEY,
        cursor,
        BACKFILL_CURSOR_TTL_S,
      )
    : NocoCache.del('root', BACKFILL_CURSOR_KEY)
  ).catch(() => undefined);
}

const toCursor = (row: BackfillCandidate): BackfillCursor | null =>
  row.updated_at === null || row.updated_at === undefined
    ? null
    : {
        at:
          row.updated_at instanceof Date
            ? row.updated_at.getTime()
            : row.updated_at,
        id: row.id,
      };

const cursorValue = (at: number | string) =>
  typeof at === 'number' ? new Date(at) : at;

/**
 * Tables in the built-in database that need a build: no index, a failed
 * one, or one in an older format. Latest changed first, after `after`.
 */
function listBackfillCandidates(
  limit: number,
  after: BackfillCursor | null,
  skipWorkspaces: Set<string>,
) {
  const qb = Noco.ncMeta
    .knexConnection(`${MetaTable.MODELS} as m`)
    .join(`${MetaTable.PROJECT} as b`, 'b.id', 'm.base_id')
    .join(`${MetaTable.SOURCES} as s`, 's.id', 'm.source_id')
    .select('m.id', 'm.base_id', 'm.fk_workspace_id', 'm.updated_at', 'm.meta')
    .where('m.type', 'table')
    .where((q) => q.whereNull('m.mm').orWhere('m.mm', false))
    .where((q) => q.whereNull('m.deleted').orWhere('m.deleted', false))
    .where((q) => q.whereNull('b.deleted').orWhere('b.deleted', false))
    .where((q) => q.whereNull('b.is_snapshot').orWhere('b.is_snapshot', false))
    .where((q) => q.whereNull('b.is_sandbox').orWhere('b.is_sandbox', false))
    .where((q) => q.whereNull('s.deleted').orWhere('s.deleted', false))
    .where((q) => q.where('s.is_meta', true).orWhere('s.is_local', true))
    .where((q) =>
      q
        .whereNull('m.meta')
        .orWhere('m.meta', 'not like', '%"search_index_mode":"off"%'),
    )
    // A superset of what needsBuild keeps: a ready index in the current
    // format is left out, so it can't fill the window.
    .where((q) =>
      q
        .whereNull('m.meta')
        .orWhere('m.meta', 'not like', '%"search_index":%')
        .orWhere('m.meta', 'like', '%"state":"failed"%')
        .orWhere((q) =>
          q
            .where('m.meta', 'not like', `%"format":${SEARCH_INDEX_FORMAT},%`)
            .where('m.meta', 'not like', `%"format":${SEARCH_INDEX_FORMAT}}%`),
        ),
    );
  if (skipWorkspaces.size) {
    qb.whereNotIn('m.fk_workspace_id', [...skipWorkspaces]);
  }
  if (after) {
    const at = cursorValue(after.at);
    qb.where((q) =>
      q
        .where('m.updated_at', '<', at)
        .orWhere((q) =>
          q.where('m.updated_at', at).where('m.id', '>', after.id),
        ),
    );
  }
  return qb
    .orderBy('m.updated_at', 'desc')
    .orderBy('m.id')
    .limit(limit) as Promise<BackfillCandidate[]>;
}

/** No index yet, or one that should be built again: failed past its back-off, or an older format. */
function needsBuild(row: BackfillCandidate) {
  const model = { meta: row.meta } as Model;
  const raw = getRawSearchIndexMeta(model);
  if (!raw) return true;
  if (raw.format !== SEARCH_INDEX_FORMAT) return !raw.build;
  const meta = getSearchIndexMeta(model);
  return (
    meta?.state === 'failed' && !meta.build && !isSearchIndexBackingOff(meta)
  );
}

/**
 * Queue builds for tables with no index, a failed one or an older format, a
 * few per reconcile pass, so indexes exist before anyone searches. Queued
 * builds not yet started count against the pass's budget, so slow builds
 * don't pile up. Each pass looks at the latest changed first, then continues
 * where the last stopped and wraps at the end, so every candidate is reached.
 * Runs while indexing is on.
 */
export async function backfillSearchIndexes({
  pageSize,
  rounds = BACKFILL_ROUNDS,
}: { pageSize?: number; rounds?: number } = {}) {
  const result = { queued: 0, pending: 0, skipped: 0 };
  const budget = searchIndexBackfillPerPass();
  if (!budget || !isSearchIndexingEnabled()) return result;

  const read = pageSize ?? budget * 5;
  const extensionBlockers = new Map<Knex, string | undefined>();
  const planAllowsWorkspace = workspacePlanChecks();
  // Workspaces whose plan has no search are left out of the pass's later
  // reads, so they don't take every candidate slot.
  const skipWorkspaces = new Set<string>();
  const now = Date.now();
  for (const [id, until] of blockedWorkspaces) {
    if (until > now) skipWorkspaces.add(id);
    else blockedWorkspaces.delete(id);
  }
  const head = new Set<string>();
  const seen = new Set<string>();
  let cursor = await readBackfillCursor();
  let wrapped = !cursor;
  const spent = () => result.queued + result.pending >= budget;
  // Once the paid tables are built, only Free-plan ones are left: each read
  // is a scan of nc_models, so a pass stops early rather than read them all.
  let idleReads = 0;
  const progress = () => result.queued + result.pending;

  const visit = async (row: BackfillCandidate) => {
    if (!needsBuild(row)) return;
    const context = {
      workspace_id: row.fk_workspace_id,
      base_id: row.base_id,
    } as NcContext;
    if (!(await planAllowsWorkspace(context))) {
      if (row.fk_workspace_id) {
        skipWorkspaces.add(row.fk_workspace_id);
        if (blockedWorkspaces.size < BLOCKED_WORKSPACES_MAX) {
          blockedWorkspaces.set(
            row.fk_workspace_id,
            Date.now() + BLOCKED_WORKSPACE_TTL_MS,
          );
        }
      }
      result.skipped++;
      return;
    }
    try {
      const outcome = await backfillTable(context, row.id, extensionBlockers);
      result[outcome]++;
    } catch (e) {
      result.skipped++;
      logSearchIndexError(`Search index backfill failed for ${row.id}`, e);
    }
  };

  try {
    // The latest changed first, without the cursor: a new table is reached
    // on the next pass, not once the cursor wraps.
    for (const row of await listBackfillCandidates(
      read,
      null,
      skipWorkspaces,
    )) {
      if (spent()) return result;
      head.add(row.id);
      await visit(row);
    }
    // The head read isn't counted: an idle pass still reads past the cursor.
    for (let round = 0; round < rounds; round++) {
      if (idleReads >= BACKFILL_IDLE_READS) break;
      const before = progress();
      // A read of only the head's rows doesn't count as idle.
      let fresh = 0;
      const page = await listBackfillCandidates(read, cursor, skipWorkspaces);
      for (const row of page) {
        if (spent()) return result;
        if (seen.has(row.id)) return result;
        seen.add(row.id);
        cursor = toCursor(row) ?? cursor;
        if (head.has(row.id)) continue;
        fresh++;
        await visit(row);
      }
      if (fresh) idleReads = progress() === before ? idleReads + 1 : 0;
      if (page.length < read) {
        // The end: the next read starts from the latest changed again.
        cursor = null;
        if (wrapped) break;
        wrapped = true;
      }
    }
    return result;
  } finally {
    await writeBackfillCursor(cursor);
  }
}

async function backfillTable(
  context: NcContext,
  modelId: string,
  extensionBlockers: Map<Knex, string | undefined>,
): Promise<'queued' | 'pending' | 'skipped'> {
  if (await isSearchIndexBuildQueued(modelId)) return 'pending';
  const skipped = await NocoCache.get(
    'root',
    backfillSkipKey(modelId),
    CacheGetType.TYPE_OBJECT,
  ).catch(() => null);
  if (skipped) return 'skipped';

  const model = await Model.get(context, modelId);
  if (!model || getSearchIndexMode(model) === 'off') return 'skipped';
  await model.getColumns();
  const meta = getSearchIndexMeta(model);
  if (meta?.build) return 'pending';
  if (meta?.state === 'ready') return 'skipped';

  const skip = async (reason: string) => {
    await NocoCache.setIfNotExist(
      'root',
      backfillSkipKey(modelId),
      JSON.stringify({ reason }),
      BACKFILL_SKIP_TTL_S,
    ).catch(() => undefined);
    return 'skipped' as const;
  };
  const blocker = await searchIndexBlocker(context, model);
  if (blocker) return skip(blocker);

  // The extensions are per database: checked once per pass, logged once.
  const knex = await sourceKnex(context, model);
  if (!extensionBlockers.has(knex)) {
    extensionBlockers.set(knex, await searchExtensionBlocker(knex));
  }
  const extensionBlocker = extensionBlockers.get(knex);
  if (extensionBlocker) {
    if (!loggedExtensionBlockers.has(extensionBlocker)) {
      loggedExtensionBlockers.add(extensionBlocker);
      logSearchIndexWarning(
        `Search index backfill skipped: ${extensionBlocker}`,
      );
    }
    return 'skipped';
  }

  const tooLarge = await searchIndexSizeBlocker(context, model, knex);
  if (tooLarge) return skip(tooLarge);

  return (await startSearchIndexBuild(context, modelId, knex))
    ? 'queued'
    : 'pending';
}

/**
 * After the bases' data moved to another database server, which their search
 * tables don't follow: drop their tables' index state, so they are built
 * again there. The user-set mode stays. Resolves to the tables reset.
 */
export async function forgetMovedSearchIndexes(baseIds: string[]) {
  if (!baseIds.length) return 0;
  const rows: Array<{ id: string; base_id: string; fk_workspace_id: string }> =
    await Noco.ncMeta
      .knexConnection(MetaTable.MODELS)
      .select('id', 'base_id', 'fk_workspace_id')
      .whereIn('base_id', baseIds)
      .where('meta', 'like', '%"search_%');
  let reset = 0;
  for (const row of rows) {
    const context = {
      workspace_id: row.fk_workspace_id,
      base_id: row.base_id,
    };
    const written = await updateModelMeta(context, row.id, (meta) => {
      const keys = SEARCH_INDEX_STATE_KEYS.filter((k) => k in meta);
      if (!keys.length) return false;
      for (const key of keys) delete meta[key];
    });
    if (written) reset++;
  }
  return reset;
}

/** How long one reconcile pass may take before it leaves the rest to the next. */
const reconcileBudgetMs = () =>
  searchEnvInt('NC_SEARCH_INDEX_RECONCILE_BUDGET_MS', 2 * 60_000);

const RECONCILE_CURSOR_KEY = 'search_index:reconcile_cursor';
let localReconcileCursor: string | null = null;

async function readReconcileCursor(): Promise<string | null> {
  if (NocoCache.isCacheDisabled) return localReconcileCursor;
  const value = await NocoCache.get(
    'root',
    RECONCILE_CURSOR_KEY,
    CacheGetType.TYPE_STRING,
  ).catch(() => null);
  return typeof value === 'string' && value ? value : null;
}

async function writeReconcileCursor(cursor: string | null) {
  if (NocoCache.isCacheDisabled) {
    localReconcileCursor = cursor;
    return;
  }
  await (cursor
    ? NocoCache.setExpiring('root', RECONCILE_CURSOR_KEY, cursor, 60 * 60)
    : NocoCache.del('root', RECONCILE_CURSOR_KEY)
  ).catch(() => undefined);
}

/** Postgres' write count per table at its last catch-up, in this process. */
const lastWriteCounts = new Map<string, string>();

/** Rows inserted, updated and deleted in the table, per Postgres' statistics. */
async function tableWriteCount(
  context: NcContext,
  model: Model,
  knex: Knex,
): Promise<string | null> {
  const baseModel = await getModelSql(context, model, knex);
  const result = await knex
    .raw(
      `SELECT (n_tup_ins + n_tup_upd + n_tup_del)::text AS writes
         FROM pg_stat_user_tables
        WHERE schemaname = COALESCE(?, current_schema()) AND relname = ?`,
      [baseModel.schema ?? null, model.table_name],
    )
    .catch(() => null);
  return result?.rows?.[0]?.writes ?? null;
}

/**
 * Periodic safety net, run by one instance per period (see
 * {@link runClaimedSearchIndexReconcile}): fail dead builds, re-index changed
 * fields, and queue rows written since the table's watermark (writes the
 * in-memory queue lost on a restart). Hard-deleted rows are not caught:
 * their cells only cost space until the next rebuild.
 */
export async function reconcileSearchIndexes() {
  if (reconciling || !isSearchIndexingEnabled()) return;
  reconciling = true;
  try {
    const planAllowsWorkspace = workspacePlanChecks();
    const tables = await listTrackedTables();
    // Past the budget the pass stops; the next one starts after that table.
    const after = await readReconcileCursor();
    const start = after ? tables.findIndex((t) => t.id > after) : 0;
    const ordered =
      start > 0 ? [...tables.slice(start), ...tables.slice(0, start)] : tables;
    const deadline = Date.now() + reconcileBudgetMs();
    let cursor: string | null = null;
    for (const row of ordered) {
      if (Date.now() > deadline) break;
      const context = {
        workspace_id: row.fk_workspace_id,
        base_id: row.base_id,
      } as NcContext;
      const allowed = await planAllowsWorkspace(context);
      await (allowed === false
        ? dropDowngradedSearchIndex(context, row.id)
        : reconcileTable(context, row.id)
      ).catch((e) =>
        logSearchIndexError(`Search index reconcile failed for ${row.id}`, e),
      );
      cursor = row.id;
    }
    await writeReconcileCursor(
      cursor === ordered[ordered.length - 1]?.id ? null : cursor,
    );
  } finally {
    reconciling = false;
  }
}

/**
 * A plan without search keeps no index: dropped, with its mode kept, so an
 * upgrade builds it again (backfill, or the first search).
 */
async function dropDowngradedSearchIndex(context: NcContext, modelId: string) {
  const model = await Model.get(context, modelId);
  if (!model || !getRawSearchIndexMeta(model)) return;
  const source = await Source.get(context, model.source_id);
  if (!source?.isMeta()) return;
  await dropSearchIndex(context, modelId, await NcConnectionMgrv2.get(source));
}

async function reconcileTable(context: NcContext, modelId: string) {
  const model = await Model.get(context, modelId);
  if (!model) return;
  const source = await Source.get(context, model.source_id);
  if (!source?.isMeta()) return;
  const knex = await NcConnectionMgrv2.get(source);
  const meta = getSearchIndexMeta(model);

  if (meta?.build) {
    await failStaleSearchIndexBuild(context, model, knex);
    return;
  }
  const indexed = meta?.state === 'ready';
  if (indexed) await syncSearchIndexFields(context, model.id, knex);
  if (!indexed && !getSearchDependents(model).length) return;

  let now = new Date().toISOString();
  const since = getSearchSyncedAt(model) ?? meta?.built_at;
  // Re-indexed before the watermark moves, so a failure is retried next pass.
  let covered = true;
  let caughtUp: SearchCatchUp | null = null;
  const walk = getSearchCatchUpWalk(model);
  const budget = { wait: true, maxChunks: walkChunksPerPass() };
  if (walk) {
    caughtUp = await walkSearchIndexCatchUp(context, model, knex, walk, budget);
    // Rows written after the walk began may be behind its cursor.
    now = walk.started_at;
  } else if (since) {
    // The stamps have no index, so the read is a full scan: skipped while
    // Postgres counts no write since the last one. The watermark then stays.
    const writesKey = `${model.source_id}:${model.id}`;
    const writes = await tableWriteCount(context, model, knex);
    if (writes === null || lastWriteCounts.get(writesKey) !== writes) {
      caughtUp = await catchUpSearchIndexWrites(
        context,
        model,
        knex,
        since,
        budget,
      );
      if (writes !== null) lastWriteCounts.set(writesKey, writes);
    }
  }
  if (walk || caughtUp?.resume) {
    await setSearchCatchUpWalk(context, model.id, caughtUp?.resume ?? null);
  }
  if (walk || since) {
    // No timestamp to catch up by, or a walk not done: the watermark stays.
    covered = !!caughtUp && !caughtUp.resume;
  }
  // Marks a flush gave up on; past the cap, the rest next period. On a table
  // only other indexes read, the marks are just its queue.
  const target = searchLiveTarget(model);
  // A first build to resume flushes the rest itself.
  const keepOwn = isSearchIndexResumePending(meta);
  const marks = await readMarks(knex, target, catchUpCap(), await dbNow(knex), {
    propagating: keepOwn,
  }).catch((e) => {
    if (indexed) throw e;
    // No side tables in the base any more: nothing reads through it.
    return [];
  });
  if (marks.length) {
    await searchIndexQueue.apply(
      context,
      model.id,
      marks.map((m) => m.row_id),
    );
    if (keepOwn) await settleMarkPropagation(knex, target, marks);
    else await unmarkRows(knex, target, marks);
  }
  if (indexed && covered) {
    await clearSearchIndexStale(context, model.id, now);
  }
  // With nothing found the watermark stays, up to an hour: a meta write per
  // table per period buys nothing then. A finished walk always moves it, so
  // the next pass doesn't walk from as far back.
  const quiet =
    !caughtUp?.walked &&
    caughtUp?.found === 0 &&
    !caughtUp?.matched &&
    !!since &&
    Date.now() - new Date(since).getTime() < WATERMARK_MAX_AGE_MS;
  if (covered && !quiet) {
    await setSearchSyncedAt(context, model.id, now, meta?.built_at);
  }
}
