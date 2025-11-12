import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { Profiler } from '~/helpers/profiler';
import { Model } from '~/models';

// for v3 bulk update with ltar links
export const LTARColsUpdater = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  const { baseModel } = param;
  const update = async ({
    datas,
    cookie,
  }: {
    datas: any[];
    cookie: NcRequest;
  }) => {
    const profiler = Profiler.start(`base-model/updateLTARCols`);

    const trx = await baseModel.dbDriver.transaction();

    // Create a BaseModelSqlv2 instance that uses the transaction for operations
    // while preserving the original dbDriver reference for non-transactional operations
    const trxBaseModel = await Model.getBaseModelSQL(baseModel.context, {
      model: baseModel.model,
      transaction: trx,
      dbDriver: baseModel.dbDriver,
    });

    try {
      for (const col of baseModel.model.columns) {
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
            existingLinks = await trxBaseModel.btRead({
              colId: col.id,
              id: rowId,
            });
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
            .map((link) => baseModel.extractPksValues(link, true))
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
