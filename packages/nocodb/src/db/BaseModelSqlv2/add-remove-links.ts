import {
  AuditV1OperationTypes,
  isLinksOrLTAR,
  RelationTypes,
} from 'nocodb-sdk';
import type { AuditOperationSubTypes, NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  _wherePk,
  extractIds,
  getOppositeRelationType,
  getRelatedLinksColumn,
} from '~/helpers/dbHelpers';
import { Model } from '~/models';

export const addOrRemoveLinks = (baseModel: IBaseModelSqlV2) => {
  const addLinks = async ({
    cookie,
    childIds: _childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) => {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column)) NcError.fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.recordNotFound(rowId);
    }

    if (!_childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      baseModel.context,
    );

    const { childContext, parentContext, mmContext } =
      await colOptions.getParentChildContext(baseModel.context);

    const childColumn = await colOptions.getChildColumn(childContext);
    const parentColumn = await colOptions.getParentColumn(parentContext);
    const parentTable = await parentColumn.getModel(parentContext);
    const childTable = await childColumn.getModel(childContext);
    await childTable.getColumns(childContext);
    await parentTable.getColumns(parentContext);

    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childTable,
      dbDriver: baseModel.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    let relationType = colOptions.type;
    let childIds = _childIds;

    const relatedChildCol = getRelatedLinksColumn(
      column,
      baseModel.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
      childColId: relatedChildCol?.id || '',
      parentColId: column.id,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
      childColId: string;
      parentColId: string;
    };

    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = column.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
      childIds = childIds.slice(0, 1);

      // unlink
      await baseModel.execAndParse(
        baseModel
          .dbDriver(childTn)
          .where({
            [childColumn.column_name]: baseModel.dbDriver.from(
              baseModel
                .dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(
                  _wherePk(
                    parentTable.primaryKeys,
                    column.meta?.bt ? childIds[0] : rowId,
                  ),
                )
                .first()
                .as('___cn_alias'),
            ),
          })
          .update({ [childColumn.column_name]: null }),
        null,
        { raw: true },
      );

      auditConfig.parentModel = column.meta?.bt ? childTable : parentTable;
      auditConfig.childModel = column.meta?.bt ? parentTable : childTable;
    }

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

          const refBaseModel = parentBaseModel;

          const vTn = assocBaseModel.getTnPath(vTable);

          let insertData: Record<string, any>[];

          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(`${parentTn}.${parentColumn.column_name}`)
              .select(`${vTn}.${vChildCol.column_name}`)
              .leftJoin(vTn, (qb) => {
                qb.on(
                  `${vTn}.${vParentCol.column_name}`,
                  `${parentTn}.${parentColumn.column_name}`,
                ).andOn(
                  `${vTn}.${vChildCol.column_name}`,
                  baseModel.dbDriver.raw('?', [
                    row[childColumn.title] ?? row[childColumn.column_name],
                  ]),
                );
              });

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                typeof childIds[0] === 'object'
                  ? childIds.map(
                      (c) =>
                        c[parentTable.primaryKey.title] ??
                        c[parentTable.primaryKey.column_name],
                    )
                  : childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }

            insertData = childRows
              // skip existing links
              .filter((childRow) => !childRow[vChildCol.column_name])
              // generate insert data for new links
              .map((childRow) => ({
                [vParentCol.column_name]:
                  childRow[parentColumn.title] ??
                  childRow[parentColumn.column_name],
                [vChildCol.column_name]:
                  row[childColumn.title] ?? row[childColumn.column_name],
              }));

            // if no new links, return true
            if (!insertData.length) return true;
          }

          // todo: use bulk insert
          await baseModel.execAndParse(
            baseModel.dbDriver(vTn).insert(insertData),
            null,
            {
              raw: true,
            },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
          });

          await childBaseModel.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(childTn)
              .select(childTable.primaryKey.column_name);

            if (childTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(childTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                typeof childIds[0] === 'object'
                  ? childIds.map(
                      (c) =>
                        c[parentTable.primaryKey.title] ??
                        c[parentTable.primaryKey.column_name],
                    )
                  : childIds,
              );
            }

            const childRows = await childBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }
          const updateQb = baseModel.dbDriver(childTn).update({
            [childColumn.column_name]: baseModel.dbDriver.from(
              baseModel
                .dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, rowId))
                .first()
                .as('___cn_alias'),
            ),
          });
          if (childTable.primaryKeys.length > 1) {
            updateQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(childTable.primaryKeys, childId));
              }
            });
          } else {
            updateQb.whereIn(
              childTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map(
                    (c) =>
                      c[childTable.primaryKey.title] ??
                      c[childTable.primaryKey.column_name],
                  )
                : childIds,
            );
          }
          await baseModel.execAndParse(updateQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;
          const refBaseModel = parentBaseModel;
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(parentTable.primaryKey.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]))
              .first();

            const childRow = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                first: true,
                raw: true,
              },
            );

            if (!childRow) {
              NcError.recordNotFound(extractIds(childIds, true));
            }
          }

          await childBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              .update({
                [childColumn.column_name]: baseModel.dbDriver.from(
                  baseModel
                    .dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, childIds[0]))
                    // .whereIn(parentTable.primaryKey.column_name, childIds)
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, rowId)),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
    }

    const parentAuditObj = [];
    const childAuditObj = [];

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? childBaseModel.extractPksValues(childId, true)
          : childId;

      parentAuditObj.push({
        rowId,
        refRowId: _childId,
        displayValue: row[column.title] ?? row[column.column_name],
        type: colOptions.type as RelationTypes,
      });

      if (parentTable.id !== childTable.id) {
        childAuditObj.push({
          rowId: _childId,
          refRowId: rowId,
          refDisplayValue:
            row[childColumn.title] ?? row[childColumn.column_name],
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    await baseModel.afterAddOrRemoveChild(
      {
        opType: AuditV1OperationTypes.DATA_LINK,
        model: auditConfig.parentModel,
        refModel: auditConfig.childModel,
        columnTitle: auditConfig.parentColTitle,
        columnId: auditConfig.parentColId,
        refColumnTitle: auditConfig.childColTitle,
        refColumnId: auditConfig.childColId,
        req: cookie,
      },
      parentAuditObj,
    );
    await baseModel.afterAddOrRemoveChild(
      {
        opType: AuditV1OperationTypes.DATA_LINK,
        model: auditConfig.childModel,
        refModel: auditConfig.parentModel,
        columnTitle: auditConfig.childColTitle,
        columnId: auditConfig.childColId,
        refColumnTitle: auditConfig.parentColTitle,
        refColumnId: auditConfig.parentColId,
        req: cookie,
      },
      childAuditObj,
    );
  };

  const removeLinks = async ({
    cookie,
    childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) => {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column)) NcError.fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.recordNotFound(rowId);
    }

    if (!childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      baseModel.context,
    );

    const { parentContext, childContext, mmContext } =
      await colOptions.getParentChildContext(baseModel.context);

    const childColumn = await colOptions.getChildColumn(childContext);
    const parentColumn = await colOptions.getParentColumn(parentContext);
    const parentTable = await parentColumn.getModel(parentContext);
    const childTable = await childColumn.getModel(childContext);
    await childTable.getColumns(childContext);
    await parentTable.getColumns(parentContext);

    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childTable,
      dbDriver: baseModel.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentTable,
      dbDriver: baseModel.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const relatedChildCol = getRelatedLinksColumn(
      column,
      baseModel.model.id === parentTable.id ? childTable : parentTable,
    );

    const _auditUpdateObj = [] as {
      columnTitle: string;
      columnId: string;
      refColumnTitle?: string;
      rowId: unknown;
      refRowId: unknown;
      req: NcRequest;
      model: Model;
      refModel?: Model;
      displayValue?: unknown;
      refDisplayValue?: unknown;
      opSubType:
        | AuditOperationSubTypes.LINK_RECORD
        | AuditOperationSubTypes.UNLINK_RECORD;
      type: RelationTypes;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
      childColId: relatedChildCol?.id || '',
      parentColId: column.id,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      childColId: string;
      parentColTitle: string;
      parentColId: string;
    };

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
          const refBaseModel = parentBaseModel;

          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(parentColumn.column_name);

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ||
                    c[parentTable.primaryKey.column_name],
                ),
              );
            } else {
              childRowsQb.whereIn(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
                childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTn}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? id[parentTable.primaryKey.title] ??
                          id[parentTable.primaryKey.column_name]
                        : id),
                  ),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }

          const vTn = assocBaseModel.getTnPath(vTable);

          const delQb = baseModel
            .dbDriver(vTn)
            .where({
              [vChildCol.column_name]: baseModel
                .dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first(),
            })
            .delete();

          delQb.whereIn(
            `${vTable.table_name}.${vParentCol.column_name}`,
            typeof childIds[0] === 'object'
              ? childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ??
                    c[parentTable.primaryKey.column_name],
                )
              : childIds,
          );
          await refBaseModel.execAndParse(delQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
          });
          await childBaseModel.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          // validate Ids
          {
            const childRowsQb = baseModel
              .dbDriver(childTn)
              .select(childTable.primaryKey.column_name);

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ??
                    c[parentTable.primaryKey.column_name],
                ),
              );
            } else {
              childRowsQb.whereIn(parentTable.primaryKey.column_name, childIds);
            }

            const childRows = await childBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                raw: true,
              },
            );

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? id[parentTable.primaryKey.title] ??
                          id[parentTable.primaryKey.column_name]
                        : id),
                  ),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }

          const childRowsQb = baseModel.dbDriver(childTn);

          if (parentTable.primaryKeys.length > 1) {
            childRowsQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
              }
            });
          } else {
            childRowsQb.whereIn(
              parentTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map(
                    (c) =>
                      c[parentTable.primaryKey.title] ??
                      c[parentTable.primaryKey.column_name],
                  )
                : childIds,
            );
          }

          await childBaseModel.execAndParse(
            childRowsQb.update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          const refBaseModel = parentBaseModel;
          // validate Ids
          {
            if (childIds.length > 1)
              NcError.unprocessableEntity(
                'Request must contain only one parent id',
              );

            const childRowsQb = baseModel
              .dbDriver(parentTn)
              .select(parentTable.primaryKey.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]))
              .first();

            const childRow = await refBaseModel.execAndParse(
              childRowsQb,
              null,
              {
                first: true,
                raw: true,
              },
            );

            if (!childRow) {
              NcError.recordNotFound(extractIds(childIds, true));
            }
          }

          await refBaseModel.execAndParse(
            baseModel
              .dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: baseModel.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, childId)
              //     .first()
              // })
              // .where(_wherePk(childTable.primaryKeys, rowId))
              .where(childTable.primaryKey.column_name, rowId)
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [childIds[0]],
            cookie,
          });
        }
        break;
    }

    const parentAuditObj = [];
    const childAuditObj = [];

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? childBaseModel.extractPksValues(childId, true)
          : childId;

      parentAuditObj.push({
        rowId,
        refRowId: _childId,
        displayValue: row[column.title] ?? row[column.column_name],
        type: colOptions.type as RelationTypes,
      });

      if (parentTable.id !== childTable.id) {
        childAuditObj.push({
          rowId: _childId,
          refRowId: rowId,
          refDisplayValue:
            row[childColumn.title] ?? row[childColumn.column_name],
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    await parentBaseModel.afterAddOrRemoveChild(
      {
        opType: AuditV1OperationTypes.DATA_UNLINK,
        model: auditConfig.parentModel,
        refModel: auditConfig.childModel,
        columnTitle: auditConfig.parentColTitle,
        columnId: auditConfig.parentColId,
        refColumnTitle: auditConfig.childColTitle,
        refColumnId: auditConfig.childColId,
        req: cookie,
      },
      parentAuditObj,
    );
    await childBaseModel.afterAddOrRemoveChild(
      {
        opType: AuditV1OperationTypes.DATA_UNLINK,
        model: auditConfig.childModel,
        refModel: auditConfig.parentModel,
        columnTitle: auditConfig.childColTitle,
        columnId: auditConfig.childColId,
        refColumnTitle: auditConfig.parentColTitle,
        refColumnId: auditConfig.parentColId,
        req: cookie,
      },
      childAuditObj,
    );
  };
  return {
    addLinks,
    removeLinks,
  };
};
