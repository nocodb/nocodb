import { Logger } from '@nestjs/common';
import {
  AuditOperationSubTypes,
  isDeletedCol,
  isLinksOrLTAR,
  isLinkV2,
  isMMOrMMLike,
  RelationTypes,
} from 'nocodb-sdk';
import { extractCorrespondingLinkColumn } from './BaseModelSqlv2/add-remove-links';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Knex } from 'knex';
import { Model } from '~/models';
import { RelationUpdateWebhookHandler } from '~/db/relation-update-webhook-handler';
import { NcError } from '~/helpers/catchError';
import {
  _wherePk,
  getCompositePkValue,
  getOppositeRelationType,
} from '~/helpers/dbHelpers';

const logger = new Logger('RelationManager');

interface AuditUpdateLog {
  pkValue?: Record<string, any>;
  rowId: unknown;
  refRowId?: unknown;
  displayValue?: unknown;
  refDisplayValue?: unknown;
  opSubType:
    | AuditOperationSubTypes.LINK_RECORD
    | AuditOperationSubTypes.UNLINK_RECORD;
  type: RelationTypes;
  direction: 'parent_child' | 'child_parent';
}

interface AuditUpdateObj extends AuditUpdateLog {
  columnTitle: string;
  refColumnTitle?: string;
  columnId: string;
  req: NcRequest;
  model: Model;
  refModel?: Model;
}

export class RelationManager {
  constructor(
    private relationContext: {
      baseModel: IBaseModelSqlV2;
      relationColumn: Column<any>;
      relationColOptions: LinkToAnotherRecordColumn;
      childTn: string | Knex.Raw<any>;
      childColumn: Column<any>;
      childTable: Model;
      childBaseModel: IBaseModelSqlV2;
      parentTn: string | Knex.Raw<any>;
      parentColumn: Column<any>;
      parentTable: Model;
      parentBaseModel: IBaseModelSqlV2;
      childId: any;
      parentId: any;
      parentContext: NcContext;
      childContext: NcContext;
      mmContext: NcContext;
      refContext: NcContext;
    },
  ) {}

  protected auditUpdateObj: AuditUpdateLog[] = [];

  getRelationContext() {
    return this.relationContext;
  }

  // for M2M and Belongs to relation, the relation stored in column option is reversed
  // parent become child, child become parent from the viewpoint of col options
  // In v2 we use junction table and it act like MM so we treat it as reversed relation as well
  static isRelationReversed(
    relationColumn: Column<any>,
    colOptions: LinkToAnotherRecordColumn,
  ) {
    const isBelongsTo =
      colOptions.type === RelationTypes.BELONGS_TO || relationColumn.meta?.bt;
    const reversed =
      isLinkV2(relationColumn) ||
      isBelongsTo ||
      colOptions.type === RelationTypes.MANY_TO_MANY;
    return reversed;
  }

  static async getRelationManager(
    baseModel: IBaseModelSqlV2,
    colId: string,
    id: {
      rowId: any;
      childId: any;
    },
  ) {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column.uidt))
      NcError.get(baseModel.context).fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      baseModel.context,
    );

    const { parentContext, childContext, refContext, mmContext } =
      await colOptions.getParentChildContext(baseModel.context);

    const childColumn = await colOptions.getChildColumn(childContext);
    const parentColumn = await colOptions.getParentColumn(parentContext);

    const parentTable = await parentColumn.getModel(parentContext);
    const childTable = await childColumn.getModel(childContext);

    await childTable.getColumns(childContext);
    await parentTable.getColumns(parentContext);

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      dbDriver: baseModel.dbDriver,
      model: childTable,
    });

    const reversed = RelationManager.isRelationReversed(column, colOptions);

    return new RelationManager({
      baseModel,
      relationColumn: column,
      relationColOptions: colOptions,
      childTn: childBaseModel.getTnPath(childTable),
      childColumn,
      childTable,
      childBaseModel,
      parentTn: parentBaseModel.getTnPath(parentTable),
      parentColumn,
      parentTable,
      parentBaseModel,
      childId: reversed ? id.rowId : id.childId,
      parentId: reversed ? id.childId : id.rowId,
      parentContext,
      childContext,
      refContext,
      mmContext,
    });
  }

  async getHmOrOoChildRow() {
    const {
      childBaseModel: baseModel,
      childTn,
      childColumn,
      childTable,
      childId,
    } = this.relationContext;
    return await baseModel.execAndParse(
      baseModel
        .dbDriver(childTn)
        .select(
          ...new Set(
            [childColumn, ...childTable.primaryKeys].map(
              (col) => `${childTable.table_name}.${col.column_name}`,
            ),
          ),
        )
        .where(_wherePk(childTable.primaryKeys, childId)),
      null,
      { raw: true, first: true },
    );
  }

  /**
   * Get related rows through the junction table for v2 links.
   * Returns only PK columns from the parent table (not SELECT *).
   * F4 fix: select only primary keys instead of all columns.
   */
  async getLinkV2RelatedRowPks() {
    const {
      childTable,
      childBaseModel,
      childTn,
      childColumn,
      childId,
      parentBaseModel,
      parentTn,
      parentColumn,
      parentTable,
      relationColOptions,
      mmContext,
    } = this.relationContext;

    const vChildCol = await relationColOptions.getMMChildColumn(mmContext);
    const vParentCol = await relationColOptions.getMMParentColumn(mmContext);
    const vTable = await relationColOptions.getMMModel(mmContext);

    const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
      model: vTable,
      dbDriver: childBaseModel.dbDriver,
    });

    const vTn = assocBaseModel.getTnPath(vTable);

    // Select only PK columns instead of parentTn.*
    const pkColumns = parentTable.primaryKeys.map(
      (pk) => `${parentTn}.${pk.column_name}`,
    );

    return await parentBaseModel.execAndParse(
      parentBaseModel
        .dbDriver(parentTn)
        .select(...pkColumns)
        .join(
          vTn,
          `${vTn}.${vParentCol.column_name}`,
          `${parentTn}.${parentColumn.column_name}`,
        )
        .where({
          [`${vTn}.${vChildCol.column_name}`]: childBaseModel
            .dbDriver(childTn)
            .select(childColumn.column_name)
            .where(_wherePk(childTable.primaryKeys, childId))
            .first(),
        }),
      null,
      { raw: true },
    );
  }

  async getHmOrOoChildLinkedWithParent() {
    const {
      childBaseModel: baseModel,
      childTn,
      childTable,
      parentTn,
      childColumn,
      parentColumn,
      parentTable,
      parentId,
    } = this.relationContext;
    const qb = baseModel.dbDriver(childTn).where({
      [childColumn.column_name]: baseModel.dbDriver.from(
        baseModel
          .dbDriver(parentTn)
          .select(parentColumn.column_name)
          .where(_wherePk(parentTable.primaryKeys, parentId))
          .first()
          .as('___cn_alias'),
      ),
    });

    // Exclude soft-deleted rows — they should not block new OO links
    const softDeleteCol = childTable.columns?.find((c) => isDeletedCol(c));
    if (softDeleteCol) {
      qb.where(function () {
        this.whereNull(softDeleteCol.column_name).orWhere(
          softDeleteCol.column_name,
          false,
        );
      });
    }

    return await baseModel.execAndParse(qb, null, { raw: true, first: true });
  }

  /**
   * Resolve junction table metadata shared across v2 operations.
   * F5 fix: resolve once, reuse across operations instead of per-row.
   */
  private async resolveJunctionMeta() {
    const {
      relationColOptions: colOptions,
      baseModel,
      mmContext,
    } = this.relationContext;

    const vChildCol = await colOptions.getMMChildColumn(mmContext);
    const vParentCol = await colOptions.getMMParentColumn(mmContext);
    const vTable = await colOptions.getMMModel(mmContext);

    const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
      model: vTable,
      dbDriver: baseModel.dbDriver,
    });

    const vTn = assocBaseModel.getTnPath(vTable);

    return { vChildCol, vParentCol, vTable, assocBaseModel, vTn };
  }

  /**
   * Batch delete junction rows by a filter column value (using a subquery).
   * Returns the FK pairs that were deleted for audit log generation.
   *
   * F3 fix: single SELECT + single DELETE instead of N removeChild calls.
   */
  private async batchDeleteJunctionRows(
    trx: Knex.Transaction,
    params: {
      vTn: string | Knex.Raw;
      vChildCol: Column;
      vParentCol: Column;
      filterColName: string;
      filterSubquery: Knex.QueryBuilder;
      execQb?: (
        qb: Knex.QueryBuilder | string,
        opts?: { first?: boolean },
      ) => Promise<any>;
      /** Table + path for the "other side" of the junction — used to skip soft-deleted rows */
      otherSideTable?: Model;
      otherSideColName?: string;
      otherSideTn?: string | Knex.Raw;
    },
  ): Promise<Array<{ childFk: any; parentFk: any }>> {
    const {
      vTn,
      vChildCol,
      vParentCol,
      filterColName,
      filterSubquery,
      execQb,
      otherSideTable,
      otherSideColName,
      otherSideTn,
    } = params;

    // 1. SELECT existing junction rows (just FK columns)
    const selectQb = trx(vTn)
      .select(vChildCol.column_name, vParentCol.column_name)
      .where(filterColName, filterSubquery);
    const existingRows = execQb ? await execQb(selectQb) : await selectQb;

    if (existingRows.length === 0) {
      return [];
    }

    // 2. DELETE — skip rows where the other side is soft-deleted so that the
    //    junction entry is preserved for restore conflict detection.
    const deleteQb = trx(vTn).where(filterColName, filterSubquery);
    const softDeleteCol = otherSideTable?.columns?.find((c) => isDeletedCol(c));
    if (softDeleteCol && otherSideColName && otherSideTn) {
      deleteQb.whereNotExists(
        trx(otherSideTn)
          .select(1)
          .where(softDeleteCol.column_name, true)
          .whereRaw('?? = ??', [
            otherSideTable.primaryKey.column_name,
            `${vTn}.${otherSideColName}`,
          ]),
      );
    }
    deleteQb.delete();
    if (execQb) {
      await execQb(deleteQb);
    } else {
      await deleteQb;
    }
    // Return only the rows that were actually deleted (not preserved for soft-deleted other side)
    if (softDeleteCol && otherSideColName) {
      const deletedRowsQb = trx(vTn)
        .select(vChildCol.column_name, vParentCol.column_name)
        .where(filterColName, filterSubquery);
      const deletedRows = execQb
        ? await execQb(deletedRowsQb)
        : await deletedRowsQb;
      const deletedSet = new Set(
        deletedRows.map(
          (r) => `${r[vChildCol.column_name]}:${r[vParentCol.column_name]}`,
        ),
      );
      return existingRows
        .filter(
          (row) =>
            !deletedSet.has(
              `${row[vChildCol.column_name]}:${row[vParentCol.column_name]}`,
            ),
        )
        .map((row) => ({
          childFk: row[vChildCol.column_name],
          parentFk: row[vParentCol.column_name],
        }));
    }

    return existingRows.map((row) => ({
      childFk: row[vChildCol.column_name],
      parentFk: row[vParentCol.column_name],
    }));
  }

  /**
   * Generate unlink audit log entries for removed junction rows.
   * Produces the same audit entries that individual removeChild calls would.
   */
  private async generateUnlinkAuditLogs(
    removedPairs: Array<{ childFk: any; parentFk: any }>,
    relationType: RelationTypes,
    parentTable: Model,
    childTable: Model,
  ) {
    if (!removedPairs.length) return;

    const { baseModel } = this.relationContext;

    // Batch-fetch display values for all evicted rows
    const dvMap = await baseModel.fetchDisplayValueMap(
      removedPairs.flatMap((pair) => [
        { model: parentTable, id: pair.parentFk },
        { model: childTable, id: pair.childFk },
      ]),
    );

    for (const pair of removedPairs) {
      const parentDisplayValue = dvMap.get(
        `${parentTable.id}:${pair.parentFk}`,
      );
      const childDisplayValue = dvMap.get(`${childTable.id}:${pair.childFk}`);

      this.auditUpdateObj.push({
        rowId: pair.parentFk,
        refRowId: pair.childFk,
        displayValue: parentDisplayValue,
        refDisplayValue: childDisplayValue,
        opSubType: AuditOperationSubTypes.UNLINK_RECORD,
        type: relationType,
        direction: 'parent_child',
      });

      if (parentTable.id !== childTable.id) {
        this.auditUpdateObj.push({
          rowId: pair.childFk,
          refRowId: pair.parentFk,
          displayValue: childDisplayValue,
          refDisplayValue: parentDisplayValue,
          opSubType: AuditOperationSubTypes.UNLINK_RECORD,
          type: getOppositeRelationType(relationType),
          direction: 'child_parent',
        });
      }
    }
  }

  /**
   * Enforce v2 cardinality constraints and insert the new link atomically.
   * Wraps everything in a single DB transaction (skipped for external mux sources).
   * Batch delete instead of per-row removeChild.
   * F14 fix: single broadcast after all operations.
   */
  private async enforceV2CardinalityAndInsert(params: {
    vChildCol: Column;
    vParentCol: Column;
    vTn: string | Knex.Raw;
    column: Column;
    req: any;
    refTableLinkColumnId: string;
  }) {
    const {
      relationColOptions: colOptions,
      baseModel,
      parentBaseModel,
      parentColumn,
      parentTable,
      parentTn,
      childBaseModel,
      childColumn,
      childTable,
      childTn,
      childId,
      parentId,
      relationColumn,
    } = this.relationContext;

    const { vChildCol, vParentCol, vTn, column, req, refTableLinkColumnId } =
      params;

    const allAffectedParentIds: any[] = [];
    const allAffectedChildIds: any[] = [];
    let moRemovedPairs: Array<{ childFk: any; parentFk: any }> = [];
    let omRemovedPairs: Array<{ childFk: any; parentFk: any }> = [];

    // Helper: execute a query builder through execAndParse (routes via mux
    // for external sources) instead of direct Knex Runner execution.
    const execQb = async (qb: any, opts?: { first?: boolean }) => {
      return baseModel.execAndParse(qb, null, { raw: true, ...opts });
    };

    // Wrap cardinality enforcement + insert in a single transaction.
    // External mux sources don't support PG transactions over HTTP — skip
    // the transaction wrapper but still execute queries through execAndParse.
    const isExternal = (baseModel.dbDriver as any).isExternal;
    const trx: any = isExternal
      ? baseModel.dbDriver
      : await baseModel.dbDriver.transaction();
    try {
      // ManyToOne / OneToOne: this child can only link to one parent
      // → remove all existing junction rows for this child
      if (['mo', 'oo'].includes(colOptions.type)) {
        const childFkSubquery = trx(childTn)
          .select(childColumn.column_name)
          .where(_wherePk(childTable.primaryKeys, childId))
          .first();

        moRemovedPairs = await this.batchDeleteJunctionRows(trx, {
          vTn,
          vChildCol,
          vParentCol,
          filterColName: vChildCol.column_name,
          filterSubquery: childFkSubquery,
          execQb: isExternal ? execQb : undefined,
          otherSideTable: parentTable,
          otherSideColName: vParentCol.column_name,
          otherSideTn: parentTn,
        });

        for (const pair of moRemovedPairs) {
          allAffectedParentIds.push(pair.parentFk);
        }

        if (moRemovedPairs.length > 1) {
          logger.warn(
            `V2 cardinality enforcement removed ${moRemovedPairs.length} junction rows ` +
              `(expected 0-1) for child ${childId} on column ${relationColumn.id}`,
          );
        }
      }

      // OneToMany / OneToOne: this parent can only be linked to by one child
      // → remove all existing junction rows for this parent
      if (['om', 'oo'].includes(colOptions.type)) {
        const parentFkSubquery = trx(parentTn)
          .select(parentColumn.column_name)
          .where(_wherePk(parentTable.primaryKeys, parentId))
          .first();

        omRemovedPairs = await this.batchDeleteJunctionRows(trx, {
          vTn,
          vChildCol,
          vParentCol,
          filterColName: vParentCol.column_name,
          filterSubquery: parentFkSubquery,
          otherSideTable: childTable,
          otherSideColName: vChildCol.column_name,
          otherSideTn: childTn,
          execQb: isExternal ? execQb : undefined,
        });

        for (const pair of omRemovedPairs) {
          allAffectedChildIds.push(pair.childFk);
        }

        if (omRemovedPairs.length > 1) {
          logger.warn(
            `V2 cardinality enforcement removed ${omRemovedPairs.length} junction rows ` +
              `(expected 0-1) for parent ${parentId} on column ${relationColumn.id}`,
          );
        }
      }

      // Insert the new junction row
      if (baseModel.isSnowflake || baseModel.isDatabricks) {
        const parentPK = trx(parentTn)
          .select(parentColumn.column_name)
          .where(_wherePk(parentTable.primaryKeys, parentId))
          .first();

        const childPK = trx(childTn)
          .select(childColumn.column_name)
          .where(_wherePk(childTable.primaryKeys, childId))
          .first();

        const insertQb = trx.raw(
          `INSERT INTO ?? (??, ??) SELECT (${parentPK.toQuery()}), (${childPK.toQuery()})`,
          [vTn, vParentCol.column_name, vChildCol.column_name],
        );
        if (isExternal) {
          await execQb(insertQb);
        } else {
          await insertQb;
        }
      } else {
        const insertObj = {
          [vParentCol.column_name]: trx(parentTn)
            .select(parentColumn.column_name)
            .where(_wherePk(parentTable.primaryKeys, parentId))
            .first(),
          [vChildCol.column_name]: trx(childTn)
            .select(childColumn.column_name)
            .where(_wherePk(childTable.primaryKeys, childId))
            .first(),
        };
        const insertQb = trx(vTn).insert(insertObj);
        if (isExternal) {
          await execQb(insertQb);
        } else {
          await insertQb;
        }
      }

      if (!isExternal) await trx.commit();
    } catch (e) {
      if (!isExternal) await trx.rollback();
      throw e;
    }

    // Generate audit logs after transaction (needs display value queries)
    if (moRemovedPairs.length) {
      await this.generateUnlinkAuditLogs(
        moRemovedPairs,
        colOptions.type as RelationTypes,
        parentTable,
        childTable,
      );
    }
    if (omRemovedPairs.length) {
      await this.generateUnlinkAuditLogs(
        omRemovedPairs,
        colOptions.type as RelationTypes,
        parentTable,
        childTable,
      );
    }

    // Single batch of updateLastModified and broadcast after transaction
    // Include evicted row IDs so their updated_at is refreshed too
    const allParentRowIds = [
      parentId,
      ...allAffectedParentIds.filter((id) => id !== parentId),
    ];
    const allChildRowIds = [
      childId,
      ...allAffectedChildIds.filter((id) => id !== childId),
    ];

    await parentBaseModel.updateLastModified({
      baseModel: parentBaseModel,
      model: parentTable,
      rowIds: allParentRowIds,
      cookie: req,
      updatedColIds: [refTableLinkColumnId],
    });

    await childBaseModel.updateLastModified({
      baseModel: childBaseModel,
      model: childTable,
      rowIds: allChildRowIds,
      cookie: req,
      updatedColIds: [column.id],
    });

    await parentBaseModel.broadcastLinkUpdates(allParentRowIds);
    await childBaseModel.broadcastLinkUpdates(allChildRowIds);
  }

  async addChild(params: {
    onlyUpdateAuditLogs?: boolean;
    prevData?: Record<string, any>;
    req: any;
  }) {
    const {
      relationColOptions: colOptions,
      baseModel,
      parentBaseModel,
      parentColumn,
      parentTable,
      parentTn,
      childBaseModel,
      childColumn,
      childTable,
      childTn,

      childId,
      parentId,
      relationColumn,
    } = this.relationContext;

    const column = relationColumn;

    // Get the corresponding link column ID for the parent table
    const refTableLinkColumnId = (
      await extractCorrespondingLinkColumn(baseModel.context, {
        ltarColumn: column,
        referencedTable:
          colOptions.fk_related_model_id === parentTable.id
            ? parentTable
            : childTable,
      })
    )?.id;

    const isMMLike = isMMOrMMLike(this.relationContext.relationColumn);

    const { onlyUpdateAuditLogs, req } = params;
    if (onlyUpdateAuditLogs && colOptions.type !== RelationTypes.BELONGS_TO) {
      return await this.handleOnlyUpdateAudit(params);
    }

    // Create webhook handler before any mutations (captures pre-state)
    const webhookHandler = await RelationUpdateWebhookHandler.beginUpdate(
      {
        childBaseModel,
        parentBaseModel,
        user: req.user,
        ignoreWebhook: req.query?.ignoreWebhook,
      },
      {
        parent: parentId,
        child: childId,
      },
    );

    const relationType = isMMLike
      ? RelationTypes.MANY_TO_MANY
      : colOptions.type;

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          const { vChildCol, vParentCol, assocBaseModel, vTn } =
            await this.resolveJunctionMeta();

          // V2 constrained relations (MO, OM, OO): enforce cardinality in a transaction
          if (isMMLike && colOptions.type !== RelationTypes.MANY_TO_MANY) {
            await this.enforceV2CardinalityAndInsert({
              vChildCol,
              vParentCol,
              vTn,
              column,
              req,
              refTableLinkColumnId,
            });
          } else {
            // Standard MM: just insert, no cardinality enforcement needed
            if (baseModel.isSnowflake || baseModel.isDatabricks) {
              const parentPK = parentBaseModel
                .dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, parentId))
                .first();

              const childPK = childBaseModel
                .dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, childId))
                .first();

              await baseModel.execAndParse(
                baseModel.dbDriver.raw(
                  `INSERT INTO ?? (??, ??) SELECT (${parentPK.toQuery()}), (${childPK.toQuery()})`,
                  [vTn, vParentCol.column_name, vChildCol.column_name],
                ) as any,
                null,
                { raw: true },
              );
            } else {
              await assocBaseModel.execAndParse(
                baseModel.dbDriver(vTn).insert({
                  [vParentCol.column_name]: baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, parentId))
                    .first(),
                  [vChildCol.column_name]: baseModel
                    .dbDriver(childTn)
                    .select(childColumn.column_name)
                    .where(_wherePk(childTable.primaryKeys, childId))
                    .first(),
                }),
                null,
                { raw: true },
              );
            }

            await parentBaseModel.updateLastModified({
              baseModel: parentBaseModel,
              model: parentTable,
              rowIds: [parentId],
              cookie: req,
              updatedColIds: [refTableLinkColumnId],
            });

            await parentBaseModel.broadcastLinkUpdates([parentId]);

            await childBaseModel.updateLastModified({
              baseModel: childBaseModel,
              model: childTable,
              rowIds: [childId],
              cookie: req,
              updatedColIds: [column.id],
            });

            await childBaseModel.broadcastLinkUpdates([childId]);
          }
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          const linkedHmRowObj = await this.getHmOrOoChildRow();

          const oldRowId = linkedHmRowObj
            ? linkedHmRowObj?.[childColumn?.column_name]
            : null;

          if (oldRowId) {
            await webhookHandler.addAffectedParentId(oldRowId);
            const [parentRelatedPkValue, childRelatedPkValue] =
              await baseModel.readOnlyPrimariesByPkFromModel([
                { model: childTable, id: childId },
                { model: parentTable, id: oldRowId },
              ]);

            this.auditUpdateObj.push({
              rowId: oldRowId as string,
              refRowId: childId,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              refDisplayValue: parentRelatedPkValue,
              displayValue: childRelatedPkValue,
              direction: 'parent_child',
              type: colOptions.type as RelationTypes,
            });

            this.auditUpdateObj.push({
              rowId: childId,
              refRowId: oldRowId as string,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              displayValue: parentRelatedPkValue,
              refDisplayValue: childRelatedPkValue,
              direction: 'child_parent',
              type: getOppositeRelationType(colOptions.type),
            });
            await parentBaseModel.updateLastModified({
              baseModel: parentBaseModel,
              model: parentTable,
              rowIds: [oldRowId],
              cookie: req,
              updatedColIds: [column.id],
            });
          }

          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .update({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, parentId))
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, childId)),
            null,
            { raw: true },
          );
          // await triggerAfterRemoveChild();

          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [column.id],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          const linkedHmRowObj = await this.getHmOrOoChildRow();

          const oldParentRowId = linkedHmRowObj
            ? linkedHmRowObj[childColumn.column_name]
            : null;
          if (oldParentRowId) {
            await webhookHandler.addAffectedParentId(oldParentRowId);
            const [parentRelatedPkValue, childRelatedPkValue] =
              await baseModel.readOnlyPrimariesByPkFromModel([
                { model: parentTable, id: oldParentRowId },
                { model: childTable, id: childId },
              ]);

            this.auditUpdateObj.push({
              rowId: oldParentRowId as string,
              refRowId: childId,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              displayValue: parentRelatedPkValue,
              refDisplayValue: childRelatedPkValue,
              direction: 'parent_child',
              type: colOptions.type as RelationTypes,
            });

            this.auditUpdateObj.push({
              rowId: childId,
              refRowId: oldParentRowId as string,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              displayValue: childRelatedPkValue,
              refDisplayValue: parentRelatedPkValue,
              direction: 'child_parent',
              type: getOppositeRelationType(colOptions.type),
            });

            await parentBaseModel.updateLastModified({
              baseModel: parentBaseModel,
              model: parentTable,
              rowIds: [oldParentRowId],
              cookie: req,
              updatedColIds: [
                (
                  await extractCorrespondingLinkColumn(childBaseModel.context, {
                    ltarColumn: column,
                    referencedTable: parentTable,
                  })
                )?.id,
              ],
            });
          }

          await childBaseModel.execAndParse(
            childBaseModel
              .dbDriver(childTn)
              .update({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, parentId))
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, childId)),
            null,
            { raw: true },
          );

          // await triggerAfterRemoveChild();
          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [column.id],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          // 1. check current row is linked with another child
          const linkedCurrentOoRowObj =
            await this.getHmOrOoChildLinkedWithParent();

          if (linkedCurrentOoRowObj) {
            const oldChildRowId = getCompositePkValue(
              childTable.primaryKeys,
              baseModel.extractPksValues(linkedCurrentOoRowObj),
            );

            if (oldChildRowId) {
              await webhookHandler.addAffectedChildId(oldChildRowId);
              const [parentRelatedPkValue, childRelatedPkValue] =
                await baseModel.readOnlyPrimariesByPkFromModel([
                  { model: childTable, id: oldChildRowId },
                  { model: parentTable, id: parentId },
                ]);

              this.auditUpdateObj.push({
                rowId: parentId,
                refRowId: oldChildRowId as string,
                opSubType: AuditOperationSubTypes.UNLINK_RECORD,
                displayValue: parentRelatedPkValue,
                refDisplayValue: childRelatedPkValue,
                direction: 'parent_child',
                type: colOptions.type as RelationTypes,
              });

              this.auditUpdateObj.push({
                rowId: oldChildRowId as string,
                refRowId: parentId,
                opSubType: AuditOperationSubTypes.UNLINK_RECORD,
                displayValue: childRelatedPkValue,
                refDisplayValue: parentRelatedPkValue,
                direction: 'child_parent',
                type: getOppositeRelationType(colOptions.type),
              });
              await childBaseModel.updateLastModified({
                baseModel: childBaseModel,
                model: childTable,
                rowIds: [oldChildRowId],
                cookie: req,
                updatedColIds: [column.id],
              });
            }
          }

          // 2. check current child is linked with another row cell
          const linkedOoRowObj = await this.getHmOrOoChildRow();

          const oldRowId = linkedOoRowObj
            ? linkedOoRowObj[childColumn.column_name]
            : null;
          if (oldRowId) {
            await webhookHandler.addAffectedParentId(oldRowId);
            const [parentRelatedPkValue, childRelatedPkValue] =
              await baseModel.readOnlyPrimariesByPkFromModel([
                { model: childTable, id: childId },
                { model: parentTable, id: oldRowId },
              ]);

            this.auditUpdateObj.push({
              rowId: oldRowId as string,
              refRowId: childId,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              displayValue: parentRelatedPkValue,
              refDisplayValue: childRelatedPkValue,
              direction: 'parent_child',
              type: colOptions.type as RelationTypes,
            });

            this.auditUpdateObj.push({
              rowId: childId,
              refRowId: oldRowId as string,
              opSubType: AuditOperationSubTypes.UNLINK_RECORD,
              displayValue: childRelatedPkValue,
              refDisplayValue: parentRelatedPkValue,
              direction: 'child_parent',
              type: getOppositeRelationType(colOptions.type),
            });
            await parentBaseModel.updateLastModified({
              baseModel: parentBaseModel,
              model: parentTable,
              rowIds: [oldRowId],
              cookie: req,
              updatedColIds: [refTableLinkColumnId],
            });
          }
          // Unlink existing child records — but preserve FK on soft-deleted
          // rows so restore conflict detection can detect the OO violation.
          {
            const unlinkQb = baseModel
              .dbDriver(childTn)
              .where({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, parentId))
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .update({ [childColumn.column_name]: null });

            const softDeleteCol = childTable.columns?.find((c) =>
              isDeletedCol(c),
            );
            if (softDeleteCol) {
              unlinkQb.where(function () {
                this.whereNull(softDeleteCol.column_name).orWhere(
                  softDeleteCol.column_name,
                  false,
                );
              });
            }

            await childBaseModel.execAndParse(unlinkQb, null, { raw: true });
          }

          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .update({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, parentId))
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, childId)),
            null,
            { raw: true },
          );

          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [column.meta?.bt ? column.id : refTableLinkColumnId],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: parentId,
            cookie: req,
            updatedColIds: [column.meta?.bt ? refTableLinkColumnId : column.id],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
    }

    this.auditUpdateObj.push({
      rowId: parentId,
      refRowId: childId,
      opSubType: AuditOperationSubTypes.LINK_RECORD,
      type: colOptions.type as RelationTypes,
      direction: 'parent_child',
    });

    this.auditUpdateObj.push({
      rowId: childId,
      refRowId: parentId,
      opSubType: AuditOperationSubTypes.LINK_RECORD,
      type: getOppositeRelationType(colOptions.type),
      direction: 'child_parent',
    });

    await webhookHandler.finishUpdate();
  }

  async removeChild(params: { req: any }) {
    const {
      relationColumn,
      relationColOptions: colOptions,
      baseModel,
      parentBaseModel,
      parentColumn,
      parentTable,
      parentTn,
      childBaseModel,
      childColumn,
      childTable,
      childTn,

      childId,
      parentId,
      mmContext,
    } = this.relationContext;
    const column = relationColumn;

    const { req } = params;

    // Resolve once — every branch uses the same column + table
    const refTableLinkColumnId = (
      await extractCorrespondingLinkColumn(childBaseModel.context, {
        ltarColumn: relationColumn,
        referencedTable: parentTable,
      })
    )?.id;

    const webhookHandler = await RelationUpdateWebhookHandler.beginUpdate(
      {
        childBaseModel,
        parentBaseModel,
        user: req.user,
        ignoreWebhook: req.query?.ignoreWebhook,
      },
      {
        parent: parentId,
        child: childId,
      },
    );

    const relationType = isMMOrMMLike(relationColumn)
      ? RelationTypes.MANY_TO_MANY
      : colOptions.type;

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(mmContext);
          const vParentCol = await colOptions.getMMParentColumn(mmContext);
          const vTable = await colOptions.getMMModel(mmContext);
          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: baseModel.dbDriver,
          });
          const vTn = assocBaseModel.getTnPath(vTable);

          await assocBaseModel.execAndParse(
            baseModel
              .dbDriver(vTn)
              .where({
                [vParentCol.column_name]: baseModel
                  .dbDriver(parentTn)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, parentId))
                  .first(),
                [vChildCol.column_name]: baseModel
                  .dbDriver(childTn)
                  .select(childColumn.column_name)
                  .where(_wherePk(childTable.primaryKeys, childId))
                  .first(),
              })
              .delete(),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);

          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [colOptions.fk_column_id],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: this.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, rowId)
              //     .first()
              // })
              .where(_wherePk(childTable.primaryKeys, childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );
          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [colOptions.fk_column_id],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: this.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, childId)
              //     .first()
              // })
              .where(_wherePk(childTable.primaryKeys, childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [column.id],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });

          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .where(_wherePk(childTable.primaryKeys, childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
            updatedColIds: [colOptions.fk_column_id],
          });

          await childBaseModel.broadcastLinkUpdates([childId]);

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
            updatedColIds: [refTableLinkColumnId],
          });
          await parentBaseModel.broadcastLinkUpdates([parentId]);
        }
        break;
    }

    this.auditUpdateObj.push({
      rowId: parentId,
      refRowId: childId,
      opSubType: AuditOperationSubTypes.UNLINK_RECORD,
      type: colOptions.type as RelationTypes,
      direction: 'parent_child',
    });
    if (parentTable.id !== childTable.id) {
      this.auditUpdateObj.push({
        rowId: childId,
        refRowId: parentId,
        opSubType: AuditOperationSubTypes.UNLINK_RECORD,
        type: getOppositeRelationType(colOptions.type),
        direction: 'child_parent',
      });
    }

    await webhookHandler.finishUpdate();
  }

  async handleOnlyUpdateAudit(params: {
    onlyUpdateAuditLogs?: boolean;
    prevData?: Record<string, any>;
    req: any;
  }) {
    const {
      relationColumn: column,
      relationColOptions: colOptions,
      baseModel,
      parentTable,
      childTable,

      childId,
      parentId,
    } = this.relationContext;
    const { prevData } = params;

    const oldChildRowId = prevData[column.title]
      ? getCompositePkValue(
          parentTable.primaryKeys,
          baseModel.extractPksValues(prevData[column.title]),
        )
      : null;

    const [childRelatedPkValue] =
      await baseModel.readOnlyPrimariesByPkFromModel([
        { model: childTable, id: childId },
      ]);

    if (oldChildRowId) {
      this.auditUpdateObj.push({
        rowId: parentId,
        refRowId: oldChildRowId as string,
        opSubType: AuditOperationSubTypes.UNLINK_RECORD,
        displayValue:
          prevData[column.title]?.[parentTable.displayValue.title] ?? null,
        refDisplayValue: childRelatedPkValue,
        direction: 'parent_child',
        type: colOptions.type as RelationTypes,
      });

      this.auditUpdateObj.push({
        rowId: oldChildRowId as string,
        refRowId: parentId,
        opSubType: AuditOperationSubTypes.UNLINK_RECORD,
        displayValue: childRelatedPkValue,
        refDisplayValue:
          prevData[column.title]?.[parentTable.displayValue.title] ?? null,
        direction: 'child_parent',
        type: getOppositeRelationType(colOptions.type),
      });
    }
  }

  async getAuditUpdateObj(req: any) {
    const { childTable, parentTable, relationColumn, baseModel } =
      this.relationContext;

    // Find the paired link column on the related table
    const pairedCol = await extractCorrespondingLinkColumn(baseModel.context, {
      ltarColumn: relationColumn,
      referencedTableColumns:
        relationColumn.fk_model_id === parentTable.id
          ? childTable.columns
          : parentTable.columns,
    });

    // Determine which link column belongs to which table
    const isRelColOnParent = relationColumn.fk_model_id === parentTable.id;
    const parentLinkCol = isRelColOnParent
      ? relationColumn
      : pairedCol || relationColumn;
    const childLinkCol = isRelColOnParent
      ? pairedCol || relationColumn
      : relationColumn;

    return this.auditUpdateObj.map((log) => {
      const column =
        log.direction === 'parent_child' ? parentLinkCol : childLinkCol;
      const refColumn =
        log.direction === 'parent_child' ? childLinkCol : parentLinkCol;
      return {
        ...log,
        model: log.direction === 'parent_child' ? parentTable : childTable,
        refModel: log.direction === 'parent_child' ? childTable : parentTable,
        columnTitle: column.title,
        refColumnTitle: refColumn.title,
        columnId: column.id,
        req,
      } as AuditUpdateObj;
    });
  }
}
