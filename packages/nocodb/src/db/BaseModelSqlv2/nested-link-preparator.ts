import { isLinkV2, type NcRequest, RelationTypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import {
  extractIdPropIfObjectOrReturn,
  getRelatedLinksColumn,
} from '~/helpers/dbHelpers';
import { type Column, type LinkToAnotherRecordColumn, Model } from '~/models';

export interface NestedLinkAuditEntry {
  columnTitle: string;
  columnId: string;
  refColumnTitle: string;
  model: Model;
  refModel: Model;
  // rowId is null when it depends on the inserted row's PK (resolved at call site)
  rowId: any | null;
  refRowId: any | null;
  // true = rowId is the inserted row's PK (resolved at call site)
  rowIdIsInsertedRow: boolean;
  refRowIdIsInsertedRow: boolean;
  type: RelationTypes;
  req: NcRequest;
}

export interface NestedLinkLastModifiedEntry {
  model: Model;
  refModel: Model;
  refBaseModel: IBaseModelSqlV2;
  col: Column;
  nestedData: any;
  req: NcRequest;
}

export class NestedLinkPreparator {
  async prepareNestedLinkQb(
    baseModel: IBaseModelSqlV2,
    {
      nestedCols,
      data,
      insertObj,
      req,
    }: {
      nestedCols: Column[];
      data: Record<string, any>;
      insertObj: Record<string, any>;
      req: NcRequest;
    },
  ) {
    const postInsertOps: ((rowId: any) => Promise<string>)[] = [];
    const preInsertOps: (() => Promise<string>)[] = [];
    const postInsertAuditEntries: NestedLinkAuditEntry[] = [];
    const postInsertLastModifiedEntries: NestedLinkLastModifiedEntry[] = [];
    for (const col of nestedCols) {
      if (col.title in data) {
        const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
          baseModel.context,
        );

        const { refContext } = colOptions.getRelContext(baseModel.context);

        const refModel = await Model.get(
          refContext,
          (colOptions as LinkToAnotherRecordColumn).fk_related_model_id,
        );
        await refModel.getCachedColumns(refContext);
        const refModelPkCol = await refModel.primaryKey;
        const refChildCol = getRelatedLinksColumn(col, refModel);

        // parse data if it's JSON string
        let nestedData;
        try {
          nestedData =
            typeof data[col.title] === 'string'
              ? JSON.parse(data[col.title])
              : data[col.title];
          if (nestedData.length === 0) {
            continue;
          }
        } catch {
          continue;
        }

        const refBaseModel = await Model.getBaseModelSQL(refContext, {
          model: refModel,
          dbDriver: baseModel.dbDriver,
        });

        // V2 OO uses junction table (like MO), not FK-based like V1 OO
        const effectiveType =
          isLinkV2(col) && colOptions.type === RelationTypes.ONE_TO_ONE
            ? RelationTypes.MANY_TO_ONE
            : colOptions.type;

        switch (effectiveType) {
          case RelationTypes.BELONGS_TO:
            {
              if (Array.isArray(nestedData)) {
                nestedData = nestedData[0];
              }

              const childCol = await colOptions.getChildColumn(
                baseModel.context,
              );
              const parentCol = await colOptions.getParentColumn(
                baseModel.context,
              );
              insertObj[childCol.column_name] = extractIdPropIfObjectOrReturn(
                nestedData,
                parentCol.title,
              );
              const refModel = await parentCol.getModel(baseModel.context);

              // Forward direction: inserted row → linked row
              postInsertAuditEntries.push({
                columnTitle: col.title,
                columnId: col.id,
                refColumnTitle: refChildCol.title,
                rowId: null,
                refRowId: nestedData?.[refModelPkCol.title],
                rowIdIsInsertedRow: true,
                refRowIdIsInsertedRow: false,
                model: baseModel.model,
                refModel,
                type: RelationTypes.BELONGS_TO,
                req,
              });

              // Reverse direction: linked row → inserted row
              postInsertAuditEntries.push({
                columnTitle: refChildCol.title,
                columnId: refChildCol.id,
                refColumnTitle: col.title,
                rowId: nestedData?.[refModelPkCol.title],
                refRowId: null,
                rowIdIsInsertedRow: false,
                refRowIdIsInsertedRow: true,
                model: refModel,
                refModel: baseModel.model,
                type: RelationTypes.HAS_MANY,
                req,
              });
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              if (Array.isArray(nestedData)) {
                nestedData = nestedData[0];
              }

              const isBt = col.meta?.bt;

              const childCol = await colOptions.getChildColumn(
                baseModel.context,
              );
              const childModel = await childCol.getModel(baseModel.context);
              await childModel.getColumns(baseModel.context);

              let refRowId;

              if (isBt) {
                // if array then extract value from first element
                refRowId = Array.isArray(nestedData)
                  ? nestedData[0]?.[childModel.primaryKey.title]
                  : nestedData[childModel.primaryKey.title];

                // todo: unlink the ref record
                preInsertOps.push(async () => {
                  const res = baseModel
                    .dbDriver(baseModel.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: null,
                    })
                    .where(childCol.column_name, refRowId)
                    .toQuery();

                  return res;
                });

                const childCol = await colOptions.getChildColumn(
                  baseModel.context,
                );
                const parentCol = await colOptions.getParentColumn(
                  baseModel.context,
                );

                insertObj[childCol.column_name] = extractIdPropIfObjectOrReturn(
                  nestedData,
                  parentCol.title,
                );
              } else {
                const parentCol = await colOptions.getParentColumn(
                  baseModel.context,
                );
                const parentModel = await parentCol.getModel(baseModel.context);
                await parentModel.getColumns(baseModel.context);
                refRowId = nestedData[childModel.primaryKey.title];

                postInsertOps.push(async (rowId) => {
                  let refId = rowId;
                  if (parentModel.primaryKey.id !== parentCol.id) {
                    refId = baseModel
                      .dbDriver(baseModel.getTnPath(parentModel.table_name))
                      .select(parentCol.column_name)
                      .where(parentModel.primaryKey.column_name, rowId)
                      .first();
                  }

                  const linkRecId = extractIdPropIfObjectOrReturn(
                    nestedData,
                    childModel.primaryKey.title,
                  );

                  return baseModel
                    .dbDriver(baseModel.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: refId,
                    })
                    .where(childModel.primaryKey.column_name, linkRecId)
                    .toQuery();
                });
              }

              postInsertAuditEntries.push({
                columnTitle: col.title,
                columnId: col.id,
                refColumnTitle: refChildCol.title,
                rowId: null,
                refRowId: nestedData[refModelPkCol?.title],
                rowIdIsInsertedRow: true,
                refRowIdIsInsertedRow: false,
                model: baseModel.model,
                refModel,
                type: RelationTypes.ONE_TO_ONE,
                req,
              });

              postInsertAuditEntries.push({
                columnTitle: refChildCol.title,
                columnId: refChildCol.id,
                refColumnTitle: col.title,
                rowId: nestedData[refModelPkCol?.title],
                refRowId: null,
                rowIdIsInsertedRow: false,
                refRowIdIsInsertedRow: true,
                model: refModel,
                refModel: baseModel.model,
                type: RelationTypes.ONE_TO_ONE,
                req,
              });
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              if (!Array.isArray(nestedData)) continue;
              const childCol = await colOptions.getChildColumn(
                baseModel.context,
              );
              const parentCol = await colOptions.getParentColumn(
                baseModel.context,
              );
              const childModel = await childCol.getModel(baseModel.context);
              const parentModel = await parentCol.getModel(baseModel.context);
              await childModel.getColumns(baseModel.context);
              await parentModel.getColumns(baseModel.context);

              postInsertOps.push(async (rowId) => {
                let refId = rowId;
                if (parentModel.primaryKey.id !== parentCol.id) {
                  refId = baseModel
                    .dbDriver(baseModel.getTnPath(parentModel.table_name))
                    .select(parentCol.column_name)
                    .where(parentModel.primaryKey.column_name, rowId)
                    .first();
                }
                return baseModel
                  .dbDriver(baseModel.getTnPath(childModel.table_name))
                  .update({
                    [childCol.column_name]: refId,
                  })
                  .whereIn(
                    childModel.primaryKey.column_name,
                    nestedData?.map((r) =>
                      extractIdPropIfObjectOrReturn(
                        r,
                        childModel.primaryKey.title,
                      ),
                    ),
                  )
                  .toQuery();
              });

              for (const nestedDataObj of nestedData) {
                if (nestedDataObj === undefined) continue;

                postInsertAuditEntries.push({
                  columnTitle: col.title,
                  columnId: col.id,
                  refColumnTitle: refChildCol.title,
                  rowId: null,
                  refRowId: nestedDataObj[refModelPkCol?.title],
                  rowIdIsInsertedRow: true,
                  refRowIdIsInsertedRow: false,
                  model: baseModel.model,
                  refModel,
                  type: RelationTypes.HAS_MANY,
                  req,
                });

                postInsertAuditEntries.push({
                  columnTitle: refChildCol.title,
                  columnId: refChildCol.id,
                  refColumnTitle: col.title,
                  rowId: nestedDataObj[refModelPkCol?.title],
                  refRowId: null,
                  rowIdIsInsertedRow: false,
                  refRowIdIsInsertedRow: true,
                  model: refModel,
                  refModel: baseModel.model,
                  type: RelationTypes.BELONGS_TO,
                  req,
                });
              }
            }
            break;
          case RelationTypes.ONE_TO_MANY: {
            // V2 OM uses junction table like MM — expects array input
            if (!Array.isArray(nestedData)) continue;

            // OM cardinality: each linked record can only link to ONE parent
            // Batch-delete existing junction rows for all children being linked
            postInsertOps.push(async (_rowId) => {
              const parentModel = await colOptions
                .getParentColumn(baseModel.context)
                .then((c) => c.getModel(baseModel.context));
              await parentModel.getColumns(baseModel.context);
              const parentMMCol = await colOptions.getMMParentColumn(
                baseModel.context,
              );
              const mmModel = await colOptions.getMMModel(baseModel.context);
              const targetIds = nestedData
                .map((nd) =>
                  extractIdPropIfObjectOrReturn(
                    nd,
                    parentModel.primaryKey.title,
                  ),
                )
                .filter(Boolean);
              if (!targetIds.length) return '';
              return baseModel
                .dbDriver(baseModel.getTnPath(mmModel.table_name))
                .whereIn(parentMMCol.column_name, targetIds)
                .del()
                .toQuery();
            });

            // Insert all junction rows
            postInsertOps.push(async (rowId) => {
              const parentModel = await colOptions
                .getParentColumn(baseModel.context)
                .then((c) => c.getModel(baseModel.context));
              await parentModel.getColumns(baseModel.context);
              const parentMMCol = await colOptions.getMMParentColumn(
                baseModel.context,
              );
              const childMMCol = await colOptions.getMMChildColumn(
                baseModel.context,
              );
              const mmModel = await colOptions.getMMModel(baseModel.context);

              const rows = nestedData.map((r) => ({
                [parentMMCol.column_name]: extractIdPropIfObjectOrReturn(
                  r,
                  parentModel.primaryKey.title,
                ),
                [childMMCol.column_name]: rowId,
              }));
              return baseModel
                .dbDriver(baseModel.getTnPath(mmModel.table_name))
                .insert(rows)
                .toQuery();
            });

            for (const nestedDataObj of nestedData) {
              if (nestedDataObj === undefined) continue;

              postInsertAuditEntries.push({
                columnTitle: col.title,
                columnId: col.id,
                refColumnTitle: refChildCol.title,
                rowId: null,
                refRowId: nestedDataObj[refModelPkCol?.title],
                rowIdIsInsertedRow: true,
                refRowIdIsInsertedRow: false,
                model: baseModel.model,
                refModel,
                type: RelationTypes.ONE_TO_MANY,
                req,
              });

              postInsertAuditEntries.push({
                columnTitle: refChildCol.title,
                columnId: refChildCol.id,
                refColumnTitle: col.title,
                rowId: nestedDataObj[refModelPkCol?.title],
                refRowId: null,
                rowIdIsInsertedRow: false,
                refRowIdIsInsertedRow: true,
                model: refModel,
                refModel: baseModel.model,
                type: RelationTypes.MANY_TO_ONE,
                req,
              });
            }
            break;
          }
          case RelationTypes.MANY_TO_ONE: {
            // V2 MO uses junction table like MM — expects single object
            if (Array.isArray(nestedData)) {
              nestedData = nestedData[0];
            }

            // OO cardinality: target can only be linked to ONE source
            // Remove existing junction rows where target is already linked
            if (colOptions.type === RelationTypes.ONE_TO_ONE) {
              const _nestedData = nestedData;
              postInsertOps.push(async (_rowId) => {
                const parentMMCol = await colOptions.getMMParentColumn(
                  baseModel.context,
                );
                const parentModel = await colOptions
                  .getParentColumn(baseModel.context)
                  .then((c) => c.getModel(baseModel.context));
                await parentModel.getColumns(baseModel.context);
                const mmModel = await colOptions.getMMModel(baseModel.context);
                const targetId = extractIdPropIfObjectOrReturn(
                  _nestedData,
                  parentModel.primaryKey.title,
                );
                return baseModel
                  .dbDriver(baseModel.getTnPath(mmModel.table_name))
                  .where(parentMMCol.column_name, targetId)
                  .del()
                  .toQuery();
              });
            }

            // MO cardinality: this child can only link to ONE parent
            // Remove existing junction rows for this child (no-op for new rows)
            postInsertOps.push(async (rowId) => {
              const childMMCol = await colOptions.getMMChildColumn(
                baseModel.context,
              );
              const mmModel = await colOptions.getMMModel(baseModel.context);
              return baseModel
                .dbDriver(baseModel.getTnPath(mmModel.table_name))
                .where(childMMCol.column_name, rowId)
                .del()
                .toQuery();
            });

            // Insert the new junction row
            postInsertOps.push(async (rowId) => {
              const parentModel = await colOptions
                .getParentColumn(baseModel.context)
                .then((c) => c.getModel(baseModel.context));
              await parentModel.getColumns(baseModel.context);
              const parentMMCol = await colOptions.getMMParentColumn(
                baseModel.context,
              );
              const childMMCol = await colOptions.getMMChildColumn(
                baseModel.context,
              );
              const mmModel = await colOptions.getMMModel(baseModel.context);

              return baseModel
                .dbDriver(baseModel.getTnPath(mmModel.table_name))
                .insert({
                  [parentMMCol.column_name]: extractIdPropIfObjectOrReturn(
                    nestedData,
                    parentModel.primaryKey.title,
                  ),
                  [childMMCol.column_name]: rowId,
                })
                .toQuery();
            });

            postInsertAuditEntries.push({
              columnTitle: col.title,
              columnId: col.id,
              refColumnTitle: refChildCol.title,
              rowId: null,
              refRowId: nestedData?.[refModelPkCol?.title],
              rowIdIsInsertedRow: true,
              refRowIdIsInsertedRow: false,
              model: baseModel.model,
              refModel,
              type: RelationTypes.MANY_TO_ONE,
              req,
            });

            postInsertAuditEntries.push({
              columnTitle: refChildCol.title,
              columnId: refChildCol.id,
              refColumnTitle: col.title,
              rowId: nestedData?.[refModelPkCol?.title],
              refRowId: null,
              rowIdIsInsertedRow: false,
              refRowIdIsInsertedRow: true,
              model: refModel,
              refModel: baseModel.model,
              type: RelationTypes.ONE_TO_MANY,
              req,
            });
            break;
          }
          case RelationTypes.MANY_TO_MANY: {
            if (!Array.isArray(nestedData)) continue;
            postInsertOps.push(async (rowId) => {
              const parentModel = await colOptions
                .getParentColumn(baseModel.context)
                .then((c) => c.getModel(baseModel.context));
              await parentModel.getColumns(baseModel.context);
              const parentMMCol = await colOptions.getMMParentColumn(
                baseModel.context,
              );
              const childMMCol = await colOptions.getMMChildColumn(
                baseModel.context,
              );
              const mmModel = await colOptions.getMMModel(baseModel.context);

              const rows = nestedData.map((r) => ({
                [parentMMCol.column_name]: extractIdPropIfObjectOrReturn(
                  r,
                  parentModel.primaryKey.title,
                ),
                [childMMCol.column_name]: rowId,
              }));
              return baseModel
                .dbDriver(baseModel.getTnPath(mmModel.table_name))
                .insert(rows)
                .toQuery();
            });

            for (const nestedDataObj of nestedData) {
              if (nestedDataObj === undefined) continue;

              postInsertAuditEntries.push({
                columnTitle: col.title,
                columnId: col.id,
                refColumnTitle: refChildCol.title,
                rowId: null,
                refRowId: nestedDataObj[refModelPkCol?.title],
                rowIdIsInsertedRow: true,
                refRowIdIsInsertedRow: false,
                model: baseModel.model,
                refModel,
                type: RelationTypes.MANY_TO_MANY,
                req,
              });

              postInsertAuditEntries.push({
                columnTitle: refChildCol.title,
                columnId: refChildCol.id,
                refColumnTitle: col.title,
                rowId: nestedDataObj[refModelPkCol?.title],
                refRowId: null,
                rowIdIsInsertedRow: false,
                refRowIdIsInsertedRow: true,
                model: refModel,
                refModel: baseModel.model,
                type: RelationTypes.MANY_TO_MANY,
                req,
              });
            }
          }
        }

        // update lastModified details in tables
        postInsertLastModifiedEntries.push({
          model: baseModel.model,
          refModel,
          refBaseModel,
          col,
          nestedData,
          req,
        });
      }
    }
    return {
      postInsertOps,
      preInsertOps,
      postInsertAuditEntries,
      postInsertLastModifiedEntries,
    };
  }
}
