import { isLinksOrLTAR, parseProp, RelationTypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import { relationDataFetcher } from '~/db/BaseModelSqlv2/relation-data-fetcher';
import { dataWrapper } from '~/helpers/dbHelpers';
import { Profiler } from '~/helpers/profiler';
import { Model } from '~/models';

// for v3 bulk update with ltar links
export const LTARColsUpdater = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  const { baseModel, logger } = param;
  const update = async ({
    datas,
    cookie,
  }: {
    datas: any[];
    cookie: NcRequest;
  }) => {
    const profiler = Profiler.start(`base-model/updateLTARCols`);
    const linksOrLtarColumns = baseModel.model.columns.filter((col) =>
      isLinksOrLTAR(col),
    );
    if (!linksOrLtarColumns?.length) {
      return;
    }
    const linkDataPayloadMap: Map<
      string,
      {
        relatedModel: Model;
        column: Column;
        colOptions: LinkToAnotherRecordColumn;
        data: {
          rowId: string;
          links: string[];
        }[];
      }
    > = new Map();

    for (const col of linksOrLtarColumns) {
      const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
        baseModel.context,
      );
      const relatedModel = await colOptions.getRelatedTable({
        workspace_id: baseModel.context.workspace_id,
        base_id: colOptions.fk_related_base_id ?? baseModel.context.base_id,
      });
      await relatedModel.getColumns({
        workspace_id: baseModel.context.workspace_id,
        base_id: relatedModel.base_id,
      });
      for (const d of datas) {
        const colValue = dataWrapper(d).getByColumnNameTitleOrId(col);
        if (colValue) {
          const colValueAsPk = (Array.isArray(colValue) ? colValue : [colValue])
            .map(
              (cv) =>
                dataWrapper(cv).extractPksValue(relatedModel, true) as string,
            )
            .filter((k) => k);
          // either colValueAsPk is array with value, or colValue is empty array
          if (colValueAsPk?.length || Array.isArray(colValue)) {
            if (!linkDataPayloadMap.has(col.id)) {
              linkDataPayloadMap.set(col.id, {
                relatedModel,
                column: col,
                colOptions,
                data: [],
              });
            }
            linkDataPayloadMap.get(col.id).data.push({
              rowId: dataWrapper(d).extractPksValue(baseModel.model, true),
              links: colValueAsPk,
            });
          }
        }
      }
    }

    // if no payload, return
    if (!linkDataPayloadMap.size) {
      return;
    }

    const trx = await baseModel.dbDriver.transaction();

    // Create a BaseModelSqlv2 instance that uses the transaction for operations
    // while preserving the original dbDriver reference for non-transactional operations
    const trxBaseModel = await Model.getBaseModelSQL(baseModel.context, {
      model: baseModel.model,
      transaction: trx,
      dbDriver: baseModel.dbDriver,
    });

    try {
      for (const col of linksOrLtarColumns) {
        const linkDataPayload = linkDataPayloadMap.get(col.id);

        const rowIds = linkDataPayload.data.map((d) => d.rowId);
        let existingLinksMap = new Map<string, { links: string[] }>();

        profiler.log(`${col.colOptions.type} list fetch`);
        if (linkDataPayload.colOptions.type === RelationTypes.MANY_TO_MANY) {
          existingLinksMap = await relationDataFetcher({
            baseModel: baseModel,
            logger,
          }).getMmExistingLinks({
            linkDataPayload,
            rowIds,
            trx,
          });
        } else if (
          linkDataPayload.colOptions.type === RelationTypes.ONE_TO_ONE &&
          !parseProp(col.meta).bt
        ) {
          // TODO:
          // const primaryKeysSelect =
          //   linkDataPayload.relatedModel.primaryKeys.map((k) => ({
          //     [k.title]: k.column_name,
          //   }));
          // const fkColumn = linkDataPayload.relatedModel.columns.find(
          //   (rCol) =>
          //     (rCol.uidt === UITypes.ForeignKey &&
          //       rCol.id === linkDataPayload.colOptions.fk_child_column_id) ||
          //     rCol.id === linkDataPayload.colOptions.fk_parent_column_id,
          // );
          // await trx(baseModel.getTnPath(linkDataPayload.relatedModel))
          //   .select({
          //     ...primaryKeysSelect,
          //     [fkColumn.title]: fkColumn.column_name,
          //   })
          //   .whereIn(fkColumn.column_name, rowIds);
        } else if (
          linkDataPayload.colOptions.type === RelationTypes.HAS_MANY &&
          !parseProp(col.meta).bt
        ) {
          existingLinksMap = await relationDataFetcher({
            baseModel: baseModel,
            logger,
          }).getHmExistingLinks({
            linkDataPayload,
            rowIds,
            trx,
          });
        } else {
          existingLinksMap = await relationDataFetcher({
            baseModel: baseModel,
            logger,
          }).getBtExistingLinks({
            linkDataPayload,
            rowIds,
            trx,
          });
        }
        profiler.log(`${col.colOptions.type} list fetch done`);

        // skip if not LTAR or Links
        if (!isLinksOrLTAR(col)) continue;

        for (const d of datas) {
          const rowId = baseModel.extractPksValues(d, true);

          // skip if value is not part of the update
          if (!(col.title in d)) continue;

          // extract existing link values to current record
          let existingLinks = [];

          profiler.log(`${col.colOptions.type} list start`);
          if (col.colOptions.type === RelationTypes.MANY_TO_MANY) {
            existingLinks = await trxBaseModel.mmList({
              colId: col.id,
              parentId: rowId,
            });
          } else if (col.colOptions.type === RelationTypes.HAS_MANY) {
            existingLinks = await trxBaseModel.hmList({
              colId: col.id,
              id: rowId,
            });
          } else {
            existingLinks = existingLinksMap.get(rowId).links;
          }
          profiler.log(`${col.colOptions.type} list done`);

          existingLinks = existingLinks || [];

          if (!Array.isArray(existingLinks)) {
            existingLinks = [existingLinks];
          }

          const idsToLink = [
            ...(Array.isArray(d[col.title])
              ? d[col.title]
              : [d[col.title]]
            ).map((rec) => baseModel.extractPksValues(rec, true)),
          ];

          // check for any missing links then unlink
          const idsToUnlink = existingLinks
            .map((link) => {
              // TODO: backward compatibility with relation other than bt
              return typeof link === 'string'
                ? link
                : baseModel.extractPksValues(link, true);
            })
            .filter((existingLinkPk) => {
              const index = idsToLink.findIndex((linkPk) => {
                return existingLinkPk === linkPk;
              });

              // if found remove from both list
              if (index > -1) {
                idsToLink.splice(index, 1);
                return false;
              }

              return true;
            });

          // check for missing links in new data and unlink them
          if (idsToUnlink?.length) {
            profiler.log(`${col.colOptions.type} removeLinks start`);
            await trxBaseModel.removeLinks({
              colId: col.id,
              childIds: idsToUnlink,
              cookie,
              rowId,
            });
            profiler.log(`${col.colOptions.type} removeLinks done`);
          }

          // check for new data and link them
          if (idsToLink?.length) {
            profiler.log(`${col.colOptions.type} addLinks start`);
            await trxBaseModel.addLinks({
              colId: col.id,
              childIds: idsToLink,
              cookie,
              rowId,
            });
            profiler.log(`${col.colOptions.type} addLinks done`);
          }
        }
      }

      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
    profiler.end();
  };
  return {
    updateLTARCols: update,
  };
};
