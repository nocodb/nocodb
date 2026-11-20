import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppEvents, isSystemColumn } from 'nocodb-sdk';
import type { SearchIndexMode, SearchIndexStatus } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import type { IndexField } from '~/db/search/searchIndexFields';
import type {
  GlobalSearchMode,
  GlobalSearchModeStatus,
} from '~/db/search/searchIndexMeta';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Column, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { assertGlobalSearchAllowed } from '~/helpers/globalSearchGate';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  dropSearchIndex,
  getSearchDependents,
  getSearchIndexBuildError,
  getSearchIndexMeta,
  interruptSearchIndexBuilds,
  isColumnServedByIndex,
  isSlowLiveField,
  searchIndexBlocker,
  searchIndexFailures,
  searchIndexRetryAt,
  searchIndexSizeBlocker,
} from '~/db/search/searchIndex';
import { resolveIndexFields } from '~/db/search/searchIndexFields';
import {
  detachedContext,
  getEnvGlobalSearchMode,
  getGlobalSearchMode,
  getGlobalSearchOverride,
  getRawSearchIndexMeta,
  getSearchIndexMode,
  isGlobalSearchEnabled,
  isSearchIndexingEnabled,
  loadGlobalSearchOverride,
  SEARCH_INDEX_FORMAT,
  setGlobalSearchOverride,
  setSearchIndexMode,
} from '~/db/search/searchIndexMeta';
import {
  searchLiveTarget,
  searchTargetSize,
} from '~/db/search/searchIndexStore';
import {
  clearSearchIndexBuildQueued,
  isSearchIndexBuildQueued,
  markSearchIndexesStale,
  runClaimedSearchIndexReconcile,
  scheduleSearchIndexFieldSync,
  searchIndexReconcileEveryMs,
  startSearchIndexBuild,
  syncSearchIndexFields,
} from '~/db/search/searchIndexSync';

const MODES: SearchIndexMode[] = ['auto', 'on', 'off'];
const GLOBAL_MODES: GlobalSearchMode[] = ['off', 'index', 'on'];
const RECONCILE_FIRST_MS = 60_000;
const GLOBAL_MODE_REFRESH_MS = 30_000;
/** Claim for the reconcile after a resume when the periodic one is off. */
const RESUME_RECONCILE_CLAIM_MS = 60_000;

/** The in-process queue repeats by cron only. */
function everyAsCron(everyMs: number) {
  const minutes = Math.max(1, Math.round(everyMs / 60_000));
  if (minutes < 60) return `*/${minutes} * * * *`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `0 */${hours} * * *` : '0 0 * * *';
}

@Injectable()
export class SearchIndexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexService.name);
  private unsubscribers: Array<() => void> = [];
  private globalModeTimer?: NodeJS.Timeout;
  private resumeTimer?: NodeJS.Timeout;

  constructor(
    private readonly appHooksService: AppHooksService,
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      await this.startGlobalModeRefresh();
      this.scheduleReconcile().catch((e) =>
        this.logger.error(
          `Search index reconcile scheduling failed: ${e?.message}`,
        ),
      );
    }
    // Wired whatever the mode: each handler checks it per call.
    const onColumn = (data: {
      context: NcContext;
      table?: { id?: string };
      column?: { fk_model_id?: string };
    }) => {
      const tableId = data.table?.id ?? data.column?.fk_model_id;
      if (tableId) scheduleSearchIndexFieldSync(data.context, tableId);
    };
    this.unsubscribers.push(
      this.appHooksService.on(AppEvents.COLUMN_CREATE, onColumn),
      this.appHooksService.on(AppEvents.COLUMN_UPDATE, onColumn),
      this.appHooksService.on(AppEvents.COLUMN_DELETE, onColumn),
      this.appHooksService.on(AppEvents.RELATION_CREATE, onColumn),
      this.appHooksService.on(AppEvents.RELATION_DELETE, onColumn),
      this.appHooksService.on(AppEvents.RESOURCE_RESTORE, (data) => {
        if (!isSearchIndexingEnabled()) return;
        this.syncAfterRestore(detachedContext(data.context), data).catch((e) =>
          this.logger.error(
            `Search index restore sync failed for ${data.resourceId}: ${e?.message}`,
          ),
        );
      }),
    );

    // A lookup's conditions are saved apart from the column. Its sorts emit
    // no event: the UI saves them with the column (COLUMN_UPDATE), and a raw
    // sort op is picked up by the periodic field sync.
    const onLookupConfig = (data: {
      context: NcContext;
      filter?: { fk_link_col_id?: string };
    }) => {
      const colId = data.filter?.fk_link_col_id;
      if (!colId || !data.context || !isSearchIndexingEnabled()) return;
      Column.get(data.context, { colId })
        .then((column) => {
          if (column?.fk_model_id) {
            scheduleSearchIndexFieldSync(data.context, column.fk_model_id);
          }
        })
        .catch(() => undefined);
    };
    this.unsubscribers.push(
      this.appHooksService.on(AppEvents.FILTER_CREATE, onLookupConfig),
      this.appHooksService.on(AppEvents.FILTER_UPDATE, onLookupConfig),
      this.appHooksService.on(AppEvents.FILTER_DELETE, onLookupConfig),
    );
  }

  /** Loads the runtime override now, then every period. */
  private async startGlobalModeRefresh() {
    if (getEnvGlobalSearchMode() === 'off') return;
    const refresh = () =>
      loadGlobalSearchOverride().catch((e) =>
        this.logger.error(`Global search mode refresh failed: ${e?.message}`),
      );
    await refresh();
    this.globalModeTimer = setInterval(refresh, GLOBAL_MODE_REFRESH_MS);
    this.globalModeTimer.unref?.();
  }

  async onModuleDestroy() {
    clearInterval(this.globalModeTimer);
    clearTimeout(this.resumeTimer);
    for (const off of this.unsubscribers) off();
    await interruptSearchIndexBuilds().catch((e) =>
      this.logger.error(`Search index interrupt failed: ${e?.message}`),
    );
  }

  /**
   * The reconcile as a repeatable job on the worker queue, plus one pass
   * shortly after startup. A schedule from another period setting, or with
   * the env mode off, is removed. Each run is claimed per period, so
   * instances adding it at once run it once. The run checks the runtime mode
   * itself, so an override needs no re-scheduling.
   */
  private async scheduleReconcile() {
    const queue = this.jobsService?.jobsQueue;
    if (!queue) return;
    const every =
      getEnvGlobalSearchMode() !== 'off' ? searchIndexReconcileEveryMs() : 0;
    const data = { jobName: JobTypes.SearchIndexReconcile };
    if (typeof queue.getRepeatableJobs === 'function') {
      for (const job of await queue.getRepeatableJobs()) {
        if (job.id === JobTypes.SearchIndexReconcile && job.every !== every) {
          await queue.removeRepeatableByKey(job.key);
        }
      }
      if (!every) return;
      await queue.add(data, {
        jobId: JobTypes.SearchIndexReconcile,
        repeat: { every },
        removeOnComplete: true,
        removeOnFail: true,
      });
    } else {
      if (!every) return;
      await queue.add(data, {
        jobId: JobTypes.SearchIndexReconcile,
        repeat: { cron: everyAsCron(every) },
      });
    }
    await this.jobsService.add(JobTypes.SearchIndexReconcile, data, {
      jobId: `${JobTypes.SearchIndexReconcile}:startup:${Math.floor(
        Date.now() / every,
      )}`,
      delay: RECONCILE_FIRST_MS,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  /**
   * A restored table or field: documents written while it was in the trash
   * lack its text (and linked writes to a trashed table were dropped), with
   * nothing marking the fields. Forced unbuilt, they are searched live until
   * the rebuild this starts.
   */
  private async syncAfterRestore(
    context: NcContext,
    data: { resourceType: string; resourceId: string },
  ) {
    let tableId = data.resourceId;
    let restoredField: string | undefined;
    if (data.resourceType === 'field') {
      const column = await Column.get(context, { colId: data.resourceId });
      if (!column) return;
      tableId = column.fk_model_id;
      restoredField = column.id;
    } else if (data.resourceType !== 'table') {
      return;
    }
    const model = await Model.get(context, tableId);
    if (!model) return;
    const dependents = getSearchDependents(model);
    if (!getSearchIndexMeta(model) && !dependents.length) return;
    const knex = await this.knexFor(context, model);

    const forced = async (target: Model, reads: (f: IndexField) => boolean) =>
      (await resolveIndexFields(context, target))
        .filter(reads)
        .map((f) => f.column.id);

    if (getSearchIndexMeta(model)) {
      const columnIds = restoredField
        ? [restoredField]
        : await forced(model, (f) => f.paths.length > 0);
      await syncSearchIndexFields(context, model.id, knex, { columnIds });
    }
    const seen = new Set<string>([model.id]);
    for (const dependent of dependents) {
      if (seen.has(dependent.table_id)) continue;
      seen.add(dependent.table_id);
      const target = await Model.get(context, dependent.table_id);
      if (!target || !getSearchIndexMeta(target)) continue;
      // Paths list every table they pass, so this covers deeper lookups too.
      const columnIds = await forced(target, (f) =>
        f.paths.some((p) => p.end === model.id),
      );
      await syncSearchIndexFields(context, target.id, knex, { columnIds });
    }
  }

  private async knexFor(context: NcContext, model: Model) {
    const source = await Source.get(context, model.source_id);
    if (!source) NcError.get(context).sourceNotFound(model.source_id);
    return NcConnectionMgrv2.get(source);
  }

  private async getModel(context: NcContext, tableId: string) {
    const model = await Model.get(context, tableId);
    if (!model) NcError.get(context).tableNotFound(tableId);
    // The eligibility check reads the primary key.
    await model.getColumns();
    return model;
  }

  /** Server-wide: the env mode, and the runtime override if one is stored. */
  async globalModeGet(): Promise<GlobalSearchModeStatus> {
    return {
      env: getEnvGlobalSearchMode(),
      override: getGlobalSearchOverride() ?? null,
      mode: getGlobalSearchMode(),
    };
  }

  /** `mode` null clears the override. Can only lower the env mode. */
  async globalModeSet(param: { mode?: GlobalSearchMode | null }) {
    if (
      param.mode === undefined ||
      (param.mode !== null && !GLOBAL_MODES.includes(param.mode))
    ) {
      NcError.badRequest('mode must be off, index, on or null');
    }
    const wasIndexing = isSearchIndexingEnabled();
    await setGlobalSearchOverride(param.mode);
    if (!wasIndexing && isSearchIndexingEnabled()) {
      // Awaited: until a table is marked, search would serve its old cells
      // without reporting `catching_up`.
      await markSearchIndexesStale(new Date().toISOString()).catch((e) =>
        this.logger.error(`Search index stale marking failed: ${e?.message}`),
      );
      this.reconcileAfterResume();
    }
    return this.globalModeGet();
  }

  /**
   * Catches indexes up from their watermarks once other instances have read
   * the new mode: until then their writes may still go untracked.
   */
  private reconcileAfterResume() {
    if (process.env.NODE_ENV === 'test') return;
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      runClaimedSearchIndexReconcile(
        searchIndexReconcileEveryMs() || RESUME_RECONCILE_CLAIM_MS,
      ).catch((e) =>
        this.logger.error(`Search index reconcile failed: ${e?.message}`),
      );
    }, GLOBAL_MODE_REFRESH_MS + 5_000);
    this.resumeTimer.unref?.();
  }

  async build(context: NcContext, param: { tableId: string }) {
    if (!isSearchIndexingEnabled()) {
      NcError.get(context).badRequest(
        'Search indexing is turned off on this server',
      );
    }
    await assertGlobalSearchAllowed(context);
    const model = await this.getModel(context, param.tableId);
    const blocker = await searchIndexBlocker(
      context,
      model,
      await this.knexFor(context, model),
      { retry: true },
    );
    if (blocker) NcError.get(context).badRequest(blocker);
    await setSearchIndexMode(context, model.id, 'on');
    await startSearchIndexBuild(
      context,
      model.id,
      await this.knexFor(context, model),
      { explicit: true },
    );
    return this.status(context, param);
  }

  async drop(context: NcContext, param: { tableId: string }) {
    const model = await this.getModel(context, param.tableId);
    await setSearchIndexMode(context, model.id, 'off');
    await clearSearchIndexBuildQueued(model.id);
    // A table that can't have an index, and never had one, has nothing to drop.
    if (
      !getRawSearchIndexMeta(model) &&
      (await searchIndexBlocker(context, model))
    ) {
      return this.status(context, param);
    }
    await dropSearchIndex(
      context,
      model.id,
      await this.knexFor(context, model),
    );
    return this.status(context, param);
  }

  async setMode(
    context: NcContext,
    param: { tableId: string; mode: SearchIndexMode },
  ) {
    if (!MODES.includes(param.mode)) {
      NcError.get(context).invalidRequestBody(
        `mode must be one of ${MODES.join(', ')}`,
      );
    }
    if (param.mode === 'on') return this.build(context, param);
    if (param.mode === 'off') return this.drop(context, param);
    const model = await this.getModel(context, param.tableId);
    await setSearchIndexMode(context, model.id, 'auto');
    return this.status(context, param);
  }

  async status(
    context: NcContext,
    param: { tableId: string },
  ): Promise<SearchIndexStatus> {
    const model = await this.getModel(context, param.tableId);
    const columns = await model.getColumns();
    const raw = getRawSearchIndexMeta(model);
    const meta = getSearchIndexMeta(model);
    const status: SearchIndexStatus = {
      mode: getSearchIndexMode(model),
      state: !raw
        ? 'none'
        : raw.format !== SEARCH_INDEX_FORMAT
        ? 'outdated'
        : meta.state,
      rebuilding: !!meta?.build && meta.state === 'ready',
      fields: { indexed: 0, pending: 0 },
      enabled: isSearchIndexingEnabled(),
      searchEnabled: isGlobalSearchEnabled(),
      unavailable: await searchIndexBlocker(
        context,
        model,
        await this.knexFor(context, model).catch(() => undefined),
      ),
    };
    if (!status.unavailable && !raw && status.mode === 'auto') {
      const knex = await this.knexFor(context, model).catch(() => undefined);
      if (knex) {
        status.too_large = await searchIndexSizeBlocker(
          context,
          model,
          knex,
        ).catch(() => undefined);
      }
    }
    if (!status.unavailable) {
      const indexable = new Set(
        (await resolveIndexFields(context, model)).map((f) => f.column.id),
      );
      const slow = columns.filter(
        (c) =>
          isSlowLiveField(c) &&
          !indexable.has(c.id) &&
          (c.pv || !isSystemColumn(c)),
      );
      if (slow.length) {
        status.slow_fields = slow.map((c) => ({ id: c.id, title: c.title }));
      }
    }
    // A job not started yet: shown as started, so the dialog keeps polling.
    if (
      status.mode !== 'off' &&
      !meta?.build &&
      (await isSearchIndexBuildQueued(model.id))
    ) {
      if (status.state === 'ready') status.rebuilding = true;
      else status.state = 'building';
    }
    if (!meta) return status;
    for (const column of columns) {
      if (!meta.fields?.[column.id]) continue;
      if (isColumnServedByIndex(column, meta)) status.fields.indexed++;
      else status.fields.pending++;
    }
    status.built_at = meta.built_at;
    status.last_build = meta.last_build;
    status.error = meta.error;
    const failures = searchIndexFailures(meta);
    if (failures) {
      status.failures = failures;
      status.failed_at = meta.failed_at;
      status.retry_at = searchIndexRetryAt(meta);
      status.error_detail = await getSearchIndexBuildError(model.id);
    }
    if (meta.state === 'ready') {
      status.size_bytes = await searchTargetSize(
        await this.knexFor(context, model),
        searchLiveTarget(model),
      );
    }
    return status;
  }
}
