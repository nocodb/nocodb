import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type {
  SearchIndexFlushJobData,
  SearchIndexFlushRows,
} from '~/interface/Jobs';
import type { IJobsService } from '~/modules/jobs/jobs-service.interface';
import type { RowStamps, SearchMark } from '~/db/search/searchIndexStore';
import { JobTypes } from '~/interface/Jobs';
import { Model, Source } from '~/models';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  failStaleSearchIndexBuild,
  getModelSql,
  getSearchDependents,
  getSearchIndexMeta,
  isMissingTable,
  isSearchIndexBuildStale,
  isSearchIndexHoldingWrites,
  isSearchIndexResumePending,
  logSearchIndexError,
  markSearchIndexDirty,
  refreshSearchIndex,
  SEARCH_INDEX_SLACK_MS,
  searchIndexBuildsQueued,
  searchIndexBuildsRunning,
  stampAfterSql,
} from '~/db/search/searchIndex';
import { walkDependencyPath } from '~/db/search/searchIndexFields';
import { isSearchIndexDeferred } from '~/db/search/searchIndexScope';
import {
  dbNow,
  forEachIdChunk,
  readMarks,
  readRowStamps,
  recordRowsSeen,
  SEARCH_MARKED_ROWS,
  searchLiveTarget,
  settleMarkPropagation,
  unmarkRows,
} from '~/db/search/searchIndexStore';
import {
  clearSearchIndexStale,
  detachedContext,
  getSearchSyncedAt,
  isSearchIndexingEnabled,
  markSearchIndexStale,
  setSearchSyncedAt,
} from '~/db/search/searchIndexMeta';
import { searchEnvNumber } from '~/db/search/searchEnv';

const FLUSH_DELAY_MS = 2_000;

/** How long dependent rows wait, so writes to the rows they read coalesce; 0 or below = at once. */
function dependentFlushMs() {
  return Math.max(
    0,
    searchEnvNumber('NC_SEARCH_DEPENDENT_FLUSH_MS', 10_000, -Infinity),
  );
}
/** Retries of a failed flush, backing off from 4 s to ~1 min. */
const MAX_FLUSH_RETRIES = 5;
/** While a table first builds, its flushes check back this often. */
const HELD_RETRY_MS = 15_000;
/** Marks a flush reads at a time. */
const DRAIN_BATCH = 5_000;
/** Batches per job; the rest goes to a follow-up job. */
const DRAIN_BATCHES_PER_JOB = 20;
/** A table's flush claim; renewed while it runs. */
const CLAIM_TTL_S = 60;
const CLAIM_RENEW_MS = 20_000;
/** Jobs this process added are forgotten after this, run here or not. */
const ADDED_TTL_MS = 10 * 60_000;
/**
 * A `now` flush job counts as waiting to start for this long: when a worker
 * elsewhere runs it, this process never sees it start.
 */
const NOW_PENDING_MS = 3 * FLUSH_DELAY_MS;
/**
 * Up to this many rows a write marks its rows dirty; past it the table is
 * marked stale (searched live) until a flush has indexed them. As many as
 * a search reads as candidates.
 */
export const SEARCH_DIRTY_CAP = SEARCH_MARKED_ROWS;

/** Rows a write touched: by id, every row, or every row stamped after `since`. */
export type SearchIndexRows = Array<string | number> | null | { since: string };

const isSinceRows = (rows: SearchIndexRows): rows is { since: string } =>
  rows !== null && !Array.isArray(rows);

const markedIds = (marks: SearchMark[]) => marks.map((m) => m.row_id);

/** Ids a flush job may carry; past it the job re-reads every row. */
const MAX_JOB_IDS = 50_000;

const toFlushRows = (rows: SearchIndexRows): SearchIndexFlushRows =>
  rows === null || (Array.isArray(rows) && rows.length > MAX_JOB_IDS)
    ? { all: true }
    : Array.isArray(rows)
    ? { ids: rows }
    : { since: rows.since };

/**
 * The source's own connection, resolved at flush time: a writer's driver can
 * be a transaction that has ended by then.
 */
export async function sourceKnex(context: NcContext, model: Model) {
  const source = await Source.get(context, model.source_id);
  if (!source) NcError.get(context).sourceNotFound(model.source_id);
  return NcConnectionMgrv2.get(source);
}

function jobsService(): IJobsService | undefined {
  try {
    return Noco.nestApp?.get<IJobsService>('JobsService', { strict: false });
  } catch {
    return undefined;
  }
}

const claimKey = (modelId: string) => `search_index:flush:${modelId}`;

/**
 * Flushes as jobs on the worker queue. A write marks its rows (the marks are
 * the queue, so nothing is lost on a restart) and adds one job per table per
 * 2 s window; the job reads the marks, walks written rows to the indexes that
 * show them, re-derives the cells and clears what it read. Bulk writes (every
 * row, rows stamped after a time, or more ids than are marked) travel in the
 * job instead. One flush per table at a time across instances, by a claim.
 */
class SearchIndexQueue {
  /** Jobs added by this process, by key: dedupes a window, and `idle()`. */
  private added = new Map<string, number>();
  /** A table's latest `now` flush job and when it was added. */
  private nowJobs = new Map<string, { key: string; at: number }>();
  /** Tables whose claim this process holds. */
  private running = new Set<string>();
  /** Flush jobs running in this process. */
  private active = 0;
  /** Marks and adds started without a caller awaiting them. */
  private pending = new Set<Promise<unknown>>();
  /** Tables whose flushes wait for a bulk write here; `due`: one was asked for. */
  private held = new Map<
    string,
    { count: number; due: boolean; context: NcContext }
  >();

  /**
   * Hold the table's flushes in this process while a bulk write (an import)
   * runs. Its rows are still marked, so search finds them; the release flushes
   * them at once, instead of every window competing with the writes.
   * Flushes queued by other processes still run.
   */
  hold(context: NcContext, modelId: string) {
    const held = this.held.get(modelId) ?? {
      count: 0,
      due: false,
      context: detachedContext(context),
    };
    held.count++;
    this.held.set(modelId, held);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--held.count > 0) return;
      this.held.delete(modelId);
      if (held.due) this.scheduleFlush(held.context, modelId, true);
    };
  }

  /**
   * A write committed on `model`: mark its rows dirty (or the table stale)
   * so search finds them now, and queue a flush. Never throws.
   */
  async track(context: NcContext, model: Model, rows: SearchIndexRows) {
    if (isSearchIndexDeferred(model.id)) return;
    await this.queue(context, model, rows, { propagate: true }).catch((e) =>
      logSearchIndexError(`Search index tracking failed for ${model.id}`, e),
    );
  }

  /** Search scans the table until its unindexed rows are indexed. Never throws. */
  async markStale(context: NcContext, modelId: string) {
    await markSearchIndexStale(
      context,
      modelId,
      new Date().toISOString(),
    ).catch((e) =>
      logSearchIndexError(`Search index stale mark failed for ${modelId}`, e),
    );
  }

  /** Test hook: resolves once nothing is building, queued or flushing here. */
  async idle(timeoutMs = 60_000) {
    const until = Date.now() + timeoutMs;
    for (;;) {
      this.forgetOldJobs();
      if (
        !this.pending.size &&
        !this.added.size &&
        !this.running.size &&
        !this.active &&
        !searchIndexBuildsQueued() &&
        !searchIndexBuildsRunning()
      ) {
        return;
      }
      if (Date.now() > until) throw new Error('Search index queue not idle');
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Queue rows for a flush: ids are marked, every row or a `since` go in the
   * job. `propagate`: written rows, walked to the indexes that read them.
   * `marked`: the write marked them already. Never throws.
   */
  enqueue(
    context: NcContext,
    modelId: string,
    rows: SearchIndexRows,
    {
      propagate = true,
      stale = false,
      marked = false,
    }: { propagate?: boolean; stale?: boolean; marked?: boolean } = {},
  ) {
    if (isSearchIndexDeferred(modelId)) return;
    context = detachedContext(context);
    if (marked) {
      this.scheduleFlush(context, modelId);
      return;
    }
    this.background(
      (async () => {
        const model = await Model.get(context, modelId);
        if (!model) return;
        await this.queue(context, model, rows, { propagate, stale });
      })().catch((e) =>
        logSearchIndexError(`Search index queueing failed for ${modelId}`, e),
      ),
    );
  }

  /** Flush the table's marks now, e.g. once a first build has made it ready. */
  flushNow(context: NcContext, modelId: string) {
    const key = `${JobTypes.SearchIndexFlush}:${modelId}:now:${Date.now()}`;
    this.addJob(detachedContext(context), modelId, key, {}, 0);
  }

  /**
   * Re-index `rows` and the dependent rows that show them, now rather than
   * queued; throws on failure.
   */
  async apply(context: NcContext, modelId: string, rows: SearchIndexRows) {
    context = detachedContext(context);
    const model = await Model.get(context, modelId);
    if (!model) return;
    const knex = await sourceKnex(context, model);
    await this.exclusive(modelId, async () => {
      if (isSinceRows(rows)) {
        return this.applySince(context, model, knex, rows.since);
      }
      const seen = rows && (await this.readSeen(context, model, knex, rows));
      await refreshSearchIndex(context, model, knex, rows, { noSeen: true });
      await this.applyToDependents(context, model, knex, rows);
      await this.recordSeen(model, knex, seen);
    });
  }

  /**
   * Versions of rows about to be fanned out, read first so a write landing
   * meanwhile stays due for the reconcile. `ownRefresh`: an indexed table's
   * refresh records its own.
   */
  private async readSeen(
    context: NcContext,
    model: Model,
    knex: Knex,
    ids: Array<string | number>,
    ownRefresh = false,
  ): Promise<RowStamps | undefined> {
    if (ownRefresh && getSearchIndexMeta(model)?.state === 'ready') return;
    await model.getColumns();
    return readRowStamps(await getModelSql(context, model, knex), ids);
  }

  /** Rows whose fan-out is done: their versions, so the reconcile skips them. */
  private async recordSeen(model: Model, knex: Knex, seen?: RowStamps) {
    await recordRowsSeen(knex, searchLiveTarget(model), seen);
  }

  /**
   * The flush job: the table's marks, or the rows the job carries. Its key is
   * freed as it starts: it reads only marks set before then, so a write
   * landing meanwhile needs a job of its own.
   */
  async runJob(data: SearchIndexFlushJobData) {
    this.added.delete(data.key);
    if (this.nowJobs.get(data.modelId)?.key === data.key) {
      this.nowJobs.delete(data.modelId);
    }
    this.active++;
    try {
      await this.runFlush(data);
    } finally {
      this.active--;
    }
  }

  private async runFlush(data: SearchIndexFlushJobData) {
    if (!isSearchIndexingEnabled()) return;
    const context = detachedContext(data.context);
    const { modelId } = data;
    const release = await this.claim(modelId);
    if (!release) {
      // Another flush of the table runs: this one goes after it.
      this.retryLater(context, data, FLUSH_DELAY_MS, data.attempt ?? 0);
      return;
    }
    try {
      const model = await Model.get(context, modelId);
      if (!model) return;
      const knex = await sourceKnex(context, model);
      const meta = getSearchIndexMeta(model);
      // Held while a first build runs: the build flushes when it is done,
      // and this checks back in case it doesn't. A dead build is failed.
      if (isSearchIndexBuildStale(meta)) {
        await failStaleSearchIndexBuild(context, model, knex);
      } else if (isSearchIndexHoldingWrites(meta)) {
        this.retryLater(context, data, HELD_RETRY_MS, data.attempt ?? 0);
        return;
      }
      if (data.rows) await this.flushRows(context, model, knex, data);
      else await this.drain(context, model, knex);
    } catch (e) {
      logSearchIndexError(`Search index flush failed for ${modelId}`, e);
      // The table or its index was dropped: a retry fails the same way.
      if (isMissingTable(e)) return;
      const attempt = (data.attempt ?? 0) + 1;
      if (attempt > MAX_FLUSH_RETRIES) {
        // Marks stay for the reconcile; carried rows are caught up by stamp.
        logSearchIndexError(
          `Search index flush for ${modelId} gave up`,
          data.rows ? 'carried rows not re-indexed' : 'marks left in place',
        );
        return;
      }
      this.retryLater(context, data, FLUSH_DELAY_MS * 2 ** attempt, attempt);
    } finally {
      await release();
    }
  }

  /**
   * Marks set before this run, in batches: written rows are walked to the
   * indexes that read them first, then the cells are re-derived, then the
   * marks cleared. A mark set again meanwhile stays for its own job. While a
   * first build waits to resume, marks are only walked: they stay for it.
   */
  private async drain(context: NcContext, model: Model, knex: Knex) {
    const target = searchLiveTarget(model);
    const before = await dbNow(knex);
    const meta = getSearchIndexMeta(model);
    const indexed = meta?.state === 'ready';
    const keepOwn = isSearchIndexResumePending(meta);
    for (let batch = 0; batch < DRAIN_BATCHES_PER_JOB; batch++) {
      const marks = await readMarks(knex, target, DRAIN_BATCH, before, {
        propagating: keepOwn,
      });
      if (!marks.length) return;
      const written = marks.filter((m) => m.propagate).map((m) => m.row_id);
      const seen =
        !indexed && written.length
          ? await this.readSeen(context, model, knex, written)
          : undefined;
      if (written.length) await this.propagate(context, model, knex, written);
      if (indexed) await this.refreshMarked(context, model, knex, marks);
      else await this.recordSeen(model, knex, seen);
      if (keepOwn) await settleMarkPropagation(knex, target, marks);
      else await unmarkRows(knex, target, marks);
      if (marks.length < DRAIN_BATCH) return;
    }
    this.scheduleFlush(context, model.id);
  }

  /**
   * Rows owing every field together; the others by the fields they owe. The
   * marks are cleared after, not by the refresh: a write marking a row then
   * never waits on the refresh statement's locks.
   */
  private async refreshMarked(
    context: NcContext,
    model: Model,
    knex: Knex,
    marks: SearchMark[],
  ) {
    const full = marks.filter((m) => !m.fields?.length);
    if (full.length) {
      await refreshSearchIndex(context, model, knex, markedIds(full), {
        keepDirty: true,
      });
    }
    const scoped = new Map<string, SearchMark[]>();
    for (const m of marks) {
      if (!m.fields?.length) continue;
      const key = [...m.fields].sort().join();
      scoped.set(key, [...(scoped.get(key) ?? []), m]);
    }
    for (const [key, group] of scoped) {
      await refreshSearchIndex(context, model, knex, markedIds(group), {
        onlyFields: new Set(key.split(',')),
        keepDirty: true,
      });
    }
  }

  /** Rows the job carries: ids whose marks failed, every row, or a `since`. */
  private async flushRows(
    context: NcContext,
    model: Model,
    knex: Knex,
    data: SearchIndexFlushJobData,
  ) {
    const rows = data.rows;
    const startedAt = new Date().toISOString();
    if ('ids' in rows) {
      const seen = data.propagate
        ? await this.readSeen(context, model, knex, rows.ids, true)
        : undefined;
      if (data.propagate) {
        await this.propagate(context, model, knex, rows.ids);
      }
      await refreshSearchIndex(context, model, knex, rows.ids);
      await this.recordSeen(model, knex, seen);
    } else {
      await this.bulkPass(context, model, knex, rows, !!data.propagate);
    }
    if (data.stale || !('ids' in rows)) {
      await clearSearchIndexStale(context, model.id, startedAt);
    }
    if ('since' in rows) {
      await this.advanceWatermark(context, model, rows.since, startedAt);
    }
  }

  /**
   * A pass over the rows stamped after a `since` at or before the watermark
   * covers everything up to its start: move the watermark there, or the next
   * reconcile re-reads the same rows. Not with dependents: their rows are
   * only marked, and the reconcile is what clears marks a flush gave up on.
   */
  private async advanceWatermark(
    context: NcContext,
    model: Model,
    since: string,
    startedAt: string,
  ) {
    if (getSearchDependents(model).length) return;
    const meta = getSearchIndexMeta(model);
    const watermark = getSearchSyncedAt(model) ?? meta?.built_at;
    if (!watermark || since > watermark) return;
    await setSearchSyncedAt(
      context,
      model.id,
      new Date(
        new Date(startedAt).getTime() - SEARCH_INDEX_SLACK_MS,
      ).toISOString(),
      meta?.built_at,
    );
  }

  /**
   * Every row, or the rows stamped after `since`, in keyset chunks; each
   * chunk is walked to the dependent tables as it is written. Marked rows
   * are left to their own flush.
   */
  private async bulkPass(
    context: NcContext,
    model: Model,
    knex: Knex,
    rows: { since: string } | { all: true },
    propagate: boolean,
  ) {
    await model.getColumns();
    const since = 'since' in rows ? rows.since : undefined;
    const where = since ? stampAfterSql(knex, model, since) : undefined;
    if (since && !where) return;
    // Read before the chunk's refresh, recorded once it is walked.
    let seen: RowStamps | undefined;
    const readChunk = async (chunk: Array<string | number>) => {
      seen = await this.readSeen(context, model, knex, chunk);
    };
    const onChunk =
      since && propagate
        ? async (chunk: Array<string | number>) => {
            await this.propagate(context, model, knex, chunk);
            await this.recordSeen(model, knex, seen);
            seen = undefined;
          }
        : undefined;
    if (getSearchIndexMeta(model)?.state === 'ready') {
      await refreshSearchIndex(context, model, knex, null, {
        where,
        keepDirty: true,
        beforeChunk: onChunk && readChunk,
        onChunk,
        noSeen: propagate,
      });
    } else if (onChunk) {
      // Only read through by other indexes.
      await forEachIdChunk(
        await getModelSql(context, model, knex),
        where,
        async (chunk) => {
          await readChunk(chunk);
          await onChunk(chunk);
        },
      );
    }
    if (!since && propagate) await this.propagate(context, model, knex, null);
  }

  /**
   * Mark the rows of each dependent index that show `changed` (null = every
   * row) and queue their flush, without a window of its own: this flush's
   * window already batched the writes. Re-indexing only: not walked further,
   * so tables that read each other don't bounce rows between them.
   */
  private async propagate(
    context: NcContext,
    model: Model,
    knex: Knex,
    changed: Array<string | number> | null,
  ) {
    const dependents = getSearchDependents(model);
    if (!dependents.length) return;
    const baseModel = await getModelSql(context, model, knex);
    let failed: unknown;

    for (const dependent of dependents) {
      try {
        const rows =
          changed === null
            ? null
            : await walkDependencyPath(baseModel, dependent.links, changed);
        if (rows !== null && !rows.length) continue;
        const target = await Model.get(context, dependent.table_id);
        const meta = target && getSearchIndexMeta(target);
        if (!meta || (meta.state !== 'ready' && !meta.build)) continue;
        await this.queue(context, target, rows, {
          propagate: false,
          fields: dependent.fields,
          ...(dependentFlushMs()
            ? { windowMs: dependentFlushMs() }
            : { now: true }),
        });
      } catch (e) {
        logSearchIndexError(
          `Search index propagation ${model.id} → ${dependent.table_id} failed`,
          e,
        );
        failed = e;
      }
    }
    // Retried as a whole: marking and queueing are idempotent.
    if (failed) throw failed;
  }

  /**
   * Mark `rows` and queue a flush of the marks; past the cap, for every row
   * or a `since`, mark the table stale and carry the rows in a job. Throws
   * when neither the marks nor the job could be written. `now`: flush without
   * waiting for a window.
   */
  private async queue(
    context: NcContext,
    model: Model,
    rows: SearchIndexRows,
    {
      propagate,
      stale = false,
      now = false,
      windowMs,
      fields,
    }: {
      propagate: boolean;
      stale?: boolean;
      now?: boolean;
      windowMs?: number;
      /** Only these fields of the rows changed; unset = every field. */
      fields?: string[];
    },
  ) {
    context = detachedContext(context);
    const meta = getSearchIndexMeta(model);
    const indexed = meta?.state === 'ready' || !!meta?.build;
    if (Array.isArray(rows)) {
      if (!rows.length) return;
      if (rows.length <= SEARCH_DIRTY_CAP) {
        try {
          const knex = await sourceKnex(context, model);
          if (
            await markSearchIndexDirty(model, knex, rows, { propagate, fields })
          ) {
            this.scheduleFlush(context, model.id, now, windowMs);
            return;
          }
        } catch (e) {
          // E.g. a lock wait behind a swap: not worth holding the request.
          logSearchIndexError(
            `Search index dirty mark failed for ${model.id}`,
            e,
          );
        }
      }
    }
    if (!indexed && !(propagate && getSearchDependents(model).length)) return;
    if (indexed) await this.markStale(context, model.id);
    const key = `${JobTypes.SearchIndexFlush}:${model.id}:rows:${Date.now()}:${
      this.added.size
    }`;
    await this.addJob(
      context,
      model.id,
      key,
      { rows: toFlushRows(rows), propagate, stale: stale || indexed },
      now ? 0 : windowMs ?? FLUSH_DELAY_MS,
    );
  }

  /**
   * One flush of the table's marks per window, across instances. `now`: a
   * flush of its own, started at once; it may start inside the window, so it
   * can't stand for marks set later in it. While one waits to start, the
   * window's flush is queued instead: up to `NOW_PENDING_MS` when it runs on
   * another process, which never reports it started.
   */
  private scheduleFlush(
    context: NcContext,
    modelId: string,
    now = false,
    windowMs = FLUSH_DELAY_MS,
  ) {
    const held = this.held.get(modelId);
    if (held) {
      held.due = true;
      return;
    }
    if (now && this.nowJobPending(modelId)) now = false;
    const key = now
      ? `${JobTypes.SearchIndexFlush}:${modelId}:now:${Date.now()}:${
          this.added.size
        }`
      : `${JobTypes.SearchIndexFlush}:${modelId}:${
          windowMs === FLUSH_DELAY_MS ? '' : `w${windowMs}:`
        }${Math.floor(Date.now() / windowMs)}`;
    if (this.added.has(key)) return;
    const job = this.addJob(context, modelId, key, {}, now ? 0 : windowMs);
    if (now) this.nowJobs.set(modelId, { key, at: Date.now() });
    this.background(
      job.catch((e) =>
        logSearchIndexError(
          `Search index flush queueing failed for ${modelId}`,
          e,
        ),
      ),
    );
  }

  /** Run the job again later; a drain goes to its window, carried rows keep theirs. */
  private retryLater(
    context: NcContext,
    data: SearchIndexFlushJobData,
    delay: number,
    attempt: number,
  ) {
    const key = data.rows
      ? `${JobTypes.SearchIndexFlush}:${
          data.modelId
        }:rows:${Date.now()}:${attempt}`
      : `${JobTypes.SearchIndexFlush}:${data.modelId}:${Math.floor(
          (Date.now() + delay) / FLUSH_DELAY_MS,
        )}`;
    if (this.added.has(key)) return;
    this.background(
      this.addJob(
        context,
        data.modelId,
        key,
        {
          rows: data.rows,
          propagate: data.propagate,
          stale: data.stale,
          attempt,
        },
        delay,
      ).catch((e) =>
        logSearchIndexError(
          `Search index flush retry failed for ${data.modelId}`,
          e,
        ),
      ),
    );
  }

  private async addJob(
    context: NcContext,
    modelId: string,
    key: string,
    extra: Partial<SearchIndexFlushJobData>,
    delay: number,
  ) {
    if (this.added.has(key)) return;
    this.forgetOldJobs();
    this.added.set(key, Date.now());
    const data: Omit<SearchIndexFlushJobData, 'jobName'> = {
      context,
      user: undefined,
      modelId,
      key,
      ...extra,
    };
    const jobs = jobsService();
    if (!jobs) {
      // No Nest app (a script): run it in this process.
      const timer = setTimeout(() => {
        void this.runJob(data as SearchIndexFlushJobData).catch((e) =>
          logSearchIndexError(`Search index flush failed for ${modelId}`, e),
        );
      }, delay);
      timer.unref?.();
      return;
    }
    try {
      await jobs.add(JobTypes.SearchIndexFlush, data, {
        jobId: key,
        ...(delay ? { delay } : {}),
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (e) {
      this.added.delete(key);
      throw e;
    }
  }

  /** The table's `now` flush job hasn't started, as far as this process knows. */
  private nowJobPending(modelId: string) {
    const job = this.nowJobs.get(modelId);
    return (
      !!job && this.added.has(job.key) && Date.now() - job.at < NOW_PENDING_MS
    );
  }

  /** A job run elsewhere never reports back here. */
  private forgetOldJobs() {
    const cutoff = Date.now() - ADDED_TTL_MS;
    for (const [key, at] of this.added) {
      if (at < cutoff) this.added.delete(key);
    }
    for (const modelId of this.nowJobs.keys()) {
      if (!this.nowJobPending(modelId)) this.nowJobs.delete(modelId);
    }
  }

  /** Work {@link idle} waits for. */
  background(promise: Promise<unknown>) {
    this.pending.add(promise);
    void promise.finally(() => this.pending.delete(promise));
  }

  /**
   * Take the table's flush claim, renewed until released; undefined when
   * another flush holds it. An unreachable cache takes it anyway: the lock
   * in each refresh still keeps two writers apart.
   */
  private async claim(
    modelId: string,
  ): Promise<(() => Promise<void>) | undefined> {
    if (this.running.has(modelId)) return undefined;
    const holder = `${process.pid}:${Date.now()}:${Math.random()}`;
    const key = claimKey(modelId);
    const taken = await NocoCache.setIfNotExist(
      'root',
      key,
      holder,
      CLAIM_TTL_S,
    ).catch(() => true);
    if (!taken) return undefined;
    this.running.add(modelId);
    const renew = setInterval(() => {
      NocoCache.expireIfValue('root', key, holder, CLAIM_TTL_S).catch((e) =>
        logSearchIndexError(`Search index flush claim renewal failed`, e),
      );
    }, CLAIM_RENEW_MS);
    renew.unref?.();
    return async () => {
      clearInterval(renew);
      this.running.delete(modelId);
      await NocoCache.delIfValue('root', key, holder).catch(() => undefined);
    };
  }

  /** Runs `fn` holding the table's claim, waiting for a flush that has it. */
  private async exclusive<T>(modelId: string, fn: () => Promise<T>) {
    let release = await this.claim(modelId);
    while (!release) {
      await new Promise((r) => setTimeout(r, 200));
      release = await this.claim(modelId);
    }
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  /** The rows stamped after `since`, in keyset chunks, as a flush's bulk pass. */
  private async applySince(
    context: NcContext,
    model: Model,
    knex: Knex,
    since: string,
  ) {
    await model.getColumns();
    const where = stampAfterSql(knex, model, since);
    if (!where) return;
    const onChunk = (chunk: Array<string | number>) =>
      this.applyToDependents(context, model, knex, chunk);
    if (getSearchIndexMeta(model)?.state === 'ready') {
      await refreshSearchIndex(context, model, knex, null, {
        where,
        keepDirty: true,
        onChunk,
      });
    } else {
      await forEachIdChunk(
        await getModelSql(context, model, knex),
        where,
        onChunk,
      );
    }
  }

  private async applyToDependents(
    context: NcContext,
    model: Model,
    knex: Knex,
    ids: Array<string | number> | null,
  ) {
    const dependents = getSearchDependents(model);
    if (!dependents.length) return;
    const baseModel = await getModelSql(context, model, knex);
    for (const dependent of dependents) {
      const rows =
        ids === null
          ? null
          : await walkDependencyPath(baseModel, dependent.links, ids);
      if (rows !== null && !rows.length) continue;
      const target = await Model.get(context, dependent.table_id);
      if (!target) continue;
      const targetKnex = await sourceKnex(context, target);
      const write = () => refreshSearchIndex(context, target, targetKnex, rows);
      // Kept out of the dependent's own flush, as for the source table. Its
      // claim is already held when it links to itself.
      if (target.id === model.id) await write();
      else await this.exclusive(target.id, write);
    }
  }
}

export const searchIndexQueue = new SearchIndexQueue();
