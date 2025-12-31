import {
  AuditV1OperationTypes,
  isLinksOrLTAR,
  ncIsNullOrUndefined,
  RelationTypes,
} from 'nocodb-sdk';
import type { AuditOperationSubTypes, NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  _wherePk,
  dataWrapper,
  extractIds,
  getOppositeRelationType,
  getRelatedLinksColumn,
} from '~/helpers/dbHelpers';
import { Model } from '~/models';

/**
 * Extract the corresponding link column in the referencing table using a given LTAR column and the referenced table
 * @param context - The NcContext
 * @param param - Object containing ltarColumn and optionally referencedTable or referencedTableColumns
 * @returns The corresponding link column in the referenced table, or null if not found
 */
export const extractCorrespondingLinkColumn = async (
  context: NcContext,
  param: {
    ltarColumn: Column;
    referencedTable?: Model;
    referencedTableColumns?: Column[];
  },
): Promise<Column | null> => {
  const { ltarColumn } = param;

  if (!isLinksOrLTAR(ltarColumn)) {
    return null;
  }

  const colOptions = await ltarColumn.getColOptions(context);

  const { refContext } = colOptions.getRelContext(context);

  // Get the table that contains the LTAR column
  const sourceTableId = ltarColumn.fk_model_id;

  // Get columns from the referenced table or use provided columns
  let columnsInReferencedTable: Column[];
  if (param.referencedTableColumns) {
    columnsInReferencedTable = param.referencedTableColumns;
  } else if (param.referencedTable) {
    columnsInReferencedTable =
      param.referencedTable.columns ||
      (await param.referencedTable.getColumns(refContext));
  } else {
    // Extract referenced table columns from ref table ID if not provided
    const refTableId = colOptions.fk_related_model_id;
    const refTable = await Model.get(context, refTableId);
    columnsInReferencedTable =
      refTable.columns || (await refTable.getColumns(refContext));
  }

  // Find the corresponding link column based on the relation type
  for (const column of columnsInReferencedTable) {
    if (!isLinksOrLTAR(column)) continue;

    const passContext =
      column.base_id === refContext.base_id ? refContext : context;

    const refColOptions = await column.getColOptions(passContext);

    // Check if this column links back to the source table
    if (refColOptions.fk_related_model_id !== sourceTableId) continue;

    // Handle different relation types
    switch (colOptions.type) {
      case RelationTypes.HAS_MANY:
        // For HM, the referenced table should have a BT column and parent child will remain same
        if (
          refColOptions.type === RelationTypes.BELONGS_TO &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.BELONGS_TO:
        // For BT, the referenced table should have an HM column, and parent child will remain same
        if (
          refColOptions.type === RelationTypes.HAS_MANY &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.ONE_TO_ONE:
        // For OO, the referenced table should have an OO column and parent child will remain same
        if (
          refColOptions.type === RelationTypes.ONE_TO_ONE &&
          refColOptions.fk_child_column_id === colOptions.fk_child_column_id &&
          refColOptions.fk_parent_column_id === colOptions.fk_parent_column_id
        ) {
          return column;
        }
        break;

      case RelationTypes.MANY_TO_MANY:
        // For MM, check if the referenced table has an MM column that references the same junction table
        // and the parent-child columns are swapped
        if (
          refColOptions.type === RelationTypes.MANY_TO_MANY &&
          refColOptions.fk_mm_model_id === colOptions.fk_mm_model_id && // Same junction table
          refColOptions.fk_related_model_id === sourceTableId
        ) {
          // Additional check for MM columns to ensure they're properly linked
          // The junction table ID (fk_mm_model_id) is already verified above
          if (
            refColOptions.fk_mm_parent_column_id ===
              colOptions.fk_mm_child_column_id &&
            refColOptions.fk_mm_child_column_id ===
              colOptions.fk_mm_parent_column_id
          ) {
            return column;
          }
        }
        break;
    }
  }

  return null;
};

/**
 * Transaction Handling Strategy for Link Operations:
 *
 * This module handles adding and removing links between records. To prevent transaction
 * conflicts and ensure reliable broadcasting of link updates, we use a specific pattern:
 *
 * 1. Core link operations (insert/delete) run within the main transaction
 * 2. Broadcasting operations use non-transactional clones to avoid conflicts
 * 3. This separation ensures that broadcasting doesn't interfere with the main
 *    transaction's commit/rollback behavior
 *
 * The getNonTransactionalClone() method creates a new BaseModelSqlv2 instance
 * that uses the base database driver instead of any active transaction, allowing
 * broadcasting operations to run independently.
 */

export const addOrRemoveLinks = (baseModel: IBaseModelSqlV2) => {
  const validateRefIds = (
    refIds: (string | number | Record<string, any>)[],
    refModel: Model,
  ) => {
    for (const refId of Array.isArray(refIds) ? refIds : [refIds]) {
      if (typeof refId === 'object') {
        for (const primaryKey of refModel.primaryKeys) {
          if (
            ncIsNullOrUndefined(
              dataWrapper(refId).getByColumnNameTitleOrId(primaryKey),
            )
          ) {
            NcError.get(baseModel.context).unprocessableEntity(
              `Validation failed: Missing primary key column "${
                primaryKey.title
              }" in request for model "${
                refModel.title
              }". RefId: ${JSON.stringify(refId)}`,
            );
          }
        }
      } else if (ncIsNullOrUndefined(refId)) {
        NcError.get(baseModel.context).unprocessableEntity(
          `Validation failed: Invalid id "${JSON.stringify(
            refId,
          )}" for model "${refModel.title}".`,
        );
      }
    }
  };

  const addLinks = async ({
    cookie,
    childIds: _childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
  }) => {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column))
      NcError.get(baseModel.context).fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.get(baseModel.context).recordNotFound(rowId);
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

      validateRefIds(
        childIds,
        relationType === RelationTypes.BELONGS_TO ? parentTable : childTable,
      );

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
          validateRefIds(childIds, parentTable);

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
                  ? childIds.map((c) =>
                      dataWrapper(c).getByColumnNameTitleOrId(
                        parentTable.primaryKey,
                      ),
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

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
            }

            insertData = childRows
              // skip existing links
              .filter((childRow) => !childRow[vChildCol.column_name])
              // generate insert data for new links
              .map((childRow) => ({
                [vParentCol.column_name]:
                  dataWrapper(childRow).getByColumnNameTitleOrId(parentColumn),
                [vChildCol.column_name]:
                  dataWrapper(row).getByColumnNameTitleOrId(childColumn),
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
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: parentTable,
                  referencedTableColumns: parentTable.columns,
                })
              )?.id,
            ],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates(childIds as string[]);
          });

          await childBaseModel.updateLastModified({
            model: childTable,
            updatedColIds: [column.id],
            rowIds: [rowId],
            cookie,
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId]);
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          validateRefIds(childIds, childTable);
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
                  ? childIds.map((c) =>
                      dataWrapper(c).getByColumnNameTitleOrId(
                        parentTable.primaryKey,
                      ),
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

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
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
                ? childIds.map((c) =>
                    dataWrapper(c).getByColumnNameTitleOrId(
                      childTable.primaryKey,
                    ),
                  )
                : childIds,
            );
          }
          await baseModel.execAndParse(updateQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId]);
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          validateRefIds(childIds, parentTable);
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
              NcError.get(baseModel.context).recordNotFound(
                extractIds(childIds, true),
              );
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
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId]);
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
            dataWrapper(row).getByColumnNameTitleOrId(childColumn),
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    baseModel.dbDriver.attachToTransaction(async () => {
      const baseModelClone = baseModel.getNonTransactionalClone();
      await baseModelClone.afterAddOrRemoveChild(
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
      await baseModelClone.afterAddOrRemoveChild(
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
    });
  };

  const removeLinks = async ({
    cookie,
    childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
  }) => {
    await baseModel.model.getColumns(baseModel.context);
    const column = baseModel.model.columnsById[colId];

    if (!column || !isLinksOrLTAR(column))
      NcError.get(baseModel.context).fieldNotFound(colId);

    const row = await baseModel.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.get(baseModel.context).recordNotFound(rowId);
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
          validateRefIds(childIds, parentTable);
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
                childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
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
                        ? dataWrapper(id).getByColumnNameTitleOrId(
                            parentTable.primaryKey,
                          )
                        : id),
                  ),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
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
              ? childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
                )
              : childIds,
          );
          await refBaseModel.execAndParse(delQb, null, { raw: true });

          await parentBaseModel.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: childTable,
                  referencedTableColumns: childTable.columns,
                })
              )?.id,
            ],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates(childIds as string[]);
          });

          await childBaseModel.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await childBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId]);
          });

          auditConfig.parentModel =
            baseModel.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            baseModel.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          validateRefIds(childIds, childTable);
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
                childIds.map((c) =>
                  dataWrapper(c).getByColumnNameTitleOrId(
                    parentTable.primaryKey,
                  ),
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
                        ? dataWrapper(id).getByColumnNameTitleOrId(
                            parentTable.primaryKey,
                          )
                        : id),
                  ),
              );

              NcError.get(baseModel.context).recordNotFound(
                extractIds(missingIds),
              );
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
                ? childIds.map((c) =>
                    dataWrapper(c).getByColumnNameTitleOrId(
                      parentTable.primaryKey,
                    ),
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
            updatedColIds: [column.id],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([rowId]);
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          validateRefIds(childIds, parentTable);
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          const refBaseModel = parentBaseModel;
          // validate Ids
          {
            if (childIds.length > 1)
              NcError.get(baseModel.context).unprocessableEntity(
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
              NcError.get(baseModel.context).recordNotFound(
                extractIds(childIds, true),
              );
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
            updatedColIds: [
              (
                await extractCorrespondingLinkColumn(baseModel.context, {
                  ltarColumn: column,
                  referencedTable: childTable,
                })
              )?.id,
            ],
          });

          baseModel.dbDriver.attachToTransaction(async () => {
            await parentBaseModel
              .getNonTransactionalClone()
              .broadcastLinkUpdates([childIds[0] as string]);
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
        displayValue: dataWrapper(row).getByColumnNameTitleOrId(column),
        type: colOptions.type as RelationTypes,
      });

      if (parentTable.id !== childTable.id) {
        childAuditObj.push({
          rowId: _childId,
          refRowId: rowId,
          refDisplayValue:
            dataWrapper(row).getByColumnNameTitleOrId(childColumn),
          type: getOppositeRelationType(colOptions.type),
        });
      }
    }

    baseModel.dbDriver.attachToTransaction(async () => {
      await parentBaseModel.getNonTransactionalClone().afterAddOrRemoveChild(
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
      await childBaseModel.getNonTransactionalClone().afterAddOrRemoveChild(
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
    });
  };
  return {
    addLinks,
    removeLinks,
    extractCorrespondingLinkColumn,
  };
};
