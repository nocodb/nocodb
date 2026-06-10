import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  NcApiVersion,
  NcBaseError,
  TableSyncMappingRole,
  TableSyncOnDeleteAction,
  TableSyncStatus,
  UITypes,
} from 'nocodb-sdk';
import { Job } from 'bull';
import type { NcContext } from 'nocodb-sdk';
import type { TableSyncJobData } from '~/interface/Jobs';
import type { Column } from '~/models';
import {
  bufferPendingIncrementalIds,
  buildColumnPlan,
  buildSyncSystemFields,
  drainPendingIncrementalIds,
  extractSourcePk,
  normalizeLinkValue,
  scheduleIncrementalRun,
  type SyncRunMeta,
  toDestRow,
} from '~/modules/table-sync/table-sync.helpers';
import { toUserFacingSyncError } from '~/modules/table-sync/table-sync-error.helper';
import { Untraced } from '~/decorators/trace-command.decorator';
import { NcError } from '~/helpers/ncError';
import TableSync from '~/models/TableSync';
import { Model, TableSyncColumnMapping, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { DataTableService } from '~/services/data-table.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';

const PAGE_SIZE = 100;
const CHUNK_SIZE = 500;

const WRITE_FLAGS = {
  allowSystemColumn: true,
  skipHooks: false,
} as const;

@Injectable()
export class TableSyncProcessor {
  private logger = new Logger(TableSyncProcessor.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly dataTableService: DataTableService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
  ) {}

  @Untraced()
  async job(job: Job<TableSyncJobData>) {
    const {
      context,
      syncId,
      req,
      mode = 'full-create',
      affectedIdsBySource,
    } = job.data;

    if (req) req.query = { ...(req.query ?? {}), typecast: 'true' };

    const logBasic = (message: string) =>
      this.nocoJobsService.jobsLogService.sendLog(job, { message });

    const sync = await TableSync.get(context, syncId);
    if (!sync) NcError.get(context).tableSyncNotFound(syncId);

    const isFullMode = mode === 'full-create' || mode === 'full-resync';

    if (isFullMode && sync.sync_job_id && sync.sync_job_id !== `${job.id}`) {
      this.logger.warn(
        `Skipping ${mode} — job ${job.id} superseded by ${sync.sync_job_id} on sync ${syncId}`,
      );
      return;
    }

    if (mode === 'incremental' && sync.status !== TableSyncStatus.Active) {
      return;
    }

    // Serialize incremental runs per sync — only one executes at a time, so two
    // overlapping runs can't double-insert or race on tombstones. A second run
    // bails here and parks its ids in the buffer for the holder to drain.
    const incrementalLockKey = `lock:tableSync:incremental:${syncId}`;
    const incrementalLockId = randomUUID();
    let holdsIncrementalLock = false;
    if (mode === 'incremental') {
      // try-once (maxWait 0) — don't queue behind the holder. The 10-min TTL is
      // only a crash safety net; the run releases the lock in `finally` below.
      holdsIncrementalLock = await acquireLock(
        incrementalLockKey,
        incrementalLockId,
        0,
        600,
      );
      if (!holdsIncrementalLock) {
        await bufferPendingIncrementalIds(
          context,
          syncId,
          affectedIdsBySource ?? {},
        );
        return;
      }
    }

    const verb = mode === 'incremental' ? 'Incremental sync' : 'Full sync';

    logBasic(`${verb} started for "${sync.title}"`);

    const runBase: Omit<SyncRunMeta, 'namespace'> = {
      syncId: sync.id,
      runId: `${job.id}`,
      syncedAtIso: new Date().toISOString(),
    };

    try {
      const mainMapping = sync.mappings?.find(
        (m) => m.role === TableSyncMappingRole.Main,
      );
      if (!mainMapping) {
        if (!isFullMode) return;
        NcError.get(context).invalidRequestBody(
          `Sync "${sync.title}" has no source mapping — the source was removed. ` +
            `Delete this sync and recreate it from the source to re-establish the connection.`,
        );
      }
      const linkedMappings = (sync.mappings ?? []).filter(
        (m) => m.role === TableSyncMappingRole.LinkedShadow,
      );

      const linkedShadowIndex = new Map(
        linkedMappings.map((m) => [m.dest_table_id, m]),
      );

      for (const mapping of [...linkedMappings, mainMapping]) {
        const sourceCtx: NcContext = {
          workspace_id: mapping.source_workspace_id,
          base_id: mapping.source_base_id,
        };
        const sourceView = await View.get(sourceCtx, mapping.source_view_id);
        if (!sourceView) {
          NcError.get(sourceCtx).forbidden(
            `Source view ${mapping.source_view_id} no longer exists`,
          );
        }
        if (!sourceView.allow_sync) {
          NcError.get(sourceCtx).forbidden(
            `Sync was turned off on the source view "${
              sourceView.title || mapping.source_view_id
            }". Enable "Allow sync" on the view to resume.`,
          );
        }
        if (!sourceView.uuid) {
          NcError.get(sourceCtx).forbidden(
            `Source view "${
              sourceView.title || mapping.source_view_id
            }" is no longer publicly shared`,
          );
        }
        // Stored hash is the password hash captured at createSync. If the
        // source owner rotated, added, or removed the password, the live
        // hash no longer matches and the sync's authorization is stale.
        if (
          (sourceView.password ?? null) !==
          (mapping.source_password_hash ?? null)
        ) {
          NcError.get(sourceCtx).forbidden(
            `Source view "${
              sourceView.title || mapping.source_view_id
            }" share password has changed`,
          );
        }
      }

      for (const mapping of [...linkedMappings, mainMapping]) {
        const isMain = mapping === mainMapping;
        const tag = `[${mapping.role}/${mapping.dest_table_id}]`;

        const runMeta: SyncRunMeta = {
          ...runBase,
          namespace: `${mapping.source_table_id}/${mapping.source_view_id}`,
        };
        const sourceCtx: NcContext = {
          workspace_id: mapping.source_workspace_id,
          base_id: mapping.source_base_id,
        };
        const destWriteContext: NcContext = {
          workspace_id: mapping.fk_workspace_id,
          base_id: mapping.dest_base_id,
        };

        const sourceModel = await Model.get(sourceCtx, mapping.source_table_id);
        if (!sourceModel) {
          this.logger.warn(`${tag} sourceModel missing`);
          continue;
        }
        await sourceModel.getColumns(sourceCtx);

        const destModel = await Model.get(
          destWriteContext,
          mapping.dest_table_id,
        );
        if (!destModel) {
          this.logger.warn(`${tag} destModel missing`);
          if (isMain) {
            NcError.get(context).invalidRequestBody(
              `The destination table for sync "${sync.title}" was permanently deleted. ` +
                `Delete this sync and recreate it from the source to re-establish it.`,
            );
          }
          continue;
        }
        await destModel.getColumns(destWriteContext);

        const destColumnsByTitle = new Map<string, Column>();
        for (const c of destModel.columns ?? []) {
          if (c.title) destColumnsByTitle.set(c.title, c as Column);
        }
        const destPkCol = destModel.columns?.find((c) => c.pk) as
          | Column
          | undefined;

        const columnMappings =
          await TableSyncColumnMapping.listByTableSyncMapping(
            destWriteContext,
            mapping.id,
          );

        const plan = await buildColumnPlan(
          destWriteContext,
          destModel,
          sourceCtx,
          sourceModel,
          columnMappings,
        );

        const affectedIds =
          mode === 'incremental'
            ? affectedIdsBySource?.[mapping.source_table_id]
            : undefined;

        const sourcePkCol = sourceModel.columns?.find((c) => c.pk);

        // Realtime incrementals carry the exact source ids that changed (set by
        // the hook from the write event). When present they are authoritative:
        // fetch precisely those rows (`Id IN affectedIds`), turning O(view) into
        // O(affectedIds) per write. They take precedence over the LMT cursor — a
        // prior run can advance the cursor to (or past) a buffered id's
        // timestamp (cursors are stored at second granularity and filtered with
        // strict `>`), which would silently drop the very id this run was told
        // to replicate.
        const scopeByAffectedIds =
          mode === 'incremental' &&
          (affectedIds?.length ?? 0) > 0 &&
          !!sourcePkCol?.id;

        // ── Cursor + LMT resolution (incremental catch-up only) ──────────────
        // For runs with no explicit ids (scheduled/manual catch-up): the cursor
        // lives IN the dest — max `RemoteUpdatedAt` of any row tagged with this
        // sync's `SyncConfigId` + `RemoteNamespace`; fetch source rows with
        // `LastModifiedTime > cursor`.
        let cursor: string | null = null;
        let lastModifiedColId: string | null = null;
        if (mode === 'incremental' && !scopeByAffectedIds) {
          const remoteUpdatedAtCol = destColumnsByTitle.get('RemoteUpdatedAt');
          const syncConfigIdCol = destColumnsByTitle.get('SyncConfigId');
          const remoteNamespaceCol = destColumnsByTitle.get('RemoteNamespace');
          if (
            remoteUpdatedAtCol?.id &&
            syncConfigIdCol?.id &&
            remoteNamespaceCol?.id
          ) {
            const cursorRes = await this.dataTableService.dataList(
              destWriteContext,
              {
                modelId: mapping.dest_table_id,
                query: {
                  limit: 1,
                  sort: `-${remoteUpdatedAtCol.title}`,
                  filterArrJson: JSON.stringify([
                    {
                      fk_column_id: syncConfigIdCol.id,
                      comparison_op: 'eq',
                      value: sync.id,
                      logical_op: 'and',
                    },
                    {
                      fk_column_id: remoteNamespaceCol.id,
                      comparison_op: 'eq',
                      value: runMeta.namespace,
                      logical_op: 'and',
                    },
                  ]),
                },
              },
            );
            const cursorVal = cursorRes.list[0]?.[remoteUpdatedAtCol.title!];
            cursor = cursorVal == null ? null : String(cursorVal);
          }
          lastModifiedColId =
            (sourceModel.columns ?? []).find(
              (c) => c.uidt === UITypes.LastModifiedTime,
            )?.id ?? null;
        }
        const useCursor =
          mode === 'incremental' &&
          !scopeByAffectedIds &&
          cursor != null &&
          !!lastModifiedColId;

        // Lookups used both during the page loop (existing-row check) and the
        // tombstone phase. Lifted here so the upsert path can scope by sync.
        const syncConfigIdCol = destColumnsByTitle.get('SyncConfigId');
        const remoteNamespaceCol = destColumnsByTitle.get('RemoteNamespace');
        const remoteDeletedCol = destColumnsByTitle.get('RemoteDeleted');
        const syncRunIdCol = destColumnsByTitle.get('SyncRunId');
        const remoteIdCol = destColumnsByTitle.get('RemoteId');

        const label = isMain
          ? `main table "${sourceModel.title}"`
          : `linked table "${sourceModel.title}"`;
        if (isFullMode) logBasic(`Mirroring ${label}…`);

        // ── Paged fetch with one-ahead prefetch ──────────────────────────
        // Three fetch strategies, selected per mapping:
        //  - scopeByAffectedIds: walk `affectedIds` in PAGE_SIZE chunks
        //    via `Id IN <chunk>`. `offset` indexes into `affectedIds`.
        //  - useCursor: filter `LastModifiedTime > cursor` and sort
        //    ascending so the next cursor read picks up cleanly.
        //  - fallback: paginate the view by offset.
        const fetchAt = async (offset: number): Promise<any[]> => {
          try {
            if (scopeByAffectedIds) {
              const chunk = (affectedIds ?? []).slice(
                offset,
                offset + PAGE_SIZE,
              );
              if (!chunk.length) return [];
              const page = await this.dataTableService.dataList(sourceCtx, {
                modelId: mapping.source_table_id,
                viewId: mapping.source_view_id,
                getHiddenColumns: true,
                ignorePagination: true,
                query: {
                  filterArrJson: JSON.stringify([
                    {
                      fk_column_id: sourcePkCol!.id,
                      comparison_op: 'in',
                      value: chunk,
                      logical_op: 'and',
                    },
                  ]),
                },
              });
              return page.list ?? [];
            }
            const page = await this.dataTableService.dataList(sourceCtx, {
              modelId: mapping.source_table_id,
              viewId: mapping.source_view_id,
              getHiddenColumns: true,
              query: useCursor
                ? {
                    limit: PAGE_SIZE,
                    offset,
                    sort: `+${lastModifiedColId}`,
                    filterArrJson: JSON.stringify([
                      {
                        fk_column_id: lastModifiedColId,
                        comparison_op: 'gt',
                        value: cursor,
                        logical_op: 'and',
                      },
                    ]),
                  }
                : { limit: PAGE_SIZE, offset },
            });
            return page.list ?? [];
          } catch (e: any) {
            if (e?.error === 'ERR_INVALID_OFFSET_VALUE') return [];
            throw e;
          }
        };

        let totalFetched = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        let totalDropped = 0;
        let offset = 0;
        let nextPage = fetchAt(offset);

        // Per-mapping cache of parent RemoteIds confirmed present in each
        // linked shadow. Lets the per-page stub backfill skip re-querying
        // the shadow for parents that earlier pages already checked or
        // inserted. Reset on every job — cross-job drift (e.g. shadow
        // tombstoned by a view-filter change) is still caught by the
        // filter-change handler's full-resync.
        const stubKnownInShadow = new Map<string, Set<string>>();

        try {
          for (;;) {
            const records = await nextPage;

            // Advance and decide termination per fetch strategy.
            //  - scopeByAffectedIds: `offset` indexes into `affectedIds`;
            //    walk chunk-by-chunk. An empty page is expected when a
            //    chunk's ids have all left the view — don't break on it.
            //  - cursor / unscoped offset: empty page = no more rows.
            let isLast: boolean;
            if (scopeByAffectedIds) {
              const total = affectedIds?.length ?? 0;
              const consumed = Math.min(PAGE_SIZE, Math.max(0, total - offset));
              offset += consumed;
              isLast = offset >= total;
            } else {
              if (!records.length) break;
              offset += records.length;
              isLast = records.length < PAGE_SIZE;
            }
            nextPage = isLast ? Promise.resolve([]) : fetchAt(offset);

            if (!records.length) {
              if (isLast) break;
              continue;
            }

            totalFetched += records.length;

            // ── Push rows: shape → chunk → existing-check → insert/update ─
            const shaped: Record<string, any>[] = [];
            for (const r of records) {
              const sourceId = extractSourcePk(r, plan.sourcePkTitle);
              if (!sourceId) {
                totalDropped++;
                continue;
              }
              shaped.push(toDestRow(r, plan, sourceId, runMeta));
            }

            // Diagnostic: every record in this page was dropped because the
            // source PK could not be extracted. Without this log the run looks
            // identical to "view has 0 rows" downstream ("0 rows mirrored"),
            // even though the source IS returning data. Most common cause is
            // the source PK column title not matching the response shape
            // (e.g. PK renamed without the model cache being refreshed).
            if (records.length && !shaped.length) {
              const sampleKeys = Object.keys(records[0] ?? {});
              this.logger.warn(
                `${tag} dropped ${records.length} row(s) at offset ${
                  offset - records.length
                }: no value at sourcePkTitle="${
                  plan.sourcePkTitle
                }" (sample row keys: ${
                  sampleKeys.length ? sampleKeys.join(',') : '∅'
                })`,
              );
            }

            // Existing-row check + upsert. The dest's PK is independent of
            // the source PK (auto-increment integer for PG, auto-generated
            // nanoid for NocoDB-managed bases) — so we always match by
            // `RemoteId` (which stores `sourceId`) instead of the dest PK.
            // Without this, source ids that happen to overlap with dest's
            // auto-incremented ids cause writes to land on unrelated rows.
            if (
              shaped.length &&
              destPkCol?.title &&
              remoteIdCol?.id &&
              remoteIdCol?.title &&
              syncConfigIdCol?.id &&
              remoteNamespaceCol?.id
            ) {
              for (let i = 0; i < shaped.length; i += CHUNK_SIZE) {
                const chunk = shaped.slice(i, i + CHUNK_SIZE);
                const remoteIds = chunk
                  .map((s) => s[remoteIdCol.title!])
                  .filter((v) => v != null);
                if (!remoteIds.length) continue;

                // Scope by sync — RemoteId can repeat across syncs that share
                // a dest table.
                const existingRes = await this.dataTableService.dataList(
                  destWriteContext,
                  {
                    modelId: mapping.dest_table_id,
                    ignorePagination: true,
                    query: {
                      filterArrJson: JSON.stringify([
                        {
                          fk_column_id: remoteIdCol.id,
                          comparison_op: 'in',
                          value: remoteIds,
                          logical_op: 'and',
                        },
                        {
                          fk_column_id: syncConfigIdCol.id,
                          comparison_op: 'eq',
                          value: sync.id,
                          logical_op: 'and',
                        },
                        {
                          fk_column_id: remoteNamespaceCol.id,
                          comparison_op: 'eq',
                          value: runMeta.namespace,
                          logical_op: 'and',
                        },
                      ]),
                    },
                  },
                );

                const existingDestPkByRemoteId = new Map<string, unknown>();
                for (const row of existingRes.list ?? []) {
                  const rid = row?.[remoteIdCol.title!];
                  const dpk = row?.[destPkCol.title!];
                  if (rid != null && dpk != null) {
                    existingDestPkByRemoteId.set(String(rid), dpk);
                  }
                }

                const toInsert: Record<string, any>[] = [];
                const toUpdate: Record<string, any>[] = [];
                for (const s of chunk) {
                  const remoteId = String(s[remoteIdCol.title!]);
                  const existingDestPk = existingDestPkByRemoteId.get(remoteId);
                  if (existingDestPk != null) {
                    // Rewrite the dest PK to the existing row's PK so V2
                    // `dataUpdate` matches by it.
                    toUpdate.push({
                      ...s,
                      [destPkCol.title!]: existingDestPk,
                    });
                  } else {
                    // No mirror yet — strip any PK key so the dest's
                    // auto-PK assigns a fresh value.
                    const { [destPkCol.title!]: _drop, ...rest } = s;
                    toInsert.push(rest);
                  }
                }

                if (toInsert.length) {
                  await this.dataTableService.dataInsert(destWriteContext, {
                    modelId: mapping.dest_table_id,
                    body: toInsert,
                    cookie: req,
                    apiVersion: NcApiVersion.V2,
                    req,
                    user: req.user,
                    internalFlags: WRITE_FLAGS,
                  });
                  totalInserted += toInsert.length;
                }
                if (toUpdate.length) {
                  await this.dataTableService.dataUpdate(destWriteContext, {
                    modelId: mapping.dest_table_id,
                    body: toUpdate,
                    cookie: req,
                    apiVersion: NcApiVersion.V2,
                    user: req.user,
                    internalFlags: WRITE_FLAGS,
                  });
                  totalUpdated += toUpdate.length;
                }
              }
            }

            if (isMain && plan.linkPlans.length) {
              if (mode !== 'full-create') {
                for (const lp of plan.linkPlans) {
                  const sourceIdToNewSet = new Map<string, Set<string>>();
                  for (const r of records) {
                    const mainSourceId = extractSourcePk(r, plan.sourcePkTitle);
                    if (mainSourceId == null) continue;
                    // Distinguish "field missing from row" from "field present
                    // but empty". A missing field is a transient V2 response
                    // quirk — treating it as empty would diff to "delete all
                    // junctions for this row" and silently wipe links.
                    if (!(lp.sourceTitle in r)) continue;
                    const linked = normalizeLinkValue(
                      r[lp.sourceTitle],
                      lp.parentPkTitle,
                    );
                    sourceIdToNewSet.set(mainSourceId, new Set(linked));
                  }
                  if (sourceIdToNewSet.size === 0) continue;

                  const mainRemoteIds = Array.from(sourceIdToNewSet.keys());

                  const junction = await Model.get(
                    destWriteContext,
                    lp.mmModelId,
                  );
                  if (!junction) continue;
                  await junction.getColumns(destWriteContext);
                  const junctionPkCol = junction.columns?.find((c) => c.pk);
                  const junctionPkTitle = junctionPkCol?.title;
                  const junctionPkColId = junctionPkCol?.id;
                  if (!junctionPkTitle || !junctionPkColId) continue;

                  // Pull existing junction rows for these main RemoteIds.
                  const existingJunction = await this.dataTableService.dataList(
                    destWriteContext,
                    {
                      modelId: lp.mmModelId,
                      ignorePagination: true,
                      query: {
                        filterArrJson: JSON.stringify([
                          {
                            comparison_op: 'in',
                            value: mainRemoteIds,
                            logical_op: 'and',
                            fk_column_id: lp.mmChildColumnId,
                          },
                        ]),
                      },
                    },
                  );

                  // Bucket existing rows by mainRemoteId → Map<parentRemoteId, junctionPk>.
                  const existingByChild = new Map<
                    string,
                    Map<string, unknown>
                  >();
                  for (const row of (existingJunction as any).list ?? []) {
                    const child = String(row[lp.mmChildColumnTitle]);
                    const parent = String(row[lp.mmParentColumnTitle]);
                    const pk = row[junctionPkTitle];
                    if (!existingByChild.has(child)) {
                      existingByChild.set(child, new Map());
                    }
                    existingByChild.get(child)!.set(parent, pk);
                  }

                  // Diff in RemoteId space.
                  const toInsertJ: Record<string, unknown>[] = [];
                  const toDeleteJ: Record<string, unknown>[] = [];
                  for (const [mainRemoteId, newSet] of sourceIdToNewSet) {
                    const existingMap =
                      existingByChild.get(mainRemoteId) ?? new Map();
                    for (const parentRemoteId of newSet) {
                      if (!existingMap.has(parentRemoteId)) {
                        toInsertJ.push({
                          [lp.mmChildColumnTitle]: mainRemoteId,
                          [lp.mmParentColumnTitle]: parentRemoteId,
                        });
                      }
                    }
                    for (const [parentRemoteId, junctionPk] of existingMap) {
                      if (!newSet.has(parentRemoteId)) {
                        toDeleteJ.push({ [junctionPkTitle]: junctionPk });
                      }
                    }
                  }

                  if (toInsertJ.length) {
                    await this.dataTableService.dataInsert(destWriteContext, {
                      modelId: lp.mmModelId,
                      body: toInsertJ,
                      cookie: req,
                      apiVersion: NcApiVersion.V2,
                      req,
                      user: req.user,
                      internalFlags: WRITE_FLAGS,
                    });
                  }
                  if (toDeleteJ.length) {
                    await this.bulkDataAliasService.bulkDataDeleteAll(
                      destWriteContext,
                      {
                        baseName: mapping.dest_base_id,
                        tableName: lp.mmModelId,
                        req,
                        query: {
                          filterArr: [
                            {
                              fk_column_id: junctionPkColId,
                              comparison_op: 'in',
                              value: toDeleteJ.map((r) => r[junctionPkTitle]),
                              logical_op: 'and',
                            },
                          ],
                        },
                      },
                    );
                  }
                }
              } else {
                for (const lp of plan.linkPlans) {
                  const sourceIdToNewSet = new Map<string, Set<string>>();
                  for (const r of records) {
                    const mainSourceId = extractSourcePk(r, plan.sourcePkTitle);
                    if (mainSourceId == null) continue;
                    const linked = normalizeLinkValue(
                      r[lp.sourceTitle],
                      lp.parentPkTitle,
                    );
                    const existing =
                      sourceIdToNewSet.get(mainSourceId) ?? new Set<string>();
                    for (const psid of linked) existing.add(psid);
                    sourceIdToNewSet.set(mainSourceId, existing);
                  }
                  if (sourceIdToNewSet.size === 0) continue;

                  const mainRemoteIds = Array.from(sourceIdToNewSet.keys());

                  const existingJunction = await this.dataTableService.dataList(
                    destWriteContext,
                    {
                      modelId: lp.mmModelId,
                      ignorePagination: true,
                      query: {
                        filterArrJson: JSON.stringify([
                          {
                            comparison_op: 'in',
                            value: mainRemoteIds,
                            logical_op: 'and',
                            fk_column_id: lp.mmChildColumnId,
                          },
                        ]),
                      },
                    },
                  );
                  const seen = new Set<string>();
                  for (const r of (existingJunction as any).list ?? []) {
                    seen.add(
                      `${r[lp.mmChildColumnTitle]}\0${
                        r[lp.mmParentColumnTitle]
                      }`,
                    );
                  }

                  const novel: Record<string, unknown>[] = [];
                  for (const [mainRemoteId, parentSet] of sourceIdToNewSet) {
                    for (const parentRemoteId of parentSet) {
                      const key = `${mainRemoteId}\0${parentRemoteId}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      novel.push({
                        [lp.mmChildColumnTitle]: mainRemoteId,
                        [lp.mmParentColumnTitle]: parentRemoteId,
                      });
                    }
                  }
                  if (!novel.length) continue;

                  await this.dataTableService.dataInsert(destWriteContext, {
                    modelId: lp.mmModelId,
                    body: novel,
                    cookie: req,
                    apiVersion: NcApiVersion.V2,
                    req,
                    user: req.user,
                    internalFlags: WRITE_FLAGS,
                  });
                }
              }

              // ── Linked-shadow stubs ──────────────────────────────────
              // For each LTAR on main, ensure every referenced linked
              // source row exists in its shadow — either a full row
              // (synced by the shadow's own runs) or a PK+PV-only stub
              // when the row was filtered out of the linked view. Runs
              // in all modes so realtime incrementals resolve the LTAR
              // immediately instead of waiting for the next full-resync.
              //
              // `stubKnownInShadow` is the per-job cache that prevents
              // the same RemoteId from being re-checked on subsequent
              // pages — without it, a full-resync of a wide table with
              // many main rows pointing at the same parents would issue
              // O(pages × linkPlans) duplicate shadow lookups.
              for (const lp of plan.linkPlans) {
                const shadow = linkedShadowIndex.get(lp.destLinkedTableId);
                if (!shadow) continue;

                const referenced = new Set<string>();
                for (const r of records) {
                  const ids = normalizeLinkValue(
                    r[lp.sourceTitle],
                    lp.parentPkTitle,
                  );
                  for (const id of ids) referenced.add(id);
                }
                if (!referenced.size) continue;

                let knownPresent = stubKnownInShadow.get(lp.destLinkedTableId);
                if (!knownPresent) {
                  knownPresent = new Set<string>();
                  stubKnownInShadow.set(lp.destLinkedTableId, knownPresent);
                }

                const toCheck = Array.from(referenced).filter(
                  (id) => !knownPresent.has(id),
                );
                if (!toCheck.length) continue;

                const shadowDestContext: NcContext = {
                  workspace_id: shadow.fk_workspace_id,
                  base_id: shadow.dest_base_id,
                };
                const linkedSourceContext: NcContext = {
                  workspace_id: shadow.source_workspace_id,
                  base_id: shadow.source_base_id,
                };

                const linkedSourceModel = await Model.get(
                  linkedSourceContext,
                  shadow.source_table_id,
                );
                if (!linkedSourceModel) continue;
                await linkedSourceModel.getColumns(linkedSourceContext);
                const linkedSourcePkCol = linkedSourceModel.columns?.find(
                  (c) => c.pk,
                );
                const linkedSourcePvCol = linkedSourceModel.columns?.find(
                  (c) => c.pv,
                );
                if (!linkedSourcePkCol?.id || !linkedSourcePkCol?.title) {
                  continue;
                }

                const shadowDestModel = await Model.get(
                  shadowDestContext,
                  shadow.dest_table_id,
                );
                if (!shadowDestModel) continue;
                await shadowDestModel.getColumns(shadowDestContext);
                const shadowRemoteIdCol = shadowDestModel.columns?.find(
                  (c) => c.title === 'RemoteId',
                );
                const shadowSyncConfigIdCol = shadowDestModel.columns?.find(
                  (c) => c.title === 'SyncConfigId',
                );
                const shadowRemoteNamespaceCol = shadowDestModel.columns?.find(
                  (c) => c.title === 'RemoteNamespace',
                );
                if (
                  !shadowRemoteIdCol?.id ||
                  !shadowRemoteIdCol?.title ||
                  !shadowSyncConfigIdCol?.id ||
                  !shadowRemoteNamespaceCol?.id
                ) {
                  continue;
                }
                const shadowNamespace = `${shadow.source_table_id}/${shadow.source_view_id}`;

                // Existing-in-shadow check: match by RemoteId (which holds
                // the source PK), NOT the shadow's own auto-assigned PK.
                // Scope by the shadow's sync so we never mistake another
                // sync's rows for ours. `toCheck` is `referenced` minus
                // cache hits, so this query stays small as the job
                // progresses.
                const existingShadowRes = await this.dataTableService.dataList(
                  shadowDestContext,
                  {
                    modelId: shadow.dest_table_id,
                    ignorePagination: true,
                    query: {
                      filterArrJson: JSON.stringify([
                        {
                          fk_column_id: shadowRemoteIdCol.id,
                          comparison_op: 'in',
                          value: toCheck,
                          logical_op: 'and',
                        },
                        {
                          fk_column_id: shadowSyncConfigIdCol.id,
                          comparison_op: 'eq',
                          value: sync.id,
                          logical_op: 'and',
                        },
                        {
                          fk_column_id: shadowRemoteNamespaceCol.id,
                          comparison_op: 'eq',
                          value: shadowNamespace,
                          logical_op: 'and',
                        },
                      ]),
                    },
                  },
                );
                for (const row of (existingShadowRes as any).list ?? []) {
                  const rid = row?.[shadowRemoteIdCol.title!];
                  if (rid != null) knownPresent.add(String(rid));
                }

                const missingIds = toCheck.filter(
                  (id) => !knownPresent.has(id),
                );
                if (!missingIds.length) continue;

                // Fetch missing rows from the linked SOURCE TABLE (no
                // viewId, so view filters are bypassed). BaseModel's
                // list excludes soft-deleted rows by default, so trashed
                // source rows are correctly NOT materialized as stubs.
                const stubRows: Record<string, any>[] = [];
                const insertedIds: string[] = [];
                for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
                  const sub = missingIds.slice(i, i + CHUNK_SIZE);
                  const res = await this.dataTableService.dataList(
                    linkedSourceContext,
                    {
                      modelId: shadow.source_table_id,
                      ignorePagination: true,
                      query: {
                        filterArrJson: JSON.stringify([
                          {
                            comparison_op: 'in',
                            value: sub,
                            logical_op: 'and',
                            fk_column_id: linkedSourcePkCol.id,
                          },
                        ]),
                      },
                    },
                  );
                  for (const row of res.list ?? []) {
                    const sourceId = extractSourcePk(
                      row,
                      linkedSourcePkCol.title!,
                    );
                    if (!sourceId) continue;
                    // Stub PV is cosmetic — only copy if it's a primitive.
                    // Non-primitive PV (LTAR / User / Lookup / Attachment)
                    // would either land in a remapped text column as
                    // `[object Object]` or be rejected by V2; better to leave
                    // the stub PV empty and let the UI fall back to RemoteId.
                    const pvTitle = linkedSourcePvCol?.title;
                    const pvVal = pvTitle ? row[pvTitle] : undefined;
                    const pvIsPrimitive =
                      pvVal != null &&
                      (typeof pvVal === 'string' ||
                        typeof pvVal === 'number' ||
                        typeof pvVal === 'boolean');
                    stubRows.push({
                      ...(pvTitle && pvIsPrimitive ? { [pvTitle]: pvVal } : {}),
                      ...buildSyncSystemFields({
                        sourceId,
                        record: row,
                        createdAt: null,
                        updatedAt: null,
                        runMeta,
                      }),
                    });
                    insertedIds.push(sourceId);
                  }
                }

                if (!stubRows.length) continue;

                await this.dataTableService.dataInsert(shadowDestContext, {
                  modelId: shadow.dest_table_id,
                  body: stubRows,
                  cookie: req,
                  apiVersion: NcApiVersion.V2,
                  req,
                  user: req.user,
                  internalFlags: WRITE_FLAGS,
                });
                for (const id of insertedIds) knownPresent.add(id);
              }
            }

            if (isFullMode) {
              const droppedSuffix = totalDropped
                ? `, ${totalDropped} dropped (source PK missing)`
                : '';
              logBasic(
                `${label}: ${
                  totalInserted + totalUpdated
                } rows mirrored so far${droppedSuffix}`,
              );
            }

            if (isLast) break;
          }
        } finally {
          nextPage.catch(() => {});
        }

        // ── Tombstone phase ──────────────────────────────────────────────
        let totalTombstoned = 0;

        if (
          mode === 'full-resync' &&
          destPkCol?.title &&
          syncRunIdCol?.id &&
          syncConfigIdCol?.id &&
          remoteNamespaceCol?.id
        ) {
          // Sweep `SyncRunId ≠ currentRunId` — anything not touched this
          // run is no longer in the source view (hard delete, soft delete,
          // view exit, filter change — all collapse to the same case).
          //
          // `sweepTombstones` pre-fetches matching PKs and writes per
          // chunk via `dataUpdate` / `dataDelete` so user-configured
          // `after.bulkUpdate` / `after.bulkDelete` hooks fire with real
          // row arrays (required by workflow triggers in
          // `hook-handler.service.ts`).
          const sweepFilter: Record<string, unknown>[] = [
            {
              fk_column_id: syncRunIdCol.id,
              comparison_op: 'neq',
              value: runMeta.runId,
              logical_op: 'and',
            },
            {
              fk_column_id: syncConfigIdCol.id,
              comparison_op: 'eq',
              value: sync.id,
              logical_op: 'and',
            },
            {
              fk_column_id: remoteNamespaceCol.id,
              comparison_op: 'eq',
              value: runMeta.namespace,
              logical_op: 'and',
            },
          ];
          if (
            sync.on_delete_action === TableSyncOnDeleteAction.MarkDeleted &&
            remoteDeletedCol?.id
          ) {
            // Skip already-marked rows so re-runs don't churn timestamps.
            sweepFilter.push({
              fk_column_id: remoteDeletedCol.id,
              comparison_op: 'eq',
              value: false,
              logical_op: 'and',
            });
          }

          totalTombstoned = await this.sweepTombstones(
            destWriteContext,
            mapping.dest_table_id,
            destPkCol.title!,
            sweepFilter,
            sync.on_delete_action,
            runMeta,
            req,
          );
        } else if (mode === 'incremental' && affectedIds?.length) {
          // View-diff reconciliation: probe the source view with
          // `Id IN affectedIds`; anything missing has left the view
          // (hard delete, soft delete, or filter-change). Realtime
          // delete propagation lives here — no tombstones table needed.
          if (
            sourcePkCol?.id &&
            remoteIdCol?.id &&
            syncConfigIdCol?.id &&
            remoteNamespaceCol?.id &&
            destPkCol?.title
          ) {
            const fetched = new Set<string>();
            for (let i = 0; i < affectedIds.length; i += CHUNK_SIZE) {
              const chunk = affectedIds.slice(i, i + CHUNK_SIZE);
              const res = await this.dataTableService.dataList(sourceCtx, {
                modelId: mapping.source_table_id,
                viewId: mapping.source_view_id,
                ignorePagination: true,
                query: {
                  filterArrJson: JSON.stringify([
                    {
                      fk_column_id: sourcePkCol.id,
                      comparison_op: 'in',
                      value: chunk,
                      logical_op: 'and',
                    },
                  ]),
                },
              });
              for (const row of res.list ?? []) {
                const id = extractSourcePk(row, plan.sourcePkTitle);
                if (id) fetched.add(id);
              }
            }

            const tombstoneIds = affectedIds.filter(
              (id) => !fetched.has(String(id)),
            );

            // Tombstone the missing source ids on the dest, in chunks. We
            // match by `RemoteId` (which holds the source PK) — NOT by the
            // dest's own PK, which is an independent auto-increment integer
            // that happens to numerically collide with source ids and would
            // otherwise mark the wrong rows. Scope is narrowed by
            // SyncConfigId + RemoteNamespace so we can never touch rows
            // owned by another sync sharing the dest table.
            for (let i = 0; i < tombstoneIds.length; i += CHUNK_SIZE) {
              const chunk = tombstoneIds.slice(i, i + CHUNK_SIZE);

              const filter: Record<string, unknown>[] = [
                {
                  fk_column_id: remoteIdCol.id,
                  comparison_op: 'in',
                  value: chunk,
                  logical_op: 'and',
                },
                {
                  fk_column_id: syncConfigIdCol.id,
                  comparison_op: 'eq',
                  value: sync.id,
                  logical_op: 'and',
                },
                {
                  fk_column_id: remoteNamespaceCol.id,
                  comparison_op: 'eq',
                  value: runMeta.namespace,
                  logical_op: 'and',
                },
              ];
              if (
                sync.on_delete_action === TableSyncOnDeleteAction.MarkDeleted &&
                remoteDeletedCol?.id
              ) {
                filter.push({
                  fk_column_id: remoteDeletedCol.id,
                  comparison_op: 'eq',
                  value: false,
                  logical_op: 'and',
                });
              }

              totalTombstoned += await this.sweepTombstones(
                destWriteContext,
                mapping.dest_table_id,
                destPkCol.title!,
                filter,
                sync.on_delete_action,
                runMeta,
                req,
              );
            }
          }
        }

        if (isFullMode) {
          const droppedSuffix = totalDropped
            ? `, ${totalDropped} dropped (source PK missing)`
            : '';
          logBasic(
            `Done mirroring ${label} — ${totalInserted} inserted, ${totalUpdated} updated${
              totalTombstoned ? `, ${totalTombstoned} tombstoned` : ''
            }${droppedSuffix}`,
          );
        } else if (totalFetched || totalTombstoned) {
          logBasic(
            `Incremental "${
              sourceModel.title
            }": ${totalInserted} inserted, ${totalUpdated} updated${
              totalTombstoned ? `, ${totalTombstoned} tombstoned` : ''
            }`,
          );
        }
      }

      // ── Success: timestamps + status + broadcast + AppEvents ───────────
      const updatePatch: Partial<TableSync> = {
        last_synced_at: new Date().toISOString(),
        last_error: null,
      };
      if (isFullMode) {
        updatePatch.status = TableSyncStatus.Active;
        updatePatch.sync_job_id = null;
      }
      const refreshed = await TableSync.update(context, syncId, updatePatch);

      logBasic(`${verb} completed for "${sync.title}"`);

      if (isFullMode && refreshed) {
        // TABLE_SYNC_CREATE fires from the service at sync-creation time;
        // the processor only emits RESYNC on full-resync. Both full modes
        // still broadcast the status flip so the UI can move the sync out
        // of "Syncing".
        if (mode === 'full-resync') {
          this.appHooksService.emit(AppEvents.TABLE_SYNC_RESYNC, {
            context,
            req,
            sync: refreshed,
          });
        }

        NocoSocket.broadcastEvent(context, {
          event: EventType.META_EVENT,
          payload: {
            action: 'table_sync_update',
            payload: { ...refreshed, base_id: context.base_id },
          },
        });
      }
      if (mode === 'incremental') {
        await this.drainAndRequeueIncremental(context, syncId, req);
      }
    } catch (e) {
      const rawMessage = ((e as Error)?.message ?? String(e)).slice(0, 1000);
      // `last_error` surfaces in the UI — store a business-friendly message,
      // never a raw SQL/stack. The raw error is still logged below.
      const friendlyMessage = toUserFacingSyncError(e, context);

      const updated = await TableSync.update(context, syncId, {
        status: TableSyncStatus.Error,
        last_error: friendlyMessage,
        sync_job_id: null,
      });

      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      });

      logBasic(`${verb} failed: ${friendlyMessage}`);

      if (e instanceof NcBaseError) throw e;

      this.logger.error(
        `${verb} failed for sync ${syncId}: ${rawMessage}`,
        (e as Error)?.stack,
      );
      NcError.get(context).internalServerError(`${verb} failed`);
    } finally {
      if (holdsIncrementalLock) {
        await releaseLock(incrementalLockKey, incrementalLockId);
      }
    }
  }

  /**
   * Trailing drain for realtime incremental sync. Ids buffered while this run
   * was processing (see `scheduleIncrementalTableSync`) are drained and re-run
   * once. `scheduleIncrementalRun` skips this still-running job's slot and lands
   * the re-run in the other slot — re-adding our own id would be clobbered when
   * we complete. Wrapped so a buffer/queue hiccup never fails an otherwise-
   * successful run.
   */
  private async drainAndRequeueIncremental(
    context: NcContext,
    syncId: string,
    req: TableSyncJobData['req'],
  ): Promise<void> {
    // Draining deletes the ids from the buffer, so they live only in memory
    // until re-scheduled. If the re-add is rejected (or throws), put them back
    // so the next run picks them up rather than dropping them.
    let pending: Record<string, string[]> | undefined;
    try {
      pending = await drainPendingIncrementalIds(context, syncId);
      if (!pending) return;

      // `scheduleIncrementalRun` skips this still-running job's slot and lands
      // the re-run in the other slot — re-adding our own id would be clobbered
      // when we complete. No self-remove needed.
      const scheduled = await scheduleIncrementalRun(this.nocoJobsService, {
        syncId,
        baseJobData: { context, syncId, mode: 'incremental', req },
        newIdsBySource: pending,
      });
      if (scheduled) pending = undefined; // re-scheduled — nothing to restore
    } catch (e) {
      this.logger.error(
        `Incremental requeue failed for sync ${syncId}: ${
          (e as Error)?.message
        }`,
        (e as Error)?.stack,
      );
    }

    if (pending) {
      await bufferPendingIncrementalIds(context, syncId, pending).catch((e) =>
        this.logger.error(
          `Failed to re-buffer incremental ids for sync ${syncId}: ${
            (e as Error)?.message
          }`,
        ),
      );
    }
  }

  private async sweepTombstones(
    destWriteContext: NcContext,
    destTableId: string,
    pkTitle: string,
    filter: Record<string, unknown>[],
    onDeleteAction: TableSyncOnDeleteAction,
    runMeta: SyncRunMeta,
    req: any,
  ): Promise<number> {
    const page = await this.dataTableService.dataList(destWriteContext, {
      modelId: destTableId,
      query: {
        filterArrJson: JSON.stringify(filter),
        fields: pkTitle,
      },
      ignorePagination: true,
    });
    const rows = (page?.list ?? []) as Record<string, unknown>[];
    if (!rows.length) return 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      if (onDeleteAction === TableSyncOnDeleteAction.MarkDeleted) {
        await this.dataTableService.dataUpdate(destWriteContext, {
          modelId: destTableId,
          body: chunk.map((r) => ({
            [pkTitle]: r[pkTitle],
            RemoteDeleted: true,
            RemoteDeletedTime: runMeta.syncedAtIso,
            RemoteSyncedAt: runMeta.syncedAtIso,
            SyncRunId: runMeta.runId,
          })),
          cookie: req,
          apiVersion: NcApiVersion.V2,
          user: req.user,
          internalFlags: WRITE_FLAGS,
        });
      } else {
        await this.dataTableService.dataDelete(destWriteContext, {
          modelId: destTableId,
          body: chunk.map((r) => ({ [pkTitle]: r[pkTitle] })),
          cookie: req,
          user: req.user,
          internalFlags: { allowSystemColumn: true },
        });
      }
    }

    return rows.length;
  }
}
