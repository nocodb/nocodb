import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  AuditV1OperationTypes,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  LinksVersion,
  PlanFeatureTypes,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { LinkToAnotherRecordColumn } from '~/models';
import { Column, FileReference, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { _wherePk, getCompositePkValue } from '~/helpers/dbHelpers';
import { handleUniqueConstraintError } from '~/helpers/uniqueConstraintErrorHandler';
import conditionV2 from '~/db/conditionV2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { checkForFeature } from '~/helpers/paymentHelpers';
import {
  decodeCursor,
  decodeEventId,
  encodeCursor,
  encodeEventId,
  resolveTrashRetentionDays,
  toIsoString,
} from '~/helpers/trashHelpers';
import { TablesService } from '~/services/tables.service';

/**
 * Batch size for restore / permanent-delete / empty-trash loops. Kept small
 * so per-batch state (preRestoreRows, linked-record broadcasts, audit inserts)
 * stays bounded for events of any size.
 */
const TRASH_BATCH_SIZE = 100;

/**
 * Link conflict tagged by detection path. V1 and V2 carry different
 * resolution data so the restore code can switch on `kind` instead of
 * parsing a synthetic column-name prefix.
 *
 *   V1: OO direct FK on the child table — resolution nulls `fkColumnName`.
 *   V2: junction-table link — resolution deletes the restored record's
 *       junction row at `(rowId, conflictAnchorPk)` on column `colId`.
 */
type LinkConflict =
  | {
      kind: 'v1';
      rowId: string;
      columnTitle: string;
      fkColumnName: string;
    }
  | {
      kind: 'v2';
      rowId: string;
      columnTitle: string;
      colId: string;
      conflictAnchorPk: unknown;
    };

/**
 * Apply a WHERE clause that matches any of the given PK values,
 * supporting both single and composite primary keys.
 */
function _whereInPks(
  qb: Knex.QueryBuilder,
  primaryKeys: Column[],
  ids: unknown[],
): Knex.QueryBuilder {
  if (primaryKeys.length === 1) {
    return qb.whereIn(primaryKeys[0].column_name, ids);
  }
  return qb.where(function () {
    for (const id of ids) {
      this.orWhere(_wherePk(primaryKeys, id, true));
    }
  });
}

/**
 * Batch iterator used by restore / permanent-delete.
 *   - event path: RLS-filtered query against the base table, keyset-paginated
 *     on the first PK column (`pk > afterPk`). Timestamp is formatted as a
 *     UTC wall-clock string because the column is `timestamp without time
 *     zone` storing bare UTC — passing a JS Date lets pg serialize in the
 *     server's local TZ and the comparison fails.
 *   - rowIds path: slice the pre-filtered (RLS-applied) list by offset.
 */
function makeTrashBatchIterator(
  baseModel: any,
  model: Model,
  deletedColumn: Column,
  decoded: { fkUserId: string | null; deletedAt: Date } | null,
  rowIdsPath: string[],
): () => Promise<string[]> {
  let afterPk: string | null = null;
  let rowIdsOffset = 0;

  const lmtCol = model.columns.find(
    (c) => c.uidt === UITypes.LastModifiedTime && c.system,
  );
  const lmbCol = model.columns.find(
    (c) => c.uidt === UITypes.LastModifiedBy && c.system,
  );
  const primaryKeys = model.primaryKeys;
  const pkColNames = primaryKeys.map((pk) => pk.column_name);
  const pkOrderCol = primaryKeys[0].column_name;
  const lmtValue = decoded
    ? decoded.deletedAt.toISOString().replace('T', ' ').replace('Z', '')
    : null;

  return async () => {
    if (!decoded) {
      const batch = rowIdsPath.slice(
        rowIdsOffset,
        rowIdsOffset + TRASH_BATCH_SIZE,
      );
      rowIdsOffset += TRASH_BATCH_SIZE;
      return batch;
    }

    if (!lmtCol) return [];

    const qb = baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .where(lmtCol.column_name, lmtValue)
      .orderBy(pkOrderCol)
      .limit(TRASH_BATCH_SIZE)
      .select(pkColNames);

    if (lmbCol) {
      if (decoded.fkUserId === null) {
        qb.whereNull(lmbCol.column_name);
      } else {
        qb.where(lmbCol.column_name, decoded.fkUserId);
      }
    }

    if (afterPk != null) {
      qb.where(pkOrderCol, '>', afterPk);
    }

    const rlsConditions = await baseModel.getRlsConditions();
    if (rlsConditions?.length) {
      await conditionV2(
        baseModel,
        [new Filter({ children: rlsConditions, is_group: true })],
        qb,
      );
    }

    const rows = await qb;
    const batch = rows.map((r: Record<string, any>) =>
      String(getCompositePkValue(primaryKeys, r)),
    );
    if (batch.length) afterPk = batch[batch.length - 1];
    return batch;
  };
}

/**
 * Filter a list of rowIds down to the subset visible under the current user's
 * RLS policies. `requireDeleted: true` (default) also filters to soft-deleted
 * rows — anything dropped is treated the same as "does not exist" by callers.
 * Pass `false` to get RLS-only filtering (callers then decide what to do with
 * active rows — e.g. permanentDelete wants to throw 422).
 */
async function filterRowIdsByRls(
  baseModel: any,
  model: Model,
  deletedColumn: Column,
  rowIds: string[],
  opts: { requireDeleted?: boolean } = {},
): Promise<string[]> {
  if (!rowIds?.length) return [];

  const primaryKeys = model.primaryKeys;
  const pkColNames = primaryKeys.map((pk) => pk.column_name);

  const qb = _whereInPks(
    baseModel.dbDriver(baseModel.tnPath),
    primaryKeys,
    rowIds,
  ).select(pkColNames);

  if (opts.requireDeleted !== false) {
    qb.where(deletedColumn.column_name, true);
  }

  const rlsConditions = await baseModel.getRlsConditions();
  if (rlsConditions?.length) {
    await conditionV2(
      baseModel,
      [new Filter({ children: rlsConditions, is_group: true })],
      qb,
    );
  }

  const rows = await qb;
  return rows.map((r: Record<string, any>) =>
    String(getCompositePkValue(primaryKeys, r)),
  );
}

@Injectable()
export class RecordTrashService {
  private readonly logger = new Logger(RecordTrashService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly tablesService: TablesService,
  ) {}

  /**
   * List soft-delete events (one per delete operation) for a table.
   *
   * Rows are grouped on `(LastModifiedBy, LastModifiedTime)` on the base table
   * itself — every soft-delete invocation stamps one timestamp across all
   * affected rows (see delete.ts `operationNow`), so rows deleted in one
   * operation collapse into a single group naturally.
   *
   * Pagination is keyset on `(lmt, lmb)` so new deletes arriving at the top
   * never shift ranks between pages — each page resumes strictly after the
   * last group of the previous page.
   *
   */
  async listTrashEvents(
    context: NcContext,
    param: {
      tableId: string;
      limit?: number;
      cursor?: string;
    },
  ) {
    const limit = Math.max(1, Math.min(param.limit ?? 25, 100));
    const cursor = decodeCursor(param.cursor);

    const emptyResponse = {
      list: [] as any[],
      retentionDays: 30,
      trashDisabled: false,
      pageInfo: {
        pageSize: limit,
        nextCursor: null as string | null,
        hasMore: false,
      },
    };

    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    if (!deletedColumn) return emptyResponse;

    const lmtCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );
    if (!lmtCol) return emptyResponse;

    const lmbCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) return emptyResponse;

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const primaryKeys = model.primaryKeys;
    const pkColNames = primaryKeys.map((pk) => pk.column_name);
    const pkOrderCol = primaryKeys[0].column_name;
    const lmt = lmtCol.column_name;
    const lmb = lmbCol?.column_name;

    const PREVIEW_LIMIT = 1000;

    // ── Query 1: group + rank + collect PKs (PV deliberately excluded) ──────
    const partitionSql = lmb ? '??, ??' : '??';
    const partitionBindings = lmb ? [lmb, lmt] : [lmt];

    const innerSelect: any[] = [
      ...pkColNames.map((c) => baseModel.dbDriver.ref(c)),
      baseModel.dbDriver.ref(lmt),
    ];
    if (lmb) innerSelect.push(baseModel.dbDriver.ref(lmb));

    innerSelect.push(
      baseModel.dbDriver.raw(
        `ROW_NUMBER() OVER (PARTITION BY ${partitionSql} ORDER BY ??) AS "__nc_trash_rn"`,
        [...partitionBindings, pkOrderCol],
      ),
      baseModel.dbDriver.raw(
        `COUNT(*) OVER (PARTITION BY ${partitionSql}) AS "__nc_trash_grp_count"`,
        partitionBindings,
      ),
      baseModel.dbDriver.raw(
        lmb
          ? `DENSE_RANK() OVER (ORDER BY ?? DESC, COALESCE(??, '') DESC) AS "__nc_trash_grp_rank"`
          : `DENSE_RANK() OVER (ORDER BY ?? DESC) AS "__nc_trash_grp_rank"`,
        lmb ? [lmt, lmb] : [lmt],
      ),
    );

    const innerQb = baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .select(innerSelect);

    // ── Cursor filter: strictly after (cursor.lmt, cursor.lmb) in sort order ──
    if (cursor) {
      if (lmb) {
        innerQb.where(function () {
          this.where(lmt, '<', cursor.lmt).orWhere(function () {
            this.where(lmt, '=', cursor.lmt).whereRaw(`COALESCE(??, '') < ?`, [
              lmb,
              cursor.lmb,
            ]);
          });
        });
      } else {
        innerQb.where(lmt, '<', cursor.lmt);
      }
    }

    const rlsConditions = await baseModel.getRlsConditions();
    if (rlsConditions?.length) {
      await conditionV2(
        baseModel,
        [new Filter({ children: rlsConditions, is_group: true })],
        innerQb,
      );
    }

    const outerQb = baseModel.dbDriver
      .with('filtered', innerQb)
      .from('filtered')
      .where('__nc_trash_grp_rank', '<=', limit + 1)
      .where('__nc_trash_rn', '<=', PREVIEW_LIMIT)
      .select('*')
      .orderBy([
        { column: '__nc_trash_grp_rank', order: 'asc' },
        { column: '__nc_trash_rn', order: 'asc' },
      ]);

    const rows = (await outerQb) as Array<Record<string, any>>;

    // ── Bucket rows by grp_rank → one bucket per event ──────────────────────
    interface Bucket {
      fk_user_id: string | null;
      deleted_at: unknown;
      grp_count: number;
      rowIds: string[];
    }
    const groupsByRank = new Map<number, Bucket>();

    for (const row of rows) {
      const rank = Number(row.__nc_trash_grp_rank);
      if (!groupsByRank.has(rank)) {
        groupsByRank.set(rank, {
          fk_user_id: lmb ? row[lmb] ?? null : null,
          deleted_at: row[lmt],
          grp_count: Number(row.__nc_trash_grp_count) || 0,
          rowIds: [],
        });
      }
      const rowId = getCompositePkValue(primaryKeys, row) as string;
      groupsByRank.get(rank)!.rowIds.push(rowId);
    }

    const sortedRanks = [...groupsByRank.keys()].sort((a, b) => a - b);
    const hasMore = sortedRanks.length > limit;
    const visibleRanks = hasMore ? sortedRanks.slice(0, limit) : sortedRanks;

    // ── Query 2: resolve PV through the normal read pipeline (handles formula) ─
    const visibleRowIds: string[] = [];
    for (const rank of visibleRanks) {
      visibleRowIds.push(...groupsByRank.get(rank)!.rowIds);
    }

    const pvByRowId = new Map<string, any>();
    if (visibleRowIds.length) {
      const records = (await (baseModel as any).chunkList({
        pks: visibleRowIds,
        deletedOnly: true,
        extractOnlyPrimaries: true,
      })) as Array<Record<string, any>>;

      const pvTitle = model.columns.find((c) => c.pv)?.title;
      for (const rec of records) {
        const rowId = getCompositePkValue(primaryKeys, rec) as string;
        pvByRowId.set(rowId, pvTitle ? rec[pvTitle] ?? null : null);
      }
    }

    // Resolve display_name + email in one query so every event's avatar + title
    // render correctly even if the frontend's base-user cache is cold. Using
    // MetaTable.USERS directly is safe here because we only expose display_name
    // and email, both already visible in the UI next to these avatars.
    const userIdsToResolve = Array.from(
      new Set(
        visibleRanks
          .map((r) => groupsByRank.get(r)?.fk_user_id)
          .filter((id): id is string => !!id),
      ),
    );
    const userById = new Map<
      string,
      { display_name: string | null; email: string | null }
    >();
    if (userIdsToResolve.length) {
      const users = await Noco.ncMeta
        .knex(MetaTable.USERS)
        .select('id', 'display_name', 'email')
        .whereIn('id', userIdsToResolve);
      for (const u of users) {
        userById.set(u.id, {
          display_name: u.display_name ?? null,
          email: u.email ?? null,
        });
      }
    }

    const enriched: any[] = [];
    let lastLmtIso: string | null = null;
    let lastFkUserId: string | null = null;

    for (const rank of visibleRanks) {
      const g = groupsByRank.get(rank)!;
      const deletedAtIso = toIsoString(g.deleted_at);
      if (!deletedAtIso) continue;

      const u = g.fk_user_id ? userById.get(g.fk_user_id) : null;

      enriched.push({
        id: encodeEventId(g.fk_user_id, deletedAtIso),
        op_type:
          g.grp_count > 1
            ? AuditV1OperationTypes.DATA_BULK_SOFT_DELETE
            : AuditV1OperationTypes.DATA_SOFT_DELETE,
        created_at: deletedAtIso,
        fk_user_id: g.fk_user_id,
        display_name: u?.display_name ?? null,
        email: u?.email ?? null,
        row_count: g.grp_count,
        preview_rows: g.rowIds.map((rowId) => ({
          row_id: rowId,
          pv: pvByRowId.get(rowId) ?? null,
        })),
      });

      lastLmtIso = deletedAtIso;
      lastFkUserId = g.fk_user_id;
    }

    const nextCursor =
      hasMore && lastLmtIso ? encodeCursor(lastLmtIso, lastFkUserId) : null;

    const retentionDays =
      model.trash_retention_days ?? (await resolveTrashRetentionDays(context));

    return {
      list: enriched,
      retentionDays,
      trashDisabled: !!model.trash_disabled,
      pageInfo: {
        pageSize: limit,
        nextCursor,
        hasMore,
      },
    };
  }

  async restoreRecords(
    context: NcContext,
    param: {
      tableId: string;
      /** Explicit primary keys to restore. Ignored if eventId is provided. */
      rowIds?: string[];
      /** Trash event id from listTrashEvents — encodes (LastModifiedBy, LastModifiedTime). */
      eventId?: string;
      req: NcRequest;
      /** If true, restore the record even when OO link conflicts exist — conflicting FKs are nulled */
      force?: boolean;
    },
  ) {
    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // ── Input validation + streaming source setup ───────────────────────────
    // Two sources: event (streamed — unbounded) or caller-supplied rowIds
    // (capped at 1000). The rowIds path is RLS-filtered up front because the
    // caller could guess primary keys outside their scope.
    let decoded: ReturnType<typeof decodeEventId> = null;
    let rowIdsPath: string[] = [];

    if (param.eventId) {
      decoded = decodeEventId(param.eventId);
      if (!decoded) return { message: `0 record(s) restored` };
    } else {
      if (!Array.isArray(param.rowIds) || !param.rowIds.length) {
        NcError.get(context).badRequest('rowIds or eventId must be provided');
      }
      if (param.rowIds.length > 1000) {
        NcError.get(context).trashBatchLimitExceeded(1000);
      }
      rowIdsPath = await filterRowIdsByRls(
        baseModel,
        model,
        deletedColumn,
        param.rowIds,
      );
      if (!rowIdsPath.length) return { message: `0 record(s) restored` };
    }

    // ── Build restore payload: undelete + stamp LMT/LMB ─────────────────────
    const restorePayload: Record<string, any> = {
      [deletedColumn.column_name]: false,
    };
    const lmtCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );
    const lmbCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );
    if (lmtCol) restorePayload[lmtCol.column_name] = baseModel.now();
    if (lmbCol) restorePayload[lmbCol.column_name] = param.req?.user?.id;

    const primaryKeys = model.primaryKeys;
    const attachmentColumns = model.columns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    // ── Conflict pre-flight (force=false only) ──────────────────────────────
    // Required for force=false so we can fail atomically — no writes until
    // every batch has been scanned. force=true skips this and detects per
    // batch inline in the apply loop below.
    if (!param.force) {
      const allConflicts: LinkConflict[] = [];
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        decoded,
        rowIdsPath,
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batchIds = await nextBatch();
        if (!batchIds.length) break;

        const conflicts = await this._detectLinkConflicts(
          context,
          model,
          baseModel,
          deletedColumn,
          batchIds,
        );
        if (conflicts.length) allConflicts.push(...conflicts);
      }

      if (allConflicts.length) {
        const details = allConflicts
          .map(
            (c) =>
              `row ${c.rowId}: column "${c.columnTitle}" conflicts with active record`,
          )
          .join('; ');
        NcError.get(context).recordRestoreConflict(details);
      }
    }

    // ── Apply pass ──────────────────────────────────────────────────────────
    // force=true: detect conflicts per batch into local maps and resolve
    //   inline. Safe because force-restore never throws — no half-applied
    //   state is possible.
    // force=false: pre-flight above already proved no conflicts exist, so
    //   the apply just runs with empty conflict maps.
    let totalRestored = 0;

    {
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        decoded,
        rowIdsPath,
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batchIds = await nextBatch();
        if (!batchIds.length) break;

        const v1ConflictMap = new Map<string, string[]>();
        const v2ConflictsByRowId = new Map<
          string,
          Array<{ colId: string; anchorPk: unknown }>
        >();

        if (param.force) {
          const conflicts = await this._detectLinkConflicts(
            context,
            model,
            baseModel,
            deletedColumn,
            batchIds,
          );
          for (const c of conflicts) {
            if (c.kind === 'v2') {
              const list = v2ConflictsByRowId.get(c.rowId) ?? [];
              list.push({ colId: c.colId, anchorPk: c.conflictAnchorPk });
              v2ConflictsByRowId.set(c.rowId, list);
            } else {
              const cols = v1ConflictMap.get(c.rowId) ?? [];
              cols.push(c.fkColumnName);
              v1ConflictMap.set(c.rowId, cols);
            }
          }
        }

        await this._applyRestoreBatch({
          context,
          baseModel,
          model,
          deletedColumn,
          batchIds,
          primaryKeys,
          restorePayload,
          v1ConflictMap,
          v2ConflictsByRowId,
          attachmentColumns,
          req: param.req,
          tableId: param.tableId,
        });

        totalRestored += batchIds.length;
      }
    }

    if (!totalRestored) {
      return { message: `0 record(s) restored` };
    }

    // ── Post-restore: clear trash_cleanup_due_at if trash is now empty ──────
    const remainingTrashCount = await baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .count('* as count')
      .first();

    if (
      !remainingTrashCount?.count ||
      Number(remainingTrashCount.count) === 0
    ) {
      await Model.updateTrashCleanupDueAt(context, model.id, null);
    }

    return { message: `${totalRestored} record(s) restored` };
  }

  async permanentDeleteRecords(
    context: NcContext,
    param: {
      tableId: string;
      /** Explicit primary keys to permanently delete. Ignored if eventId is provided. */
      rowIds?: string[];
      /** Trash event id from listTrashEvents — encodes (LastModifiedBy, LastModifiedTime). */
      eventId?: string;
      req: NcRequest;
    },
  ) {
    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // ── Input validation + streaming source setup ──────────────────────────
    let decoded: ReturnType<typeof decodeEventId> = null;
    let rowIdsPath: string[] = [];

    if (param.eventId) {
      decoded = decodeEventId(param.eventId);
      if (!decoded) return { message: `0 record(s) permanently deleted` };
    } else {
      if (!Array.isArray(param.rowIds) || !param.rowIds.length) {
        NcError.get(context).badRequest('rowIds or eventId must be provided');
      }
      if (param.rowIds.length > 1000) {
        NcError.get(context).trashBatchLimitExceeded(1000);
      }
      // RLS-only filter — keep active rows in the list so
      // `permanentDeleteByIds` can throw `recordNotTrashed` (422). Dropping
      // them here would silently 200 with "0 record(s) permanently deleted".
      rowIdsPath = await filterRowIdsByRls(
        baseModel,
        model,
        deletedColumn,
        param.rowIds,
        { requireDeleted: false },
      );
      if (!rowIdsPath.length) {
        return { message: `0 record(s) permanently deleted` };
      }
    }

    // ── Streaming permanent delete ─────────────────────────────────────────
    // Use the proper delete pipeline so MM/HM links and file references are
    // cleaned up. isBulkAllOperation=true gives us a single parent audit
    // spanning all batches instead of one per chunk.
    let totalDeleted = 0;
    const nextBatch = makeTrashBatchIterator(
      baseModel,
      model,
      deletedColumn,
      decoded,
      rowIdsPath,
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchIds = await nextBatch();
      if (!batchIds.length) break;

      await baseModel.permanentDeleteByIds(batchIds, param.req, true);

      this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
        context,
        req: param.req,
        tableId: param.tableId,
        rowIds: batchIds,
      });

      totalDeleted += batchIds.length;
    }

    // Clear trash_cleanup_due_at if trash is now empty (mirrors restoreRecords).
    if (totalDeleted) {
      const remaining = await baseModel
        .dbDriver(baseModel.tnPath)
        .where(deletedColumn.column_name, true)
        .count('* as count')
        .first();
      if (!remaining?.count || Number(remaining.count) === 0) {
        await Model.updateTrashCleanupDueAt(context, model.id, null);
      }
    }

    return {
      message: `${totalDeleted} record(s) permanently deleted`,
    };
  }

  async emptyTrash(
    context: NcContext,
    param: {
      tableId: string;
      req: NcRequest;
    },
  ) {
    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) return { message: 'No trash to empty' };

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) return { message: 'No trash to empty' };

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Paginated permanent delete of trashed records visible to the caller.
    // RLS is applied so a caller cannot wipe trashed rows outside their scope.
    const primaryKeys = model.primaryKeys;
    const pkColNames = primaryKeys.map((pk) => pk.column_name);
    let totalDeleted = 0;

    const rlsConditions = await baseModel.getRlsConditions();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const qb = baseModel
        .dbDriver(baseModel.tnPath)
        .select(pkColNames)
        .where(deletedColumn.column_name, true)
        .limit(TRASH_BATCH_SIZE);

      if (rlsConditions?.length) {
        await conditionV2(
          baseModel,
          [new Filter({ children: rlsConditions, is_group: true })],
          qb,
        );
      }

      const rows = await baseModel.execAndParse(qb, null, { raw: true });

      if (!rows.length) break;

      const ids = rows.map((r) => getCompositePkValue(primaryKeys, r));
      await baseModel.permanentDeleteByIds(ids, param.req, true);
      totalDeleted += ids.length;
      this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
        context,
        req: param.req,
        tableId: param.tableId,
        rowIds: ids,
      });
    }

    // Reset trash_cleanup_due_at only if no trashed records remain for anyone.
    // (Can't assume that from within an RLS-scoped loop.)
    const remaining = await baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .count('* as count')
      .first();

    if (!remaining?.count || Number(remaining.count) === 0) {
      await Model.updateTrashCleanupDueAt(context, model.id, null);
    }

    return { message: `${totalDeleted} record(s) permanently deleted` };
  }

  async getTrashCount(
    context: NcContext,
    param: {
      tableId: string;
    },
  ) {
    const model = await Model.get(context, param.tableId);
    if (!model) return { count: 0 };

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) return { count: 0 };

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) return { count: 0 };

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const countQb = baseModel
      .dbDriver(baseModel.tnPath)
      .count('* as count')
      .where(deletedColumn.column_name, true);

    const rlsConditions = await baseModel.getRlsConditions();
    if (rlsConditions.length) {
      await conditionV2(
        baseModel,
        [new Filter({ children: rlsConditions, is_group: true })],
        countQb,
      );
    }

    const result = await countQb.first();

    const retentionDays =
      model.trash_retention_days ?? (await resolveTrashRetentionDays(context));

    return {
      count: +(result?.count ?? 0),
      retentionDays,
      trashDisabled: !!model.trash_disabled,
    };
  }

  // ── Trash settings (EE) ────────────────────────────────────────────────────

  async getBaseTrashSettings(
    context: NcContext,
    param: {
      baseId: string;
      user: NcRequest['user'];
      roles: Record<string, boolean>;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_TRASH_SETTINGS);

    const accessibleTables = await this.tablesService.getAccessibleTables(
      context,
      {
        baseId: param.baseId,
        roles: param.roles,
        user: param.user,
        allSources: true,
      },
    );

    const defaultRetentionDays = await resolveTrashRetentionDays(context);

    const sources = await Source.list(context, { baseId: param.baseId });
    const metaSourceId = sources.find((s) => s.isMeta())?.id;

    const tables = await Promise.all(
      accessibleTables.map(async (model) => {
        await model.getColumns(context);

        const hasDeletedColumn = model.columns.some((c) => isDeletedCol(c));

        return {
          id: model.id,
          title: model.title,
          trash_disabled: model.trash_disabled,
          trash_retention_days: model.trash_retention_days,
          is_meta: !!metaSourceId && model.source_id === metaSourceId,
          has_deleted_column: hasDeletedColumn,
        };
      }),
    );

    return { tables, defaultRetentionDays };
  }

  async updateTrashSettings(
    context: NcContext,
    param: {
      tableId: string;
      body: {
        trash_disabled?: boolean | null;
        trash_retention_days?: number | null;
      };
    },
    req: NcRequest,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_TRASH_SETTINGS);

    // Verify table visibility first
    const accessibleTables = await this.tablesService.getAccessibleTables(
      context,
      {
        baseId: context.base_id,
        roles: req?.user?.base_roles ?? {},
        user: req?.user,
        allSources: true,
      },
    );

    if (!accessibleTables.some((t) => t.id === param.tableId)) {
      NcError.get(context).tableNotFound(param.tableId);
    }

    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    await model.getColumns(context);
    if (!model.columns.some((c) => isDeletedCol(c))) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    await Model.updateTrashSettings(context, param.tableId, param.body);

    if (param.body.trash_disabled) {
      await this.emptyTrash(context, { tableId: param.tableId, req });
    }

    return { message: 'Trash settings updated' };
  }

  /**
   * Detect link conflicts for records about to be restored — a conflict
   * occurs when another active record has since claimed a link slot that
   * was held by the soft-deleted record.
   *
   *   - V1 OO (direct FK on this table) — rival now holds the same FK value.
   *   - V2 OO/OM (junction, unique on child side) — another active junction
   *     row now occupies the same rival-side slot.
   *
   * V1 HM/BT and V2 MO/MM have no per-side uniqueness → skipped.
   */
  private async _detectLinkConflicts(
    context: NcContext,
    model: Awaited<ReturnType<typeof Model.get>>,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    deletedColumn: (typeof model.columns)[number],
    rowIds: string[],
  ): Promise<LinkConflict[]> {
    const conflicts: LinkConflict[] = [];

    if (!rowIds.length) return conflicts;

    // ── V1 OO child columns (direct FK on this table) ──────────────────────
    const ooV1ChildCols: Array<{
      col: (typeof model.columns)[number];
      fkChildCol: Awaited<ReturnType<typeof Column.get>>;
    }> = [];

    // ── V2 junction-based columns with unique constraint on one side ───────
    //   - OO: both sides unique → always include
    //   - HM/OM: model is parent of relation, child side unique → include
    //   - BT/MO: model is child of relation → model owns only one row per
    //     self, no rival slot → skip
    //   - MM: no uniqueness → skip
    const junctionV2Cols: Array<{
      col: (typeof model.columns)[number];
      colOpts: LinkToAnotherRecordColumn;
    }> = [];

    for (const col of model.columns) {
      if (!isLinksOrLTAR(col)) continue;

      const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );

      if (isMMOrMMLike(col) && colOpts.version === LinksVersion.V2) {
        if (colOpts.type === 'oo' || colOpts.type === 'om') {
          junctionV2Cols.push({ col, colOpts });
        }
        continue;
      }

      // V1 OO direct-FK (child side only — only care when the FK lives on this table)
      if (colOpts.type !== 'oo') continue;
      if (!col.meta?.bt) continue;

      const fkChildCol = await Column.get(context, {
        colId: colOpts.fk_child_column_id,
      });
      const fkChildTable = await fkChildCol.getModel(context);

      if (fkChildTable.id !== model.id) continue;

      ooV1ChildCols.push({ col, fkChildCol });
    }

    // ── V1 conflict detection (direct FK) ───────────────────────────────────
    const CHUNK = 500;
    if (ooV1ChildCols.length) {
      const primaryKeys = model.primaryKeys;
      const pkColName = primaryKeys[0]?.column_name;
      const tnPath = baseModel.tnPath;
      const delColName = deletedColumn.column_name;

      for (const { col, fkChildCol } of ooV1ChildCols) {
        const fkColName = fkChildCol.column_name;

        for (let i = 0; i < rowIds.length; i += CHUNK) {
          const chunk = rowIds.slice(i, i + CHUNK);
          const conflictRows = await baseModel.dbDriver
            .from(baseModel.dbDriver.raw('?? as ??', [tnPath, 't1']))
            .whereIn(`t1.${pkColName}`, chunk)
            .where(`t1.${delColName}`, true)
            .whereNotNull(`t1.${fkColName}`)
            .whereExists(function () {
              this.select(baseModel.dbDriver.raw('1'))
                .from(baseModel.dbDriver.raw('?? as ??', [tnPath, 't2']))
                .whereRaw('?? = ??', [`t2.${fkColName}`, `t1.${fkColName}`])
                .whereRaw('?? != ??', [`t2.${pkColName}`, `t1.${pkColName}`])
                .where(function () {
                  this.whereNull(`t2.${delColName}`).orWhere(
                    `t2.${delColName}`,
                    false,
                  );
                });
            })
            .select(`t1.${pkColName} as row_id`);

          for (const row of conflictRows) {
            conflicts.push({
              kind: 'v1',
              rowId: String(row.row_id),
              columnTitle: col.title,
              fkColumnName: fkColName,
            });
          }
        }
      }
    }

    // ── V2 conflict detection (junction table) ──────────────────────────────
    // Conflict: the restored record's junction row shares its rival-side value
    // with another junction row owned by a different active record.
    if (junctionV2Cols.length) {
      const primaryKeys = model.primaryKeys;

      for (const { col, colOpts } of junctionV2Cols) {
        const { mmContext } = await colOpts.getParentChildContext(context);
        const mmModel = await colOpts.getMMModel(mmContext);
        const mmChildCol = await colOpts.getMMChildColumn(mmContext);
        const mmParentCol = await colOpts.getMMParentColumn(mmContext);

        if (!mmModel || !mmChildCol || !mmParentCol) {
          this.logger.warn(
            `V2 link conflict detection: could not resolve junction table for column "${col.title}" — skipping`,
          );
          continue;
        }

        const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
          id: mmModel.id,
          dbDriver: baseModel.dbDriver,
        });
        const mmTnPath = assocBaseModel.getTnPath(mmModel);
        const mainTnPath = baseModel.tnPath;
        const childColName = mmChildCol.column_name;
        const parentColName = mmParentCol.column_name;
        const pkColName = primaryKeys[0]?.column_name;
        const delColName = deletedColumn.column_name;

        for (let i = 0; i < rowIds.length; i += CHUNK) {
          const chunk = rowIds.slice(i, i + CHUNK);
          const conflictRows = await baseModel.dbDriver
            .from(baseModel.dbDriver.raw('?? as ??', [mmTnPath, 'j1']))
            .whereIn(`j1.${childColName}`, chunk)
            .whereExists(function () {
              this.select(baseModel.dbDriver.raw('1'))
                .from(baseModel.dbDriver.raw('?? as ??', [mmTnPath, 'j2']))
                .join(
                  baseModel.dbDriver.raw('?? as ??', [mainTnPath, 'm']),
                  `m.${pkColName}`,
                  `j2.${childColName}`,
                )
                .whereRaw('?? = ??', [
                  `j2.${parentColName}`,
                  `j1.${parentColName}`,
                ])
                .whereRaw('?? != ??', [
                  `j2.${childColName}`,
                  `j1.${childColName}`,
                ])
                .where(function () {
                  this.whereNull(`m.${delColName}`).orWhere(
                    `m.${delColName}`,
                    false,
                  );
                });
            })
            .select([
              `j1.${childColName} as row_id`,
              `j1.${parentColName} as conflict_anchor_pk`,
            ]);

          for (const row of conflictRows) {
            conflicts.push({
              kind: 'v2',
              rowId: String(row.row_id),
              columnTitle: col.title,
              colId: col.id,
              conflictAnchorPk: row.conflict_anchor_pk,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Apply the per-batch restore work: V2 junction conflict resolution →
   * fetch preRestoreRows → UPDATE → attachment restore → linked-records
   * broadcast → afterBulkRestore (reuses parent audit) → per-batch hooks.
   */
  private async _applyRestoreBatch(opts: {
    context: NcContext;
    baseModel: any;
    model: Awaited<ReturnType<typeof Model.get>>;
    deletedColumn: Column;
    batchIds: string[];
    primaryKeys: Column[];
    restorePayload: Record<string, any>;
    v1ConflictMap: Map<string, string[]>;
    v2ConflictsByRowId: Map<
      string,
      Array<{ colId: string; anchorPk: unknown }>
    >;
    attachmentColumns: Column[];
    req: NcRequest;
    tableId: string;
  }): Promise<void> {
    const {
      context,
      baseModel,
      model,
      deletedColumn,
      batchIds,
      primaryKeys,
      restorePayload,
      v1ConflictMap,
      v2ConflictsByRowId,
      attachmentColumns,
      req,
      tableId,
    } = opts;

    // V2 junction conflict resolution — delete the restored record's own
    // junction row so the active rival's link is the one that stands.
    for (const rowId of batchIds) {
      const v2Items = v2ConflictsByRowId.get(rowId);
      if (!v2Items?.length) continue;

      for (const item of v2Items) {
        if (item.anchorPk == null) continue;
        const col = model.columns.find((c) => c.id === item.colId);
        if (!col) continue;

        const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
        const { mmContext } = await colOpts.getParentChildContext(context);
        const mmModel = await colOpts.getMMModel(mmContext);
        const mmChildCol = await colOpts.getMMChildColumn(mmContext);
        const mmParentCol = await colOpts.getMMParentColumn(mmContext);

        if (!mmModel || !mmChildCol || !mmParentCol) continue;

        const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
          id: mmModel.id,
          dbDriver: baseModel.dbDriver,
        });

        await baseModel
          .dbDriver(assocBaseModel.getTnPath(mmModel))
          .where(mmChildCol.column_name, rowId)
          .where(mmParentCol.column_name, item.anchorPk)
          .del();
      }
    }

    // Fetch records before restoring — needed for audit log
    const preRestoreRows = await baseModel.execAndParse(
      _whereInPks(baseModel.dbDriver(baseModel.tnPath), primaryKeys, batchIds)
        .where(deletedColumn.column_name, true)
        .select(
          model.columns.filter((c) => c.column_name).map((c) => c.column_name),
        ),
      model.columns,
      { raw: true },
    );

    if (!preRestoreRows.length) return;

    // UPDATE: undelete + stamp LMT/LMB; V1 OO conflicts also null their FK
    try {
      const batchConflictIds = batchIds.filter((id) => v1ConflictMap.has(id));

      if (batchConflictIds.length) {
        const cleanIds = batchIds.filter((id) => !v1ConflictMap.has(id));
        if (cleanIds.length) {
          await _whereInPks(
            baseModel.dbDriver(baseModel.tnPath),
            primaryKeys,
            cleanIds,
          )
            .where(deletedColumn.column_name, true)
            .update(restorePayload);
        }

        for (const id of batchConflictIds) {
          const fkCols = v1ConflictMap.get(id)!;
          const update: Record<string, any> = { ...restorePayload };
          for (const col of fkCols) update[col] = null;

          await baseModel
            .dbDriver(baseModel.tnPath)
            .where(_wherePk(primaryKeys, id, true))
            .where(deletedColumn.column_name, true)
            .update(update);
        }
      } else {
        await _whereInPks(
          baseModel.dbDriver(baseModel.tnPath),
          primaryKeys,
          batchIds,
        )
          .where(deletedColumn.column_name, true)
          .update(restorePayload);
      }
    } catch (e: any) {
      await handleUniqueConstraintError({ error: e, baseModel });
      throw e;
    }

    // Restore soft-deleted file references from attachment columns
    if (attachmentColumns.length) {
      const fileRefIds: string[] = [];
      for (const row of preRestoreRows) {
        for (const col of attachmentColumns) {
          const val = row[col.column_name] || row[col.title];
          if (!val) continue;
          try {
            const attachments = typeof val === 'string' ? JSON.parse(val) : val;
            if (Array.isArray(attachments)) {
              for (const att of attachments) {
                if (att.id) fileRefIds.push(att.id);
              }
            }
          } catch {
            // ignore invalid JSON
          }
        }
      }
      if (fileRefIds.length) {
        await FileReference.softRestore(context, fileRefIds);
      }
    }

    await baseModel.updateLinkedRecordsOnDelete(batchIds, req);
    await baseModel.afterBulkRestore(preRestoreRows, req, true);

    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: { ...context, cache: false, cacheMap: undefined },
      hookName: 'after.bulkInsert',
      prevData: null,
      newData: preRestoreRows,
      user: req?.user,
      viewId: null,
      modelId: model.id,
      tnPath: baseModel.tnPath,
    });

    this.appHooksService.emit(AppEvents.RECORDS_RESTORE, {
      context,
      req,
      tableId,
      rowIds: batchIds,
    });
  }
}
