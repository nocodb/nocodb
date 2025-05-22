import { AuditOperationSubTypes, RelationTypes, UITypes } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Knex } from 'knex';
import { RelationUpdateWebhookHandler } from '~/db/relation-update-webhook-handler';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  _wherePk,
  getCompositePkValue,
  getOppositeRelationType,
} from '~/helpers/dbHelpers';

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
  static isRelationReversed(
    relationColumn: Column<any>,
    colOptions: LinkToAnotherRecordColumn,
  ) {
    const isBelongsTo =
      colOptions.type === RelationTypes.BELONGS_TO || relationColumn.meta?.bt;
    return isBelongsTo || colOptions.type === RelationTypes.MANY_TO_MANY;
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

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

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
      childId:
        // in bt or mm child id and row id is swapped
        // due to table definition
        RelationManager.isRelationReversed(column, colOptions)
          ? id.rowId
          : id.childId,
      parentId: RelationManager.isRelationReversed(column, colOptions)
        ? id.childId
        : id.rowId,
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

  async getHmOrOoChildLinkedWithParent() {
    const {
      childBaseModel: baseModel,
      childTn,
      parentTn,
      childColumn,
      parentColumn,
      parentTable,
      parentId,
    } = this.relationContext;
    return await baseModel.execAndParse(
      baseModel.dbDriver(childTn).where({
        [childColumn.column_name]: baseModel.dbDriver.from(
          baseModel
            .dbDriver(parentTn)
            .select(parentColumn.column_name)
            .where(_wherePk(parentTable.primaryKeys, parentId))
            .first()
            .as('___cn_alias'),
        ),
      }),
      null,
      { raw: true, first: true },
    );
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
      mmContext,
    } = this.relationContext;
    const { onlyUpdateAuditLogs, req } = params;
    if (onlyUpdateAuditLogs && colOptions.type !== RelationTypes.BELONGS_TO) {
      return await this.handleOnlyUpdateAudit(params);
    }

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
    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(mmContext);
          const vParentCol = await colOptions.getMMParentColumn(mmContext);
          const vTable = await colOptions.getMMModel(baseModel.context);

          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: baseModel.dbDriver,
          });

          const vTn = assocBaseModel.getTnPath(vTable);

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
          });
          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
          });
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
          });

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
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
          });

          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
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
            });
          }
          // todo: unlink if it's already mapped
          // unlink already mapped record if any
          await childBaseModel.execAndParse(
            baseModel
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
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

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
          });
          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: parentId,
            cookie: req,
          });
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
    const { req } = params;

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

    switch (colOptions.type) {
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
          });
          await childBaseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
          });
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
          });
          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
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
          });
          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie: req,
          });
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
          });
          await parentBaseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie: req,
          });
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

  getAuditUpdateObj(req: any) {
    const { childTable, parentTable, parentColumn, childColumn } =
      this.relationContext;
    return this.auditUpdateObj.map((log) => {
      const column =
        log.direction === 'parent_child' ? parentColumn : childColumn;
      const refColumn =
        log.direction === 'parent_child' ? childColumn : parentColumn;
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
