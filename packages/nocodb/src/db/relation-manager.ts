import { NcError } from 'src/helpers/catchError';
import { AuditOperationSubTypes, RelationTypes, UITypes } from 'nocodb-sdk';
import { Model } from 'src/models';
import { RelationUpdateWebhookHandler } from './relation-update-webhook-handler';
import type { NcRequest } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from 'src/models';
import type { IBaseModelSqlV2 } from './IBaseModelSqlV2';
import type { Knex } from 'knex';

export function _wherePk(
  primaryKeys: Column[],
  id: unknown | unknown[],
  skipPkValidation = false,
) {
  const where = {};

  // if id object is provided use as it is
  if (id && typeof id === 'object' && !Array.isArray(id)) {
    // verify all pk columns are present in id object
    for (const pk of primaryKeys) {
      let key: string;
      if (pk.id in id) {
        key = pk.id;
      } else if (pk.title in id) {
        key = pk.title;
      } else if (pk.column_name in id) {
        key = pk.column_name;
      } else {
        NcError.badRequest(
          `Primary key column ${pk.title} not found in id object`,
        );
      }
      where[pk.column_name] = id[key];
      // validate value if auto-increment column
      // todo: add more validation based on column constraints
      if (!skipPkValidation && pk.ai && !/^\d+$/.test(id[key])) {
        NcError.invalidPrimaryKey(id[key], pk.title);
      }
    }

    return where;
  }

  let ids = id;

  if (Array.isArray(id)) {
    ids = id;
  } else if (primaryKeys.length === 1) {
    ids = [id];
  } else {
    ids = (id + '').split('___').map((val) => val.replaceAll('\\_', '_'));
  }

  for (let i = 0; i < primaryKeys.length; ++i) {
    if (primaryKeys[i].dt === 'bytea') {
      // if column is bytea, then we need to encode the id to hex based on format
      // where[primaryKeys[i].column_name] =
      // (primaryKeys[i].meta?.format === 'hex' ? '\\x' : '') + ids[i];
      return (qb) => {
        qb.whereRaw(
          `?? = decode(?, '${
            primaryKeys[i].meta?.format === 'hex' ? 'hex' : 'escape'
          }')`,
          [primaryKeys[i].column_name, ids[i]],
        );
      };
    }

    // Cast the id to string.
    const idAsString = ids[i] + '';
    // Check if the id is a UUID and the column is binary(16)
    const isUUIDBinary16 =
      primaryKeys[i].ct === 'binary(16)' &&
      (idAsString.length === 36 || idAsString.length === 32);
    // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
    const idAsUUID = isUUIDBinary16
      ? idAsString.length === 32
        ? idAsString.replace(
            /(.{8})(.{4})(.{4})(.{4})(.{12})/,
            '$1-$2-$3-$4-$5',
          )
        : idAsString
      : null;

    where[primaryKeys[i].column_name] = idAsUUID
      ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
      : ids[i];
  }
  return where;
}

export function getCompositePkValue(primaryKeys: Column[], row) {
  if (row === null || row === undefined) {
    NcError.requiredFieldMissing(primaryKeys.map((c) => c.title).join(','));
  }

  if (typeof row !== 'object') return row;

  if (primaryKeys.length > 1) {
    return primaryKeys
      .map((c) =>
        (row[c.title] ?? row[c.column_name])
          ?.toString?.()
          .replaceAll('_', '\\_'),
      )
      .join('___');
  }

  return (
    primaryKeys[0] &&
    (row[primaryKeys[0].title] ?? row[primaryKeys[0].column_name])
  );
}

export function getOppositeRelationType(
  type: RelationTypes | LinkToAnotherRecordColumn['type'],
) {
  if (type === RelationTypes.HAS_MANY) {
    return RelationTypes.BELONGS_TO;
  } else if (type === RelationTypes.BELONGS_TO) {
    return RelationTypes.HAS_MANY;
  }
  return type as RelationTypes;
}

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
    },
  ) {}

  protected auditUpdateObj: AuditUpdateLog[] = [];

  getRelationContext() {
    return this.relationContext;
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
    const isBt =
      colOptions.type === RelationTypes.BELONGS_TO || column.meta?.bt;

    const childColumn = await colOptions.getChildColumn(baseModel.context);
    const parentColumn = await colOptions.getParentColumn(baseModel.context);
    const parentTable = await parentColumn.getModel(baseModel.context);
    const childTable = await childColumn.getModel(baseModel.context);
    await childTable.getColumns(baseModel.context);
    await parentTable.getColumns(baseModel.context);

    const parentBaseModel = await Model.getBaseModelSQL(baseModel.context, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childBaseModel = await Model.getBaseModelSQL(baseModel.context, {
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
        isBt || colOptions.type === RelationTypes.MANY_TO_MANY
          ? id.rowId
          : id.childId,
      parentId:
        isBt || colOptions.type === RelationTypes.MANY_TO_MANY
          ? id.childId
          : id.rowId,
    });
  }

  async getHmOrOoChildRow() {
    const { baseModel, childTn, childColumn, childTable, childId } =
      this.relationContext;
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
      baseModel,
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
    } = this.relationContext;
    const { onlyUpdateAuditLogs, req } = params;
    if (onlyUpdateAuditLogs && colOptions.type !== RelationTypes.BELONGS_TO) {
      return await this.handleOnlyUpdateAudit(params);
    }

    const webhookHandler = await RelationUpdateWebhookHandler.beginUpdate(
      {
        context: baseModel.context,
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
          const vChildCol = await colOptions.getMMChildColumn(
            baseModel.context,
          );
          const vParentCol = await colOptions.getMMParentColumn(
            baseModel.context,
          );
          const vTable = await colOptions.getMMModel(baseModel.context);

          const assocBaseModel = await Model.getBaseModelSQL(
            baseModel.context,
            {
              model: vTable,
              dbDriver: baseModel.dbDriver,
            },
          );

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
            await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
          await baseModel.updateLastModified({
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
          }

          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
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
          }

          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
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
          }
          // todo: unlink if it's already mapped
          // unlink already mapped record if any
          await baseModel.execAndParse(
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

          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
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
    } = this.relationContext;
    const { req } = params;

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(
            baseModel.context,
          );
          const vParentCol = await colOptions.getMMParentColumn(
            baseModel.context,
          );
          const vTable = await colOptions.getMMModel(baseModel.context);
          const assocBaseModel = await Model.getBaseModelSQL(
            baseModel.context,
            {
              model: vTable,
              dbDriver: baseModel.dbDriver,
            },
          );
          const vTn = assocBaseModel.getTnPath(vTable);

          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
          await baseModel.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [childId],
            cookie: req,
          });
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [parentId],
            cookie: req,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await baseModel.execAndParse(
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

          await baseModel.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie: req,
          });
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          await baseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .where(_wherePk(childTable.primaryKeys, childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await baseModel.updateLastModified({
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
    console.log(JSON.stringify(this.auditUpdateObj, null, 2));
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
