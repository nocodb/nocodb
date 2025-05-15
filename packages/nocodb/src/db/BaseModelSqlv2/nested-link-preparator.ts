import { type NcRequest, RelationTypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import {
  extractIdPropIfObjectOrReturn,
  getRelatedLinksColumn,
} from '~/helpers/dbHelpers';
import { type Column, type LinkToAnotherRecordColumn, Model } from '~/models';

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
    const postInsertAuditOps: ((rowId: any) => Promise<void>)[] = [];
    for (const col of nestedCols) {
      if (col.title in data) {
        const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
          baseModel.context,
        );

        const refModel = await Model.get(
          baseModel.context,
          (colOptions as LinkToAnotherRecordColumn).fk_related_model_id,
        );
        await refModel.getCachedColumns(baseModel.context);
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

        switch (colOptions.type) {
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
              postInsertAuditOps.push(async (rowId) => {
                await baseModel.afterAddChild({
                  columnTitle: col.title,
                  columnId: col.id,
                  refColumnTitle: refChildCol.title,
                  rowId,
                  refRowId: nestedData?.[refModelPkCol.title],
                  req,
                  model: baseModel.model,
                  refModel,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.BELONGS_TO,
                });

                await baseModel.afterAddChild({
                  columnTitle: refChildCol.title,
                  columnId: refChildCol.id,
                  refColumnTitle: col.title,
                  rowId: nestedData?.[refModelPkCol.title],
                  refRowId: rowId,
                  req,
                  model: refModel,
                  refModel: baseModel.model,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.HAS_MANY,
                });
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

              postInsertAuditOps.push(async (rowId) => {
                await baseModel.afterAddChild({
                  columnTitle: col.title,
                  columnId: col.id,
                  refColumnTitle: refChildCol.title,
                  rowId,
                  refRowId: nestedData[refModelPkCol?.title],
                  req,
                  model: baseModel.model,
                  refModel,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.ONE_TO_ONE,
                });

                await baseModel.afterAddChild({
                  columnTitle: refChildCol.title,
                  columnId: refChildCol.id,
                  refColumnTitle: col.title,
                  rowId: nestedData[refModelPkCol?.title],
                  refRowId: rowId,
                  req,
                  model: refModel,
                  refModel: baseModel.model,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.ONE_TO_ONE,
                });
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

              postInsertAuditOps.push(async (rowId) => {
                for (const nestedDataObj of Array.isArray(nestedData)
                  ? nestedData
                  : [nestedData]) {
                  if (nestedDataObj === undefined) continue;
                  await baseModel.afterAddChild({
                    columnTitle: col.title,
                    columnId: col.id,
                    refColumnTitle: refChildCol.title,
                    rowId,
                    refRowId: nestedDataObj[refModelPkCol?.title],
                    req,
                    model: baseModel.model,
                    refModel,
                    refDisplayValue: '',
                    displayValue: '',
                    type: RelationTypes.HAS_MANY,
                  });

                  await baseModel.afterAddChild({
                    columnTitle: refChildCol.title,
                    columnId: refChildCol.id,
                    refColumnTitle: col.title,
                    rowId: nestedDataObj[refModelPkCol?.title],
                    refRowId: rowId,
                    req,
                    model: refModel,
                    refModel: baseModel.model,
                    refDisplayValue: '',
                    displayValue: '',
                    type: RelationTypes.BELONGS_TO,
                  });
                }
              });
            }
            break;
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

            postInsertAuditOps.push(async (rowId) => {
              for (const nestedDataObj of Array.isArray(nestedData)
                ? nestedData
                : [nestedData]) {
                if (nestedDataObj === undefined) continue;
                await baseModel.afterAddChild({
                  columnTitle: col.title,
                  columnId: col.id,
                  refColumnTitle: refChildCol.title,
                  rowId,
                  refRowId: nestedDataObj[refModelPkCol?.title],
                  req,
                  model: baseModel.model,
                  refModel,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.MANY_TO_MANY,
                });

                await baseModel.afterAddChild({
                  columnTitle: refChildCol.title,
                  columnId: refChildCol.id,
                  refColumnTitle: col.title,
                  rowId: nestedDataObj[refModelPkCol?.title],
                  refRowId: rowId,
                  req,
                  model: refModel,
                  refModel: baseModel.model,
                  refDisplayValue: '',
                  displayValue: '',
                  type: RelationTypes.MANY_TO_MANY,
                });
              }
            });
          }
        }
      }
    }
    return { postInsertOps, preInsertOps, postInsertAuditOps };
  }
}
