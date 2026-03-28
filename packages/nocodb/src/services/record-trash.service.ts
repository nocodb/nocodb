import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  LinksVersion,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { LinkToAnotherRecordColumn } from '~/models';
import { Column, FileReference, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { _wherePk, getCompositePkValue } from '~/helpers/dbHelpers';
import conditionV2 from '~/db/conditionV2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

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

@Injectable()
export class RecordTrashService {
  private readonly logger = new Logger(RecordTrashService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  async getDeletedRecords(
    context: NcContext,
    param: {
      tableId: string;
      query: {
        limit?: string | number;
        offset?: string | number;
      };
      req: NcRequest;
    },
  ) {
    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) {
      return new PagedResponseImpl([], { count: 0 });
    }

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      return new PagedResponseImpl([], { count: 0 });
    }

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const limit = Math.min(+(param.query.limit ?? 25), 100);
    const offset = +(param.query.offset ?? 0);

    const lastModifiedTimeCol = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime,
    );

    // Build fieldsSet: exclude the __nc_deleted column itself, include everything else
    // list() + selectObject handles proper field aliasing, User column resolution, etc.
    const fieldsSet = new Set(
      model.columns.filter((c) => !isDeletedCol(c)).map((c) => c.title),
    );

    // Sort by LastModifiedTime desc (most recently deleted first)
    const sortCol = lastModifiedTimeCol;

    // Count trashed records — apply RLS so the count matches what list() returns
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

    const count = +((await countQb.first())?.count ?? 0);

    const rows = await baseModel.list(
      {
        limit,
        offset,
        fieldsSet,
        ...(sortCol ? { sort: `-${sortCol.title}` } : {}),
      },
      {
        ignoreViewFilterAndSort: true,
        deletedOnly: true,
      },
    );

    // Resolve retention days
    const retentionDays = await this.resolveRetentionDays(context);

    return {
      list: rows,
      retentionDays,
      pageInfo: {
        totalRows: count,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        isFirstPage: offset === 0,
        isLastPage: offset + limit >= count,
      },
    };
  }

  async restoreRecords(
    context: NcContext,
    param: {
      tableId: string;
      rowIds: string[];
      req: NcRequest;
      /** If true, restore the record even when OO link conflicts exist — conflicting FKs are nulled */
      force?: boolean;
    },
  ) {
    // Build V1 conflict map: rowId → FK columns to null
    const conflictMap = new Map<string, string[]>();
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

    await this.checkRestoreLimits(context, param.rowIds.length);

    // ── OO conflict detection ─────────────────────────────────────────────────
    // When a record is soft-deleted its FK value is preserved. If another record
    // has since claimed the same OO slot, restoring would violate the constraint.
    // Default: block with an error. force=true: restore without the conflicting link.

    const ooConflicts = await this._detectOOConflicts(
      context,
      model,
      baseModel,
      deletedColumn,
      param.rowIds,
    );

    if (ooConflicts.length && !param.force) {
      const details = ooConflicts
        .map(
          (c) =>
            `row ${c.rowId}: column "${c.columnTitle}" conflicts with active record`,
        )
        .join('; ');
      NcError.get(context).recordRestoreConflict(details);
    }

    const primaryKeys = model.primaryKeys;
    const BATCH_SIZE = 100;

    // ── Handle OO force-restore conflicts (pre-restore cleanup) ──────────────
    if (ooConflicts.length && param.force) {
      const v1Conflicts = ooConflicts.filter(
        (c) => !c.fkColumnName.startsWith('__nc_v2_jn_'),
      );
      const v2Conflicts = ooConflicts.filter((c) =>
        c.fkColumnName.startsWith('__nc_v2_jn_'),
      );

      // Handle V2 junction conflicts: delete only the conflicting junction row
      for (const v2c of v2Conflicts) {
        const colId = v2c.fkColumnName.replace('__nc_v2_jn_', '');
        const col = model.columns.find((c) => c.id === colId);
        if (!col) continue;

        const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
        const { mmContext } = await colOpts.getParentChildContext(context);
        const mmModel = await colOpts.getMMModel(mmContext);
        const mmChildCol = await colOpts.getMMChildColumn(mmContext);
        const mmParentCol = await colOpts.getMMParentColumn(mmContext);

        if (
          mmModel &&
          mmChildCol &&
          mmParentCol &&
          v2c.conflictParentPk != null
        ) {
          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            id: mmModel.id,
            dbDriver: baseModel.dbDriver,
          });
          await baseModel
            .dbDriver(assocBaseModel.getTnPath(mmModel))
            .where(mmChildCol.column_name, v2c.rowId)
            .where(mmParentCol.column_name, v2c.conflictParentPk)
            .del();
        }
      }
      for (const c of v1Conflicts) {
        const key = String(c.rowId);
        const cols = conflictMap.get(key) ?? [];
        cols.push(c.fkColumnName);
        conflictMap.set(key, cols);
      }
    }

    // ── Batch restore ────────────────────────────────────────────────────────
    const allPreRestoreRows = [];

    for (let i = 0; i < param.rowIds.length; i += BATCH_SIZE) {
      const batchIds = param.rowIds.slice(i, i + BATCH_SIZE);

      // Fetch records before restoring — needed for audit log
      const preRestoreRows = await baseModel.execAndParse(
        _whereInPks(baseModel.dbDriver(baseModel.tnPath), primaryKeys, batchIds)
          .where(deletedColumn.column_name, true)
          .select(
            model.columns
              .filter((c) => c.column_name)
              .map((c) => c.column_name),
          ),
        model.columns,
        { raw: true },
      );

      allPreRestoreRows.push(...preRestoreRows);

      // Restore: set __nc_deleted = false (with V1 OO conflict FK nulling if needed)
      if (conflictMap?.size) {
        const cleanIds = batchIds.filter((id) => !conflictMap.has(id));
        if (cleanIds.length) {
          await _whereInPks(
            baseModel.dbDriver(baseModel.tnPath),
            primaryKeys,
            cleanIds,
          )
            .where(deletedColumn.column_name, true)
            .update({ [deletedColumn.column_name]: false });
        }

        for (const id of batchIds) {
          const fkCols = conflictMap.get(id);
          if (!fkCols) continue;

          const update: Record<string, any> = {
            [deletedColumn.column_name]: false,
          };
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
          .update({ [deletedColumn.column_name]: false });
      }

      // Restore soft-deleted file references
      for (const rowId of batchIds) {
        await FileReference.bulkSoftRestore(context, {
          fk_model_id: model.id,
          fk_doc_id: String(rowId),
        });
      }

      // LMT + broadcast on linked records
      await baseModel.updateLinkedRecordsOnDelete(batchIds, param.req);

      // Audit + realtime for this batch
      await baseModel.afterBulkRestore(preRestoreRows, param.req);
    }

    // ── Post-restore: trash_cleanup_due_at, webhooks, events ─────────────────
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

    // Fire webhook once for all restored records
    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: { ...context, cache: false, cacheMap: undefined },
      hookName: 'after.bulkInsert',
      prevData: null,
      newData: allPreRestoreRows,
      user: param.req?.user,
      viewId: null,
      modelId: model.id,
      tnPath: baseModel.tnPath,
    });

    this.appHooksService.emit(AppEvents.RECORDS_RESTORE, {
      context,
      req: param.req,
      tableId: param.tableId,
      rowIds: param.rowIds,
    });

    return { message: `${param.rowIds.length} record(s) restored` };
  }

  async permanentDeleteRecords(
    context: NcContext,
    param: {
      tableId: string;
      rowIds: string[];
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

    // Verify all specified rows are actually trashed before allowing permanent delete.
    // Without this check, a caller could permanently delete active (non-trashed) records.
    if (deletedColumn && param.rowIds.length) {
      const primaryKeys = model.primaryKeys;
      const pkColNames = primaryKeys.map((pk) => pk.column_name);
      const rows = await _whereInPks(
        baseModel.dbDriver(baseModel.tnPath),
        primaryKeys,
        param.rowIds,
      ).select([...pkColNames, deletedColumn.column_name]);

      const activeRows = rows.filter((r) => !r[deletedColumn.column_name]);

      if (activeRows.length > 0) {
        NcError.get(context).recordNotTrashed();
      }
    }

    // Use the proper delete pipeline so MM/HM links and file references are cleaned up
    await baseModel.permanentDeleteByIds(param.rowIds, param.req);

    this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
      context,
      req: param.req,
      tableId: param.tableId,
      rowIds: param.rowIds,
    });

    return { message: `${param.rowIds.length} record(s) permanently deleted` };
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

    // Paginated permanent delete of all trashed records
    const primaryKeys = model.primaryKeys;
    const pkColNames = primaryKeys.map((pk) => pk.column_name);
    const batchSize = 100;
    let totalDeleted = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await baseModel.execAndParse(
        baseModel
          .dbDriver(baseModel.tnPath)
          .select(pkColNames)
          .where(deletedColumn.column_name, true)
          .limit(batchSize),
        null,
        { raw: true },
      );

      if (!rows.length) break;

      const ids = rows.map((r) => getCompositePkValue(primaryKeys, r));
      await baseModel.permanentDeleteByIds(ids, param.req);
      totalDeleted += ids.length;
    }

    // All trashed records are gone — reset trash_cleanup_due_at
    await Model.updateTrashCleanupDueAt(context, model.id, null);

    this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
      context,
      req: param.req,
      tableId: param.tableId,
      rowIds: [],
    });

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

    const retentionDays = await this.resolveRetentionDays(context);

    return { count: +(result?.count ?? 0), retentionDays };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Resolve trash retention period in days. EE overrides with plan-based limits. */
  protected async resolveRetentionDays(_context: NcContext): Promise<number> {
    return parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
  }

  /** Check workspace limits before restore. EE overrides with plan-based checks. */
  protected async checkRestoreLimits(
    _context: NcContext,
    _count: number,
  ): Promise<void> {
    // No-op in CE — no plan limits
  }

  /**
   * Detect one-to-one link conflicts for records about to be restored.
   *
   * A conflict occurs when:
   *   - The restored record holds an OO FK pointing at record B, AND
   *   - Another non-deleted record already holds the same FK (has taken the OO slot).
   *
   * Handles both V1 links (direct FK on child table) and V2 links (junction table).
   *
   * Returns one entry per (rowId, column) pair that conflicts.
   */
  private async _detectOOConflicts(
    context: NcContext,
    model: Awaited<ReturnType<typeof Model.get>>,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    deletedColumn: (typeof model.columns)[number],
    rowIds: string[],
  ) {
    const conflicts: Array<{
      rowId: string;
      columnTitle: string;
      fkColumnName: string;
      /** For V2 junction conflicts: the parent PK value that is conflicting */
      conflictParentPk?: unknown;
    }> = [];

    if (!rowIds.length) return conflicts;

    // ── V1 OO child columns (direct FK on this table) ──────────────────────
    const ooV1ChildCols: Array<{
      col: (typeof model.columns)[number];
      fkChildCol: Awaited<ReturnType<typeof Column.get>>;
    }> = [];

    // ── V2 OO columns (junction-table based) ────────────────────────────────
    const ooV2Cols: Array<{
      col: (typeof model.columns)[number];
      colOpts: LinkToAnotherRecordColumn;
    }> = [];

    for (const col of model.columns) {
      if (!isLinksOrLTAR(col)) continue;

      const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );
      if (colOpts.type !== 'oo') continue;

      if (isMMOrMMLike(col) && colOpts.version === LinksVersion.V2) {
        // V2 OO link — uses junction table
        ooV2Cols.push({ col, colOpts });
      } else {
        // V1 OO link — direct FK on child table
        // Child side = the table that holds the FK (meta.bt = true on the column)
        if (!col.meta?.bt) continue;

        const fkChildCol = await Column.get(context, {
          colId: colOpts.fk_child_column_id,
        });
        const fkChildTable = await fkChildCol.getModel(context);

        // Only care when the FK lives on this table
        if (fkChildTable.id !== model.id) continue;

        ooV1ChildCols.push({ col, fkChildCol });
      }
    }

    // ── V1 conflict detection (direct FK) ───────────────────────────────────
    if (ooV1ChildCols.length) {
      const primaryKeys = model.primaryKeys;
      const pkColNames = primaryKeys.map((pk) => pk.column_name);
      const fkColNames = ooV1ChildCols.map((o) => o.fkChildCol.column_name);

      // Load the soft-deleted rows to get their FK values
      const rows = await _whereInPks(
        baseModel.dbDriver(baseModel.tnPath),
        primaryKeys,
        rowIds,
      )
        .where(deletedColumn.column_name, true)
        .select([...pkColNames, ...fkColNames]);

      for (const row of rows) {
        const rowPkValue = getCompositePkValue(primaryKeys, row);

        for (const { col, fkChildCol } of ooV1ChildCols) {
          const fkValue = row[fkChildCol.column_name];
          if (fkValue == null) continue;

          // Check if another active (non-deleted) record has already claimed this FK
          const existingQb = baseModel
            .dbDriver(baseModel.tnPath)
            .where(fkChildCol.column_name, fkValue)
            .where(function () {
              this.whereNull(deletedColumn.column_name).orWhere(
                deletedColumn.column_name,
                false,
              );
            });

          // Exclude the current row
          if (primaryKeys.length === 1) {
            existingQb.whereNot(
              primaryKeys[0].column_name,
              row[primaryKeys[0].column_name],
            );
          } else {
            existingQb.whereNot(function () {
              for (const pk of primaryKeys) {
                this.where(pk.column_name, row[pk.column_name]);
              }
            });
          }

          const existing = await existingQb.count('* as count').first();

          if (+(existing?.count ?? 0) > 0) {
            conflicts.push({
              rowId: rowPkValue,
              columnTitle: col.title,
              fkColumnName: fkChildCol.column_name,
            });
          }
        }
      }
    }

    // ── V2 conflict detection (junction table) ──────────────────────────────
    // V2 OO links use a junction (MM) table. A conflict exists when:
    //   - The junction table has a row linking the restored record to a parent, AND
    //   - Another active (non-deleted) record also links to the same parent via the junction.
    if (ooV2Cols.length) {
      const primaryKeys = model.primaryKeys;

      for (const { col, colOpts } of ooV2Cols) {
        const { mmContext } = await colOpts.getParentChildContext(context);
        const mmModel = await colOpts.getMMModel(mmContext);
        const mmChildCol = await colOpts.getMMChildColumn(mmContext);
        const mmParentCol = await colOpts.getMMParentColumn(mmContext);

        if (!mmModel || !mmChildCol || !mmParentCol) {
          this.logger.warn(
            `V2 OO conflict detection: could not resolve junction table for column "${col.title}" — skipping`,
          );
          continue;
        }

        const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
          id: mmModel.id,
          dbDriver: baseModel.dbDriver,
        });
        const mmTnPath = assocBaseModel.getTnPath(mmModel);

        // For each row being restored, find its linked parent PKs from the junction table
        for (const rowId of rowIds) {
          const junctionRows = await baseModel
            .dbDriver(mmTnPath)
            .where(mmChildCol.column_name, rowId)
            .select(mmParentCol.column_name);

          for (const jRow of junctionRows) {
            const parentPk = jRow[mmParentCol.column_name];
            if (parentPk == null) continue;

            // Check if another active record already links to the same parent (OO = only one allowed)
            const existingLink = await baseModel
              .dbDriver(mmTnPath)
              .where(mmParentCol.column_name, parentPk)
              .whereNot(mmChildCol.column_name, rowId)
              .count('* as count')
              .first();

            if (+(existingLink?.count ?? 0) > 0) {
              // Verify the other record linking here is actually active (non-deleted)
              const otherChildRows = await baseModel
                .dbDriver(mmTnPath)
                .where(mmParentCol.column_name, parentPk)
                .whereNot(mmChildCol.column_name, rowId)
                .select(mmChildCol.column_name);

              const otherChildIds = otherChildRows.map(
                (r) => r[mmChildCol.column_name],
              );

              if (otherChildIds.length) {
                const activeCount = await _whereInPks(
                  baseModel.dbDriver(baseModel.tnPath),
                  primaryKeys,
                  otherChildIds,
                )
                  .where(function () {
                    this.whereNull(deletedColumn.column_name).orWhere(
                      deletedColumn.column_name,
                      false,
                    );
                  })
                  .count('* as count')
                  .first();

                if (+(activeCount?.count ?? 0) > 0) {
                  conflicts.push({
                    rowId,
                    columnTitle: col.title,
                    // For V2 links there is no direct FK column on the table;
                    // use a synthetic name so force-restore can identify the column.
                    fkColumnName: `__nc_v2_jn_${col.id}`,
                    conflictParentPk: parentPk,
                  });
                }
              }
            }
          }
        }
      }
    }

    return conflicts;
  }
}
