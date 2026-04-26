import { isLinksOrLTAR, isMMOrMMLike, RelationTypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { Profiler } from '~/helpers/profiler';
import { LinkToAnotherRecordColumn, Model } from '~/models';
import { addOrRemoveLinks } from '~/db/BaseModelSqlv2/add-remove-links';

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

        // Lazily load the related table's BaseModel so we can use it for correct
        // PK extraction.  baseModel belongs to the *current* table; when the related
        // table has a different primary-key title (e.g. "EmployeeId" vs "Id"),
        // baseModel.extractPksValues() returns undefined for related records and the
        // link is silently skipped or causes a "record not found" error.
        //
        // For BELONGS_TO the "linked" records live in the parent table.
        // For HAS_MANY  the "linked" records live in the child table.
        // For MM/Links  extractPksValues usually works because both sides
        //               share the same default PK naming, so we leave those
        //               on the existing path.
        let relatedBaseModel: IBaseModelSqlV2 | null = null;
        if (!isMMOrMMLike(col)) {
          try {
            const colOptions =
              await col.getColOptions<LinkToAnotherRecordColumn>(
                baseModel.context,
              );
            const isBt = col.colOptions.type === RelationTypes.BELONGS_TO;
            const linkedCol = isBt
              ? await colOptions.getParentColumn(baseModel.context)
              : await colOptions.getChildColumn(baseModel.context);
            const linkedTable = await linkedCol.getModel(baseModel.context);
            relatedBaseModel = await Model.getBaseModelSQL(baseModel.context, {
              model: linkedTable,
              dbDriver: baseModel.dbDriver,
            });
          } catch (_e) {
            // Fall back to baseModel if we can't resolve the related model
          }
        }

        // Extract the PK string from a related-table record using the correct model
        const extractRelatedId = (rec: any): string => {
          const model = relatedBaseModel ?? baseModel;
          return model.extractPksValues(rec, true) as string;
        };

        for (const d of datas) {
          const rowId = baseModel.extractPksValues(d, true);

          // skip if value is not part of the update
          if (!(col.title in d)) continue;

          // extract existing link values to current record
          let existingLinks = [];

          profiler.log(`${col.colOptions.type} list start`);
          if (isMMOrMMLike(col)) {
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
            ).map((rec) => extractRelatedId(rec)),
          ];

          // check for any missing links then unlink
          const idsToUnlink = existingLinks
            .map((link) => extractRelatedId(link))
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

  const updateForColumn = async ({
    linkDataPayload,
    col,
    cookie,
  }: {
    linkDataPayload: {
      data: {
        rowId: string;
        links: string[];
      }[];
    };
    col: Column;
    trx: CustomKnex;
    cookie: any;
  }) => {
    const promises: Promise<any>[] = [];
    for (const each of linkDataPayload.data) {
      promises.push(
        addOrRemoveLinks(baseModel).addLinks({
          cookie,
          childIds: each.links,
          colId: col.id,
          rowId: each.rowId,
        }),
      );
    }
    return Promise.all(promises);
  };
  return {
    updateLTARCols: update,
    updateLTARCol: updateForColumn,
  };
};
