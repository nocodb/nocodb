import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  LinksVersion,
  UITypes,
} from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  TrashCallParam,
  TrashLifecycleResult,
  TrashListEnrichment,
  TrashResult,
} from '~/services/base-trash/types';
import type { MetaService } from '~/meta/meta.service';
import BaseTrash from '~/models/BaseTrash';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Column, FileReference, Filter, Model, Source } from '~/models';
import conditionV2 from '~/db/conditionV2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  _wherePk,
  getCompositePkValue,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';
import { handleUniqueConstraintError } from '~/helpers/uniqueConstraintErrorHandler';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import {
  buildRecordResourceId,
  filterRowIdsByRls,
  makeTrashBatchIterator,
  parseRecordResourceId,
  type RestoreConflict,
  type RowResolution,
  whereInPks,
} from '~/services/base-trash/record-trash.helpers';

@Injectable()
export class RecordTrashHandler extends BaseTrashHandler<{
  id: string;
  base_id: string;
  title: string;
}> {
  resourceType = 'record';
  affectedCaches = [] as const;

  private readonly logger = new Logger(RecordTrashHandler.name);

  constructor(private readonly appHooksService: AppHooksService) {
    super();
  }

  async enrich(
    ctx: NcContext,
    trashEntry: BaseTrash,
  ): Promise<TrashListEnrichment> {
    const INLINE_CAP = 1000;

    const parsed = parseRecordResourceId(trashEntry.resource_id);
    if (!parsed) return { drop: true };

    const model = await Model.get(ctx, parsed.tableId, true);
    if (!model) return { drop: true };

    await model.getColumns(ctx);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    const lmtCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );
    const lmbCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );
    if (!deletedColumn || !lmtCol) return { drop: true };

    const source = await Source.get(ctx, model.source_id);
    if (!source || !source.isMeta()) return { drop: true };

    const baseModel = await Model.getBaseModelSQL(ctx, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const primaryKeys = model.primaryKeys;
    const pkColNames = primaryKeys.map((pk) => pk.column_name);

    const qb = baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .where(lmtCol.column_name, parsed.deletedAt.toISOString())
      .select(pkColNames.map((c) => baseModel.dbDriver.ref(c)))
      .orderBy(primaryKeys[0].column_name, 'asc')
      .limit(INLINE_CAP + 1);

    if (lmbCol) {
      if (parsed.fkUserId) {
        qb.where(lmbCol.column_name, parsed.fkUserId);
      } else {
        qb.whereNull(lmbCol.column_name);
      }
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
    const hasMore = rows.length > INLINE_CAP;
    const visibleRows = hasMore ? rows.slice(0, INLINE_CAP) : rows;
    if (!visibleRows.length) return { drop: true };

    const rowIds = visibleRows.map(
      (row) => getCompositePkValue(primaryKeys, row) as string,
    );

    const records = await baseModel.chunkList({
      pks: rowIds,
      deletedOnly: true,
      extractOnlyPrimaries: true,
    });

    return {
      extra: {
        records,
        has_more_records: hasMore,
        visible_record_count: records.length,
      },
    };
  }

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<{ id: string; base_id: string; title: string }>> {
    const parsed = parseRecordResourceId(id);
    if (!parsed) {
      NcError.get(ctx).invalidRequestBody(
        `Invalid record trash resource_id: ${id}`,
      );
    }

    const table = await Model.get(ctx, parsed.tableId, false, ncMeta);
    if (!table) {
      // Table was deleted between the soft-delete and now. Don't insert
      // a trash row — the table-trash cascade would have wiped it anyway.
      NcError.get(ctx).tableNotFound(parsed.tableId);
    }

    return {
      entity: {
        id,
        base_id: table.base_id,
        title: table.title,
      },
      parentType: 'table',
      parentId: parsed.tableId,
      parentName: table.title,
    };
  }

  /**
   * Restore the rows in this trash entry. RLS-bounded — the caller only
   * sees / restores rows their RLS policy permits.
   *
   * Conflict modes (via TrashCallParam.force / partial):
   *   - default: 422 with structured conflict list, restore nothing
   *   - force:   restore everything; null offending columns / drop junction rows
   *   - partial: restore only the rows with no conflicts; leave others in trash
   *
   * Returns `keepEntry: true` if any matching rows remain after the pass
   * (someone else's RLS-hidden rows, or partial-mode skips), so the
   * BaseTrash row survives until everyone's residue is cleared.
   */
  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void> {
    const parsed = parseRecordResourceId(trashEntry.resource_id);
    if (!parsed) {
      this.logger.warn(
        `Skipping record restore — unparseable resource_id: ${trashEntry.resource_id}`,
      );
      return;
    }

    if (param.force && param.partial) {
      NcError.get(ctx).badRequest(
        '`force` and `partial` are mutually exclusive',
      );
    }

    const model = await Model.get(ctx, parsed.tableId, false, ncMeta);
    if (!model) NcError.get(ctx).tableNotFound(parsed.tableId);
    await model.getColumns(ctx, ncMeta);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    if (!deletedColumn) NcError.get(ctx).tableTrashNotSupported(model.title);

    const source = await Source.get(ctx, model.source_id, false, ncMeta);
    if (!source || !source.isMeta()) {
      NcError.get(ctx).tableTrashNotSupported(model.title);
    }

    const baseModel = await Model.getBaseModelSQL(ctx, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const decoded = {
      fkUserId: parsed.fkUserId,
      deletedAt: parsed.deletedAt,
    };

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

    // ── Pre-flight pass: collect all conflicts ──────────────────────────
    const allConflicts: RestoreConflict[] = [];
    {
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        decoded,
        [],
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batchIds = await nextBatch();
        if (!batchIds.length) break;

        const conflicts = await this._detectRestoreConflicts(
          ctx,
          model,
          baseModel,
          deletedColumn,
          batchIds,
          primaryKeys,
        );
        if (conflicts.length) allConflicts.push(...conflicts);
      }
    }

    if (allConflicts.length && !param.force && !param.partial) {
      const counts = allConflicts.reduce(
        (acc, c) => ((acc[c.kind] = (acc[c.kind] ?? 0) + 1), acc),
        {} as Record<string, number>,
      );
      const summary = Object.entries(counts)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      NcError.get(ctx).recordRestoreConflict(summary, {
        details: { conflicts: allConflicts, counts },
      });
    }

    const conflictsByRowId = new Map<string, RestoreConflict[]>();
    for (const c of allConflicts) {
      const list = conflictsByRowId.get(c.rowId) ?? [];
      list.push(c);
      conflictsByRowId.set(c.rowId, list);
    }

    // ── Apply pass ──────────────────────────────────────────────────────
    {
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        decoded,
        [],
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let batchIds = await nextBatch();
        if (!batchIds.length) break;

        // Partial mode: drop conflicted rows from this batch
        if (param.partial) {
          batchIds = batchIds.filter((id) => !conflictsByRowId.has(id));
          if (!batchIds.length) continue;
        }

        const batchConflicts: RestoreConflict[] = [];
        if (param.force) {
          for (const id of batchIds) {
            const rowConflicts = conflictsByRowId.get(id);
            if (rowConflicts?.length) batchConflicts.push(...rowConflicts);
          }
        }
        const resolutions = this._buildResolutions(batchConflicts);

        await this._applyRestoreBatch({
          context: ctx,
          baseModel,
          model,
          deletedColumn,
          batchIds,
          primaryKeys,
          restorePayload,
          resolutions,
          attachmentColumns,
          req: param.req,
          tableId: parsed.tableId,
        });
      }
    }

    // Keep the entry if any rows still match (RLS-hidden, partial-skipped).
    const remaining = await this.countRemaining(ctx, parsed, ncMeta);
    return remaining > 0 ? { keepEntry: true } : undefined;
  }

  /**
   * Per-row restore — used by the unified composable's `restoreFromTrash`
   * (undo, "restore selected" toolbar action). Operates on RLS-filtered
   * primary keys directly, bypassing the BaseTrash entry layer; the
   * unified list endpoint won't trim the entry counts on its own, so
   * after the call the inline records under the affected entries refresh
   * naturally on the next list.
   *
   * Same conflict-detection + apply pipeline as the lifecycle restore,
   * but seeded with rowIdsPath instead of a decoded eventId.
   */
  async restoreRows(
    context: NcContext,
    param: {
      tableId: string;
      rowIds: string[];
      req: NcRequest;
      force?: boolean;
      partial?: boolean;
    },
  ): Promise<{
    restored: number;
    skipped: Array<{ rowId: string; conflicts: RestoreConflict[] }>;
    cleared: Array<{ rowId: string; columns: string[] }>;
    message: string;
  }> {
    if (param.force && param.partial) {
      NcError.get(context).badRequest(
        '`force` and `partial` are mutually exclusive',
      );
    }
    if (!Array.isArray(param.rowIds) || !param.rowIds.length) {
      NcError.get(context).badRequest('rowIds must be provided');
    }
    if (param.rowIds.length > 1000) {
      NcError.get(context).trashBatchLimitExceeded(1000);
    }

    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);
    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    if (!deletedColumn)
      NcError.get(context).tableTrashNotSupported(model.title);

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const rowIdsPath = await filterRowIdsByRls(
      baseModel,
      model,
      deletedColumn,
      param.rowIds,
    );
    if (!rowIdsPath.length) {
      return {
        restored: 0,
        skipped: [],
        cleared: [],
        message: '0 record(s) restored',
      };
    }

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

    // Capture the distinct (lmb, lmt) tuples for the rows we're about to
    // restore. These identify the trash entries that *could* become empty —
    // after the restore we re-check each one and drop the entry if no
    // soft-deleted rows remain. Guarded on lmtCol since record trash requires
    // it; without LMT we can't key entries anyway.
    const entryTuples: Array<{ fkUserId: string | null; deletedAt: string }> =
      [];
    if (lmtCol) {
      const tupleQb = baseModel
        .dbDriver(baseModel.tnPath)
        .where(deletedColumn.column_name, true)
        .distinct(lmtCol.column_name)
        .select(lmtCol.column_name);
      if (lmbCol) {
        tupleQb.distinct(lmbCol.column_name).select(lmbCol.column_name);
      }
      whereInPks(tupleQb, primaryKeys, rowIdsPath);
      const tuples = await tupleQb;
      for (const t of tuples) {
        const lmtVal = t[lmtCol.column_name];
        if (lmtVal == null) continue;
        const deletedAt =
          lmtVal instanceof Date
            ? lmtVal.toISOString()
            : new Date(lmtVal).toISOString();
        const fkUserId = lmbCol ? t[lmbCol.column_name] ?? null : null;
        entryTuples.push({ fkUserId, deletedAt });
      }
    }

    // Pre-flight pass
    const allConflicts: RestoreConflict[] = [];
    {
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        null,
        rowIdsPath,
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batchIds = await nextBatch();
        if (!batchIds.length) break;
        const conflicts = await this._detectRestoreConflicts(
          context,
          model,
          baseModel,
          deletedColumn,
          batchIds,
          primaryKeys,
        );
        if (conflicts.length) allConflicts.push(...conflicts);
      }
    }

    if (allConflicts.length && !param.force && !param.partial) {
      const counts = allConflicts.reduce(
        (acc, c) => ((acc[c.kind] = (acc[c.kind] ?? 0) + 1), acc),
        {} as Record<string, number>,
      );
      const summary = Object.entries(counts)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      NcError.get(context).recordRestoreConflict(summary, {
        details: { conflicts: allConflicts, counts },
      });
    }

    const conflictsByRowId = new Map<string, RestoreConflict[]>();
    for (const c of allConflicts) {
      const list = conflictsByRowId.get(c.rowId) ?? [];
      list.push(c);
      conflictsByRowId.set(c.rowId, list);
    }

    let totalRestored = 0;
    const skipped: Array<{ rowId: string; conflicts: RestoreConflict[] }> = [];
    const cleared: Array<{ rowId: string; columns: string[] }> = [];
    {
      const nextBatch = makeTrashBatchIterator(
        baseModel,
        model,
        deletedColumn,
        null,
        rowIdsPath,
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let batchIds = await nextBatch();
        if (!batchIds.length) break;

        if (param.partial) {
          const next: string[] = [];
          for (const id of batchIds) {
            const rowConflicts = conflictsByRowId.get(id);
            if (rowConflicts?.length) {
              skipped.push({ rowId: id, conflicts: rowConflicts });
            } else {
              next.push(id);
            }
          }
          batchIds = next;
          if (!batchIds.length) continue;
        }

        const batchConflicts: RestoreConflict[] = [];
        if (param.force) {
          for (const id of batchIds) {
            const rowConflicts = conflictsByRowId.get(id);
            if (rowConflicts?.length) batchConflicts.push(...rowConflicts);
          }
        }
        const resolutions = this._buildResolutions(batchConflicts);

        for (const [rowId, resolution] of resolutions) {
          if (resolution.nullColumns.size) {
            cleared.push({
              rowId,
              columns: Array.from(resolution.nullColumns),
            });
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
          resolutions,
          attachmentColumns,
          req: param.req,
          tableId: param.tableId,
        });

        totalRestored += batchIds.length;
      }
    }

    // Drop trash entries whose underlying rows are all gone now. One
    // grouped count + one bulk delete instead of N per-tuple round trips.
    // Wrapped fail-open — metadata-cleanup failure shouldn't tank the
    // restore response.
    if (totalRestored > 0 && lmtCol && entryTuples.length) {
      try {
        // Pre-filter on the lmt list (cheap index probe) and group on
        // (lmt, lmb) — gives us the surviving counts per tuple in one
        // query. Tuples missing from the result have count 0.
        const lmts = [...new Set(entryTuples.map((t) => t.deletedAt))];
        const groupQb = baseModel
          .dbDriver(baseModel.tnPath)
          .where(deletedColumn.column_name, true)
          .whereIn(lmtCol.column_name, lmts)
          .select(lmtCol.column_name)
          .count('* as count')
          .groupBy(lmtCol.column_name);
        if (lmbCol) {
          groupQb.select(lmbCol.column_name).groupBy(lmbCol.column_name);
        }
        const groupRows = await groupQb;

        const tupleKey = (lmt: string, lmb: string | null) =>
          `${lmt}|${lmb ?? ''}`;
        const remaining = new Map<string, number>();
        for (const r of groupRows) {
          const lmtVal = r[lmtCol.column_name];
          const lmt =
            lmtVal instanceof Date
              ? lmtVal.toISOString()
              : new Date(lmtVal).toISOString();
          const lmb = lmbCol ? r[lmbCol.column_name] ?? null : null;
          remaining.set(tupleKey(lmt, lmb), Number(r.count));
        }

        const emptyResourceIds: string[] = [];
        for (const t of entryTuples) {
          if ((remaining.get(tupleKey(t.deletedAt, t.fkUserId)) ?? 0) > 0) {
            continue;
          }
          emptyResourceIds.push(
            buildRecordResourceId(param.tableId, t.fkUserId, t.deletedAt),
          );
        }

        if (emptyResourceIds.length) {
          await BaseTrash.deleteByResourceIds(
            context,
            'record',
            emptyResourceIds,
          );
        }
      } catch (e) {
        this.logger.error(
          `Failed to drop empty trash entries for ${param.tableId}: ${e?.message}`,
          e?.stack,
        );
      }
    }

    return {
      restored: totalRestored,
      skipped,
      cleared,
      message: `${totalRestored} record(s) restored`,
    };
  }

  /**
   * Hard-delete the soft-deleted rows that share this entry's identity.
   * Goes through `baseModel.permanentDeleteByIds` so MM/HM links and
   * file references are cleaned up, audit fires, and webhooks run.
   *
   * Returns `keepEntry: true` if any matching rows remain (RLS-bounded
   * user pass, or concurrent restore left some).
   */
  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void> {
    const parsed = parseRecordResourceId(trashEntry.resource_id);
    if (!parsed) {
      this.logger.warn(
        `Skipping record permanentDelete — unparseable resource_id: ${trashEntry.resource_id}`,
      );
      return;
    }

    const model = await Model.get(ctx, parsed.tableId, false, ncMeta);
    if (!model) {
      return;
    }

    await model.getColumns(ctx, ncMeta);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    if (!deletedColumn) NcError.get(ctx).tableTrashNotSupported(model.title);

    const source = await Source.get(ctx, model.source_id, false, ncMeta);
    if (!source || !source.isMeta()) {
      NcError.get(ctx).tableTrashNotSupported(model.title);
    }

    const baseModel = await Model.getBaseModelSQL(ctx, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const decoded = {
      fkUserId: parsed.fkUserId,
      deletedAt: parsed.deletedAt,
    };

    const nextBatch = makeTrashBatchIterator(
      baseModel,
      model,
      deletedColumn,
      decoded,
      [],
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchIds = await nextBatch();
      if (!batchIds.length) break;

      await baseModel.permanentDeleteByIds(batchIds, param.req, true);

      this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
        context: ctx,
        req: param.req,
        tableId: parsed.tableId,
        rowIds: batchIds,
      });
    }

    const remaining = await this.countRemaining(ctx, parsed, ncMeta);
    return remaining > 0 ? { keepEntry: true } : undefined;
  }

  /**
   * Count soft-deleted rows still matching this entry's (LMB, LMT) tuple.
   * Used by restore + permanentDelete to decide whether the BaseTrash row
   * should survive. RLS NOT applied — this is a system-level emptiness
   * check, not a user-visibility check.
   */
  private async countRemaining(
    ctx: NcContext,
    parsed: NonNullable<ReturnType<typeof parseRecordResourceId>>,
    ncMeta?: MetaService,
  ): Promise<number> {
    const table = await Model.get(ctx, parsed.tableId, true, ncMeta);
    if (!table) return 0;
    await table.getColumns(ctx, ncMeta);

    const deletedColumn = table.columns.find((c) => isDeletedCol(c));
    const lmtCol = table.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );
    const lmbCol = table.columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );
    if (!deletedColumn || !lmtCol) return 0;

    const source = await Source.get(ctx, table.source_id, false, ncMeta);
    if (!source || !source.isMeta()) return 0;

    const baseModel = await Model.getBaseModelSQL(ctx, {
      model: table,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const qb = baseModel
      .dbDriver(baseModel.tnPath)
      .where(deletedColumn.column_name, true)
      .where(lmtCol.column_name, parsed.deletedAt.toISOString())
      .count('* as count');

    if (lmbCol) {
      if (parsed.fkUserId) qb.where(lmbCol.column_name, parsed.fkUserId);
      else qb.whereNull(lmbCol.column_name);
    }

    const row = await qb.first();
    return Number(row?.count ?? 0);
  }

  // ── Conflict detection ────────────────────────────────────

  /**
   * Unified pre-flight: validation + unique + V1 OO link detection folded
   * into ONE SELECT against the base table, plus 1 SELECT per V2 junction
   * column (unavoidable — cross-table).
   *
   * The base SELECT grabs PK / validator / unique / V1-FK columns for each
   * trash row, plus:
   *   - `__v1_<colId>`   → EXISTS(...) boolean, one per V1 OO col
   *   - `__uniq_<colId>` → scalar subquery returning the conflicting active
   *                        PK (or NULL), one per unique col
   * Validators + intra-batch unique grouping run in JS over the result.
   */
  private async _detectRestoreConflicts(
    context: NcContext,
    model: Awaited<ReturnType<typeof Model.get>>,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    deletedColumn: (typeof model.columns)[number],
    batchIds: string[],
    primaryKeys: Column[],
  ): Promise<RestoreConflict[]> {
    const conflicts: RestoreConflict[] = [];
    if (!batchIds.length) return conflicts;

    const validatedCols = model.columns.filter(
      (c) => c?.meta?.validate && c?.validate,
    );
    const uniqueCols = model.columns.filter(
      (c) => c.unique && !c.pk && !c.system && c.column_name,
    );
    const v1OoChildCols: Array<{
      col: (typeof model.columns)[number];
      fkColumnName: string;
    }> = [];
    const v2JunctionCols: Array<{
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
          v2JunctionCols.push({ col, colOpts });
        }
        continue;
      }
      if (colOpts.type !== 'oo' || !col.meta?.bt) continue;
      const fkChildCol = await Column.get(context, {
        colId: colOpts.fk_child_column_id,
      });
      const fkChildTable = await fkChildCol.getModel(context);
      if (fkChildTable.id !== model.id) continue;
      v1OoChildCols.push({ col, fkColumnName: fkChildCol.column_name });
    }

    const pkColName = primaryKeys[0]?.column_name;
    const tnPath = baseModel.tnPath;
    const delCol = deletedColumn.column_name;
    const needsBaseFetch = !!(
      validatedCols.length ||
      uniqueCols.length ||
      v1OoChildCols.length
    );

    let rows: Array<Record<string, any>> = [];
    if (needsBaseFetch) {
      const rawCols = Array.from(
        new Set([
          ...primaryKeys.map((c) => c.column_name),
          ...validatedCols.map((c) => c.column_name),
          ...uniqueCols.map((c) => c.column_name),
          ...v1OoChildCols.map((v) => v.fkColumnName),
        ]),
      );

      const selectItems: any[] = rawCols.map((c) =>
        baseModel.dbDriver.raw('??.??', ['t1', c]),
      );

      for (const { col, fkColumnName } of v1OoChildCols) {
        selectItems.push(
          baseModel.dbDriver.raw(
            'EXISTS (SELECT 1 FROM ?? AS t2 WHERE t2.?? = t1.?? AND t2.?? != t1.?? AND (t2.?? IS NULL OR t2.?? = false)) AS ??',
            [
              tnPath,
              fkColumnName,
              fkColumnName,
              pkColName,
              pkColName,
              delCol,
              delCol,
              `__v1_${col.id}`,
            ],
          ),
        );
      }

      for (const col of uniqueCols) {
        selectItems.push(
          baseModel.dbDriver.raw(
            '(SELECT t2.?? FROM ?? AS t2 WHERE t2.?? = t1.?? AND t2.?? != t1.?? AND (t2.?? IS NULL OR t2.?? = false) LIMIT 1) AS ??',
            [
              pkColName,
              tnPath,
              col.column_name,
              col.column_name,
              pkColName,
              pkColName,
              delCol,
              delCol,
              `__uniq_${col.id}`,
            ],
          ),
        );
      }

      const qb = baseModel.dbDriver
        .from(baseModel.dbDriver.raw('?? AS t1', [tnPath]))
        .where(`t1.${delCol}`, true)
        .whereIn(`t1.${pkColName}`, batchIds)
        .select(selectItems);

      rows = await baseModel.execAndParse(qb, null, { raw: true });
    }

    // Validation (in-memory)
    if (validatedCols.length && rows.length) {
      for (const row of rows) {
        const rowId = String(getCompositePkValue(primaryKeys, row));
        for (const col of validatedCols) {
          const value = row[col.column_name];
          try {
            await validateFuncOnColumn({
              value,
              column: col,
              apiVersion: context.api_version,
            });
          } catch (e: any) {
            conflicts.push({
              kind: 'validation',
              rowId,
              columnId: col.id,
              columnTitle: col.title,
              columnName: col.column_name,
              value,
              message:
                e?.message || 'value does not match current validation rule',
            });
          }
        }
      }
    }

    // Unique: active via subquery; intra-batch via grouping
    if (uniqueCols.length && rows.length) {
      for (const col of uniqueCols) {
        const subqKey = `__uniq_${col.id}`;
        const unclaimedGroups = new Map<unknown, string[]>();

        for (const row of rows) {
          const v = row[col.column_name];
          if (v === null || v === undefined || v === '') continue;
          const rid = String(getCompositePkValue(primaryKeys, row));
          const activeClaimant =
            row[subqKey] != null ? String(row[subqKey]) : null;

          if (activeClaimant) {
            conflicts.push({
              kind: 'unique-active',
              rowId: rid,
              columnId: col.id,
              columnTitle: col.title,
              columnName: col.column_name,
              value: v,
              conflictingRowId: activeClaimant,
            });
          } else {
            const list = unclaimedGroups.get(v) ?? [];
            list.push(rid);
            unclaimedGroups.set(v, list);
          }
        }

        for (const [value, rowIds] of unclaimedGroups) {
          if (rowIds.length <= 1) continue;
          const sorted = [...rowIds].sort();
          const winner = sorted[0];
          for (let i = 1; i < sorted.length; i++) {
            conflicts.push({
              kind: 'unique-intra',
              rowId: sorted[i],
              columnId: col.id,
              columnTitle: col.title,
              columnName: col.column_name,
              value,
              winnerRowId: winner,
            });
          }
        }
      }
    }

    // V1 OO links from EXISTS column
    if (v1OoChildCols.length && rows.length) {
      for (const { col, fkColumnName } of v1OoChildCols) {
        const key = `__v1_${col.id}`;
        for (const row of rows) {
          if (row[fkColumnName] == null) continue;
          if (!row[key]) continue;
          conflicts.push({
            kind: 'link-v1',
            rowId: String(getCompositePkValue(primaryKeys, row)),
            columnId: col.id,
            columnTitle: col.title,
            fkColumnName,
          });
        }
      }
    }

    // V2 junctions: one query per junction column
    await this._detectV2JunctionConflicts(
      context,
      baseModel,
      deletedColumn,
      batchIds,
      primaryKeys,
      v2JunctionCols,
      conflicts,
    );

    return conflicts;
  }

  private async _detectV2JunctionConflicts(
    context: NcContext,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    deletedColumn: Column,
    batchIds: string[],
    primaryKeys: Column[],
    v2JunctionCols: Array<{ col: Column; colOpts: LinkToAnotherRecordColumn }>,
    conflicts: RestoreConflict[],
  ): Promise<void> {
    if (!v2JunctionCols.length) return;

    for (const { col, colOpts } of v2JunctionCols) {
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

      const conflictRows = await baseModel.dbDriver
        .from(baseModel.dbDriver.raw('?? as ??', [mmTnPath, 'j1']))
        .whereIn(`j1.${childColName}`, batchIds)
        .whereExists(function () {
          this.select(baseModel.dbDriver.raw('1'))
            .from(baseModel.dbDriver.raw('?? as ??', [mmTnPath, 'j2']))
            .join(
              baseModel.dbDriver.raw('?? as ??', [mainTnPath, 'm']),
              `m.${pkColName}`,
              `j2.${childColName}`,
            )
            .whereRaw('?? = ??', [`j2.${parentColName}`, `j1.${parentColName}`])
            .whereRaw('?? != ??', [`j2.${childColName}`, `j1.${childColName}`])
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
          kind: 'link-v2',
          rowId: String(row.row_id),
          columnId: col.id,
          columnTitle: col.title,
          anchorPk: row.conflict_anchor_pk,
        });
      }
    }
  }

  /**
   * Build per-row resolution plans from a flat conflict list. Every conflict
   * kind maps to either a column-null directive or a junction-row delete.
   */
  private _buildResolutions(
    conflicts: RestoreConflict[],
  ): Map<string, RowResolution> {
    const map = new Map<string, RowResolution>();
    const ensure = (rowId: string) => {
      let r = map.get(rowId);
      if (!r) {
        r = { nullColumns: new Set(), junctionDeletes: [] };
        map.set(rowId, r);
      }
      return r;
    };

    for (const c of conflicts) {
      switch (c.kind) {
        case 'link-v1':
          ensure(c.rowId).nullColumns.add(c.fkColumnName);
          break;
        case 'link-v2':
          ensure(c.rowId).junctionDeletes.push({
            colId: c.columnId,
            anchorPk: c.anchorPk,
          });
          break;
        case 'validation':
        case 'unique-active':
        case 'unique-intra':
          ensure(c.rowId).nullColumns.add(c.columnName);
          break;
      }
    }
    return map;
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
    resolutions: Map<string, RowResolution>;
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
      resolutions,
      attachmentColumns,
      req,
      tableId,
    } = opts;

    // V2 junction conflict resolution — delete the restored record's own
    // junction row so the active rival's link is the one that stands.
    for (const rowId of batchIds) {
      const resolution = resolutions.get(rowId);
      if (!resolution?.junctionDeletes.length) continue;

      for (const item of resolution.junctionDeletes) {
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

    const preRestoreRows = await baseModel.chunkList({
      pks: batchIds,
      deletedOnly: true,
    });

    if (!preRestoreRows.length) return;

    try {
      const dirtyIds = batchIds.filter((id) => {
        const r = resolutions.get(id);
        return r && r.nullColumns.size > 0;
      });

      if (dirtyIds.length) {
        const cleanIds = batchIds.filter((id) => !dirtyIds.includes(id));
        if (cleanIds.length) {
          await whereInPks(
            baseModel.dbDriver(baseModel.tnPath),
            primaryKeys,
            cleanIds,
          )
            .where(deletedColumn.column_name, true)
            .update(restorePayload);
        }

        for (const id of dirtyIds) {
          const nullCols = resolutions.get(id)!.nullColumns;
          const update: Record<string, any> = { ...restorePayload };
          for (const col of nullCols) update[col] = null;

          await baseModel
            .dbDriver(baseModel.tnPath)
            .where(_wherePk(primaryKeys, id, true))
            .where(deletedColumn.column_name, true)
            .update(update);
        }
      } else {
        await whereInPks(
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
