import { Logger } from '@nestjs/common';
import {
  AuditV1OperationTypes,
  extractFilterFromXwhere,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcRequest } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import {
  _wherePk,
  getCompositePkValue,
  shouldCascadeLinkCleanup,
} from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import conditionV2 from '~/db/conditionV2';
import { Column, FileReference, Filter, Model } from '~/models';

export type ExecQueryType = (param: {
  trx: Knex.Transaction | CustomKnex;
  qb: any;
  ids: any[];
  rows: any[];
}) => any[];

export type MetaQueryType = (param: {
  qb: any;
  ids: any[];
  rows: any[];
}) => void | any;

// use class to support override
export class BaseModelDelete {
  constructor(protected readonly baseModel: IBaseModelSqlV2) {}
  logger = new Logger(BaseModelDelete.name);

  get isDbExternal() {
    return false;
  }

  async prepareBulkDeleteAll({
    args = {},
    cookie,
  }: {
    cookie: NcRequest;
    skip_hooks?: boolean;
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
      permanentDelete?: boolean;
    };
  }) {
    const columns = await this.baseModel.model.getColumns(
      this.baseModel.context,
    );
    const { where } = this.baseModel._getListArgs(args);
    const qb = this.baseModel.dbDriver(this.baseModel.tnPath);
    const aliasColObjMap = await this.baseModel.model.getAliasColObjMap(
      this.baseModel.context,
      columns,
    );

    // If skipPks provided then add it in qb
    if (args.skipPks) {
      qb.where((innerQb) => {
        args.skipPks.split(',').forEach((pk) => {
          innerQb.andWhereNot(_wherePk(this.baseModel.model.primaryKeys, pk));
        });
        return innerQb;
      });
    }

    const { filters: filterObj } = extractFilterFromXwhere(
      this.baseModel.context,
      where,
      aliasColObjMap,
      true,
    );

    // Resolve RLS conditions for bulkDeleteAll
    const rlsConditionsBDA = await this.baseModel.getRlsConditions();
    const rlsFilterGroupBDA = rlsConditionsBDA.length
      ? [new Filter({ children: rlsConditionsBDA, is_group: true })]
      : [];

    await conditionV2(
      this.baseModel,
      [
        ...rlsFilterGroupBDA,
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
        ...(args.viewId
          ? await Filter.rootFilterList(this.baseModel.context, {
              viewId: args.viewId,
            })
          : []),
      ],
      qb,
      undefined,
      true,
    );
    const execQueries: ExecQueryType[] = [];

    const metaQueries: MetaQueryType[] = [];
    const source = await this.baseModel.getSource();
    const isMeta = source.isMeta();

    const deletedColumn = columns.find((c) => isDeletedCol(c));
    const isSoftDelete =
      !args.permanentDelete &&
      !!deletedColumn &&
      isMeta &&
      (await this.baseModel.model.isTrashEnabledForWorkspace(
        this.baseModel.context,
      ));

    // Exclude already soft-deleted records from the delete query
    if (isSoftDelete) {
      qb.where(function () {
        this.whereNull(deletedColumn.column_name).orWhere(
          deletedColumn.column_name,
          false,
        );
      });
    }

    // Collect linked record info for LMT updates + realtime broadcasts
    const linkedRecordUpdates: {
      baseModel: any;
      model: any;
      column: any;
      getLinkedIds: (ids: any[]) => Promise<string[]>;
    }[] = [];

    for (const column of this.baseModel.model.columns) {
      // composite pk: cannot cascade via simple whereIn — skip all link handling
      if (this.baseModel.model.primaryKeys.length > 1) break;
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.baseModel.context,
      );

      const { refContext, mmContext, parentContext, childContext } =
        await colOptions.getParentChildContext(this.baseModel.context);

      // V1 BT: no FK cleanup (FK is on the deleted record itself),
      // but still collect parent IDs for LMT update
      if (colOptions.type === 'bt' && !isMMOrMMLike(column)) {
        const btChildColumn = await colOptions.getChildColumn(childContext);
        const btParentColumn = await colOptions.getParentColumn(parentContext);
        const btParentTable = await btParentColumn.getModel(parentContext);
        await btParentTable.getColumns(parentContext);
        const btParentBaseModel = await Model.getBaseModelSQL(parentContext, {
          model: btParentTable,
          dbDriver: this.baseModel.dbDriver,
        });

        linkedRecordUpdates.push({
          baseModel: btParentBaseModel,
          model: btParentTable,
          column,
          getLinkedIds: async (ids) => {
            const rows = await this.baseModel.execAndParse(
              this.baseModel
                .dbDriver(this.baseModel.tnPath)
                .select(btChildColumn.column_name)
                .whereIn(this.baseModel.model.primaryKey.column_name, ids)
                .whereNotNull(btChildColumn.column_name),
              null,
              { raw: true },
            );
            return [
              ...new Set(rows.map((r) => r[btChildColumn.column_name])),
            ] as string[];
          },
        });
        continue;
      }

      const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

      const shouldCascadeHere = await shouldCascadeLinkCleanup(
        this.baseModel.context,
        { isMeta: !!isMeta, relationType, colOptions, mmContext },
      );

      if (!shouldCascadeHere) continue;

      const childColumn = await colOptions.getChildColumn(childContext);
      const parentColumn = await colOptions.getParentColumn(parentContext);
      const parentTable = await parentColumn.getModel(parentContext);
      const childTable = await childColumn.getModel(childContext);
      await childTable.getColumns(childContext);
      await parentTable.getColumns(parentContext);

      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: childTable,
        dbDriver: this.baseModel.dbDriver,
      });

      const childTn = childBaseModel.getTnPath(childTable);

      switch (relationType) {
        case 'mm':
          {
            const vChildCol = await colOptions.getMMChildColumn(mmContext);
            const vParentCol = await colOptions.getMMParentColumn(mmContext);
            const vTable = await colOptions.getMMModel(mmContext);
            const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: vTable,
              dbDriver: this.baseModel.dbDriver,
            });
            const vTn = assocBaseModel.getTnPath(vTable);

            if (!isSoftDelete) {
              execQueries.push(({ trx, ids }) => [
                trx(vTn).whereIn(vChildCol.column_name, ids).delete(),
              ]);
            }

            // Collect linked parent IDs for LMT update via junction table
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentTable,
              dbDriver: this.baseModel.dbDriver,
            });
            linkedRecordUpdates.push({
              baseModel: parentBaseModel,
              model: parentTable,
              column,
              getLinkedIds: async (ids) => {
                const rows = await this.baseModel.execAndParse(
                  this.baseModel
                    .dbDriver(vTn)
                    .select(vParentCol.column_name)
                    .whereIn(vChildCol.column_name, ids),
                  null,
                  { raw: true },
                );
                return rows.map((r) => r[vParentCol.column_name]);
              },
            });
          }
          break;
        case 'hm':
          {
            // skip if it's an mm table column
            const relatedTable = await colOptions.getRelatedTable(refContext);
            if (relatedTable.mm) {
              break;
            }

            const childCol = await Column.get(childContext, {
              colId: colOptions.fk_child_column_id,
            });

            if (!isSoftDelete) {
              execQueries.push(({ trx, ids }) => {
                const query = trx(childTn)
                  .whereIn(childCol.column_name, ids)
                  .update({
                    [childCol.column_name]: null,
                  });
                return [query];
              });
            }

            // Collect linked child IDs for LMT update
            linkedRecordUpdates.push({
              baseModel: childBaseModel,
              model: childTable,
              column,
              getLinkedIds: async (ids) => {
                const rows = await this.baseModel.execAndParse(
                  this.baseModel
                    .dbDriver(childTn)
                    .select(childTable.primaryKey.column_name)
                    .whereIn(childCol.column_name, ids),
                  null,
                  { raw: true },
                );
                return rows.map((r) => r[childTable.primaryKey.column_name]);
              },
            });
          }
          break;
        case 'oo':
          {
            if (column.meta?.bt) {
              // BT-side: FK on the deleted record — no cleanup, but collect parent IDs for LMT
              const ooParentColumn = await colOptions.getParentColumn(
                parentContext,
              );
              const ooParentTable = await ooParentColumn.getModel(
                parentContext,
              );
              await ooParentTable.getColumns(parentContext);
              const ooParentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  model: ooParentTable,
                  dbDriver: this.baseModel.dbDriver,
                },
              );

              linkedRecordUpdates.push({
                baseModel: ooParentBaseModel,
                model: ooParentTable,
                column,
                getLinkedIds: async (ids) => {
                  const ooChildCol = await colOptions.getChildColumn(
                    childContext,
                  );
                  const rows = await this.baseModel.execAndParse(
                    this.baseModel
                      .dbDriver(this.baseModel.tnPath)
                      .select(ooChildCol.column_name)
                      .whereIn(this.baseModel.model.primaryKey.column_name, ids)
                      .whereNotNull(ooChildCol.column_name),
                    null,
                    { raw: true },
                  );
                  return [
                    ...new Set(rows.map((r) => r[ooChildCol.column_name])),
                  ] as string[];
                },
              });
              break;
            }
            // HM-side: same cleanup + LMT as HM
            const ooRelatedTable = await colOptions.getRelatedTable(refContext);
            if (ooRelatedTable.mm) {
              break;
            }

            const ooChildCol = await Column.get(childContext, {
              colId: colOptions.fk_child_column_id,
            });

            if (!isSoftDelete) {
              execQueries.push(({ trx, ids }) => {
                const query = trx(childTn)
                  .whereIn(ooChildCol.column_name, ids)
                  .update({ [ooChildCol.column_name]: null });
                return [query];
              });
            }

            linkedRecordUpdates.push({
              baseModel: childBaseModel,
              model: childTable,
              column,
              getLinkedIds: async (ids) => {
                const rows = await this.baseModel.execAndParse(
                  this.baseModel
                    .dbDriver(childTn)
                    .select(childTable.primaryKey.column_name)
                    .whereIn(ooChildCol.column_name, ids),
                  null,
                  { raw: true },
                );
                return rows.map((r) => r[childTable.primaryKey.column_name]);
              },
            });
          }
          break;
      }
    }

    // remove FileReferences for attachment fields
    const attachmentColumns = columns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    metaQueries.push(async ({ rows }) => {
      const fileReferenceIds: string[] = [];
      for (const row of rows) {
        for (const c of attachmentColumns) {
          if (row[c.column_name]) {
            try {
              let attachments;
              if (typeof row[c.column_name] === 'string') {
                attachments = JSON.parse(row[c.column_name]);
              }

              if (Array.isArray(attachments)) {
                for (const attachment of attachments) {
                  if (attachment.id) {
                    fileReferenceIds.push(attachment.id);
                  }
                }
              }
            } catch (e) {
              // ignore error
            }
          }
        }
      }
      if (isSoftDelete) {
        await FileReference.softDelete(
          this.baseModel.context,
          fileReferenceIds,
        );
      } else {
        await FileReference.delete(this.baseModel.context, fileReferenceIds);
      }
    });

    // Capture one timestamp for the whole bulkAll invocation so every chunk —
    // and every linked-record LMT propagation inside each chunk — stamps rows
    // with the same LastModifiedTime. Without this, each 100-row chunk plus
    // each per-link updateLastModified() call would get its own now(), and
    // grouping on (LastModifiedBy, LastModifiedTime) would split one logical
    // delete into many events in the trash UI.
    const operationNow = this.baseModel.now();

    // delete (or soft-delete) the rows in table
    execQueries.push(({ trx, qb, ids }) => {
      if (isSoftDelete) {
        // Soft-delete: mark rows as deleted instead of removing them
        // Also stamp LastModifiedTime/LastModifiedBy so the trash UI shows who deleted and when
        const softDeletePayload: Record<string, any> = {
          [deletedColumn.column_name]: true,
        };
        const lmtCol = columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );
        const lmbCol = columns.find(
          (c) => c.uidt === UITypes.LastModifiedBy && c.system,
        );
        if (lmtCol) softDeletePayload[lmtCol.column_name] = operationNow;
        if (lmbCol) softDeletePayload[lmbCol.column_name] = cookie?.user?.id;

        if (this.baseModel.model.primaryKeys.length === 1) {
          return [
            (this.isDbExternal ? qb : qb.transacting(trx))
              .whereIn(this.baseModel.model.primaryKey.column_name, ids)
              .update(softDeletePayload),
          ];
        } else {
          return ids.map((id) =>
            (this.isDbExternal ? qb : qb.transacting(trx))
              .where(_wherePk(this.baseModel.model.primaryKeys, id))
              .update(softDeletePayload),
          );
        }
      } else {
        if (this.baseModel.model.primaryKeys.length === 1) {
          return [
            (this.isDbExternal ? qb : qb.transacting(trx))
              .whereIn(this.baseModel.model.primaryKey.column_name, ids)
              .del(),
          ];
        } else {
          return ids.map((id) =>
            (this.isDbExternal ? qb : qb.transacting(trx))
              .where(_wherePk(this.baseModel.model.primaryKeys, id))
              .del(),
          );
        }
      }
    });
    return {
      metaQueries,
      // TODO: exec queries returned can be
      // modified to just a single object and not array
      // inside, it'll promise.all
      execQueries,
      linkedRecordUpdates,
      source,
      qb,
      attachmentColumns,
      filterObj,
      isSoftDelete,
      operationNow,
    };
  }

  async executeBulkAll({
    execQueries,
    metaQueries,
    ids,
    rows,
    qb,
  }: {
    execQueries: ExecQueryType[];
    metaQueries: MetaQueryType[];
    ids: any[];
    rows: any[];
    qb: any;
  }) {
    const response: any[] = [];

    const oldRecords = await this.baseModel.list(
      {
        pks: ids
          .map((id) =>
            getCompositePkValue(this.baseModel.model.primaryKeys, id),
          )
          .join(','),
      },
      {
        limitOverride: ids.length,
        ignoreViewFilterAndSort: true,
      },
    );
    const trx = await this.baseModel.dbDriver.transaction();
    try {
      for (const execQuery of execQueries) {
        await Promise.all(execQuery({ trx, qb: qb.clone(), ids, rows }));
      }
      await trx.commit();
      response.push(...oldRecords);
    } catch (ex) {
      await trx.rollback();
      // silent error, may be improved to log into response
      this.logger.error(ex.message);
    }
    for (const metaQuery of metaQueries) {
      await metaQuery({ qb: qb.clone(), ids, rows });
    }
    return response;
  }

  async bulkAll(params: {
    cookie: NcRequest;
    skip_hooks?: boolean;
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
      permanentDelete?: boolean;
    };
  }) {
    const { skip_hooks = false, cookie } = params;
    const {
      metaQueries,
      execQueries,
      linkedRecordUpdates,
      qb,
      filterObj,
      attachmentColumns,
      isSoftDelete,
      operationNow,
    } = await this.prepareBulkDeleteAll(params);

    const bulkAuditEvent = isSoftDelete
      ? AuditV1OperationTypes.DATA_BULK_SOFT_DELETE
      : AuditV1OperationTypes.DATA_BULK_DELETE;
    const rowAuditEvent = isSoftDelete
      ? AuditV1OperationTypes.DATA_SOFT_DELETE
      : AuditV1OperationTypes.DATA_DELETE;

    const offset = 0;
    const limit = 100;
    const response = [];

    // paginate all the records and find file reference ids
    const selectQb = qb
      .clone()
      .select(
        attachmentColumns
          .map((c) => c.column_name)
          .concat(this.baseModel.model.primaryKeys.map((pk) => pk.column_name)),
      );
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await this.baseModel.execAndParse(
        selectQb
          .clone()
          .offset(offset)
          .limit(limit + 1),
        null,
        {
          raw: true,
        },
      );

      if (rows.length === 0) {
        break;
      }

      let lastPage = false;

      if (rows.length > limit) {
        rows.pop();
      } else {
        lastPage = true;
      }

      const chunkPrimaryKeyObjects = rows.map((row) => {
        const primaryData = {};

        for (const pk of this.baseModel.model.primaryKeys) {
          primaryData[pk.title] = row[pk.column_name];
        }
        return primaryData;
      }) as any[];
      const ids =
        this.baseModel.model.primaryKeys.length > 1
          ? chunkPrimaryKeyObjects
          : chunkPrimaryKeyObjects.map(
              (row) => row[this.baseModel.model.primaryKey.title],
            );

      // Phase 1: Collect linked IDs BEFORE executeBulkAll destroys link data
      const chunkNotifications: {
        baseModel: any;
        model: any;
        ids: string[];
        colId: string;
      }[] = [];

      if (linkedRecordUpdates.length > 0) {
        for (const entry of linkedRecordUpdates) {
          try {
            const linkedIds = await entry.getLinkedIds(ids);
            if (linkedIds.length > 0) {
              chunkNotifications.push({
                baseModel: entry.baseModel,
                model: entry.model,
                ids: linkedIds,
                colId: entry.column.id,
              });
            }
          } catch (e) {
            // Don't fail the delete if linked record collection fails
            this.logger.warn(
              `Failed to collect linked ids for column ${entry.column.id}: ${e.message}`,
            );
          }
        }
      }

      const chunkResponse = await this.executeBulkAll({
        execQueries,
        metaQueries,
        ids,
        rows,
        qb,
      });
      response.push(...chunkResponse);

      // Phase 2: Notify linked records AFTER executeBulkAll commits
      for (const entry of chunkNotifications) {
        try {
          await entry.baseModel.updateLastModified({
            model: entry.model,
            rowIds: entry.ids,
            cookie,
            updatedColIds: [entry.colId].filter(Boolean),
            timestamp: operationNow,
          });
          await entry.baseModel.broadcastLinkUpdates(entry.ids);
        } catch (e) {
          // Don't fail the delete if linked record updates fail
          this.logger.warn(
            `Failed to notify linked records for column ${entry.colId}: ${e.message}`,
          );
        }
      }

      // insert records updating record details to audit table
      await this.baseModel.bulkAudit({
        qb: qb.clone(),
        conditions: filterObj,
        req: cookie,
        event: bulkAuditEvent,
      });

      if (!skip_hooks) {
        await this.baseModel.afterBulkDelete(
          chunkResponse,
          this.baseModel.dbDriver,
          cookie,
          true,
          bulkAuditEvent,
          rowAuditEvent,
        );
      }

      if (lastPage) {
        break;
      }
    }
    return response;
  }

  async permanentDeleteByIds(
    rowIds: string[],
    cookie: NcRequest,
    isBulkAllOperation = false,
  ) {
    const columns = await this.baseModel.model.getColumns(
      this.baseModel.context,
    );
    const source = await this.baseModel.getSource();
    const isMeta = source.isMeta();

    const execQueries: ExecQueryType[] = [];
    const metaQueries: MetaQueryType[] = [];

    for (const column of this.baseModel.model.columns) {
      if (!isMeta || this.baseModel.model.primaryKeys.length > 1) break;
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.baseModel.context,
      );

      const { refContext, mmContext, parentContext, childContext } =
        await colOptions.getParentChildContext(this.baseModel.context);

      // Skip V1 BT — deleted record is the child; parent's FK is unaffected
      // V2 BT uses junction tables (isMMOrMMLike=true), so junction rows need cleanup
      if (colOptions.type === 'bt' && !isMMOrMMLike(column)) {
        continue;
      }

      const childColumn = await colOptions.getChildColumn(childContext);
      const parentColumn = await colOptions.getParentColumn(parentContext);
      const parentTable = await parentColumn.getModel(parentContext);
      const childTable = await childColumn.getModel(childContext);
      await childTable.getColumns(childContext);
      await parentTable.getColumns(parentContext);

      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: childTable,
        dbDriver: this.baseModel.dbDriver,
      });

      const childTn = childBaseModel.getTnPath(childTable);

      const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;
      switch (relationType) {
        case 'mm':
          {
            const vChildCol = await colOptions.getMMChildColumn(mmContext);
            const vTable = await colOptions.getMMModel(mmContext);
            const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: vTable,
              dbDriver: this.baseModel.dbDriver,
            });
            const vTn = assocBaseModel.getTnPath(vTable);

            execQueries.push(({ trx, ids }) => [
              trx(vTn).whereIn(vChildCol.column_name, ids).delete(),
            ]);
          }
          break;
        case 'hm':
          {
            const relatedTable = await colOptions.getRelatedTable(refContext);
            if (relatedTable.mm) {
              break;
            }

            const childColumn = await Column.get(childContext, {
              colId: colOptions.fk_child_column_id,
            });

            execQueries.push(({ trx, ids }) => {
              const query = trx(childTn)
                .whereIn(childColumn.column_name, ids)
                .update({
                  [childColumn.column_name]: null,
                });
              return [query];
            });
          }
          break;
        case 'oo':
          {
            if (column.meta?.bt) {
              // BT-side: FK on deleted record — nothing to clean
              break;
            }
            // HM-side: null FK on child
            const ooRelatedTable = await colOptions.getRelatedTable(refContext);
            if (ooRelatedTable.mm) break;

            const ooChildColumn = await Column.get(childContext, {
              colId: colOptions.fk_child_column_id,
            });

            execQueries.push(({ trx, ids }) => {
              const query = trx(childTn)
                .whereIn(ooChildColumn.column_name, ids)
                .update({ [ooChildColumn.column_name]: null });
              return [query];
            });
          }
          break;
      }
    }

    // remove FileReferences for attachment fields
    const attachmentColumns = columns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    metaQueries.push(async ({ rows }) => {
      const fileReferenceIds: string[] = [];
      for (const row of rows) {
        for (const c of attachmentColumns) {
          if (row[c.column_name]) {
            try {
              let attachments;
              if (typeof row[c.column_name] === 'string') {
                attachments = JSON.parse(row[c.column_name]);
              }

              if (Array.isArray(attachments)) {
                for (const attachment of attachments) {
                  if (attachment.id) {
                    fileReferenceIds.push(attachment.id);
                  }
                }
              }
            } catch (e) {
              // ignore error
            }
          }
        }
      }
      await FileReference.delete(this.baseModel.context, fileReferenceIds);
    });

    // Hard-delete the rows
    execQueries.push(({ trx, qb, ids }) => {
      if (this.baseModel.model.primaryKeys.length === 1) {
        return [
          (this.isDbExternal ? qb : qb.transacting(trx))
            .whereIn(this.baseModel.model.primaryKey.column_name, ids)
            .del(),
        ];
      } else {
        return ids.map((id) =>
          (this.isDbExternal ? qb : qb.transacting(trx))
            .where(_wherePk(this.baseModel.model.primaryKeys, id))
            .del(),
        );
      }
    });

    const qb = this.baseModel.dbDriver(this.baseModel.tnPath);

    const ids =
      this.baseModel.model.primaryKeys.length > 1
        ? rowIds.map((id) => {
            const pkObj = {};
            const pkValues = id
              .split('___')
              .map((val) => val.replaceAll('\\_', '_'));
            this.baseModel.model.primaryKeys.forEach((pk, i) => {
              pkObj[pk.title] = pkValues[i];
            });
            return pkObj;
          })
        : rowIds;

    // Fetch old records directly (bypass soft-delete filter since these ARE trashed records)
    const pk = this.baseModel.model.primaryKey;
    const oldRecords = await this.baseModel.execAndParse(
      this.baseModel
        .dbDriver(this.baseModel.tnPath)
        .whereIn(pk.column_name, rowIds)
        .select(columns.filter((c) => c.column_name).map((c) => c.column_name)),
      columns,
      { raw: true },
    );

    // Verify all rows are actually soft-deleted before permanently deleting
    const deletedCol = columns.find((c) => isDeletedCol(c));
    if (deletedCol) {
      const activeRows = oldRecords.filter((r) => !r[deletedCol.column_name]);
      if (activeRows.length > 0) {
        NcError.get(this.baseModel.context).recordNotTrashed();
      }
    }

    const rows = oldRecords;

    const trx = await this.baseModel.dbDriver.transaction();
    try {
      for (const execQuery of execQueries) {
        await Promise.all(execQuery({ trx, qb: qb.clone(), ids, rows }));
      }
      await trx.commit();
    } catch (ex) {
      await trx.rollback();
      this.logger.error(ex.message);
      throw ex;
    }

    for (const metaQuery of metaQueries) {
      await metaQuery({ qb: qb.clone(), ids, rows });
    }

    await this.baseModel.afterBulkDelete(
      oldRecords,
      this.baseModel.dbDriver,
      cookie,
      isBulkAllOperation,
      AuditV1OperationTypes.DATA_BULK_PERMANENT_DELETE,
      AuditV1OperationTypes.DATA_DELETE,
    );

    return oldRecords;
  }
}
