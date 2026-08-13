import { isLinksOrLTAR, isMMOrMMLike, RelationTypes } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { Profiler } from '~/helpers/profiler';
import { Model } from '~/models';
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
    trx: externalTrx,
  }: {
    datas: any[];
    cookie: NcRequest;
    /**
     * When supplied, link writes join the caller's transaction and the caller
     * owns commit/rollback — used by `bulkUpsert` so field and link writes for
     * one request land atomically.
     */
    trx?: Knex.Transaction;
  }) => {
    const profiler = Profiler.start(`base-model/updateLTARCols`);

    // Same guard as the EE updater — EE falls back here for external sources.
    // No-op in CE, where checkPermission is a stub.
    const writtenLinkColIds = baseModel.model.columns
      .filter((col) => isLinksOrLTAR(col) && datas.some((d) => col.title in d))
      .map((col) => col.id);

    // One call per column: checkPermission resolves a single grant with `.find()`,
    // so batching ids lets one permissive grant answer for every field.
    for (const colId of writtenLinkColIds) {
      await baseModel.checkPermission({
        entity: PermissionEntity.FIELD,
        entityId: colId,
        permission: PermissionKey.RECORD_FIELD_EDIT,
        user: cookie?.user,
        req: cookie,
      });
    }

    const ownsTrx = !externalTrx;
    const trx = externalTrx ?? (await baseModel.dbDriver.transaction());

    try {
      // Create a BaseModelSqlv2 instance that uses the transaction for operations
      // while preserving the original dbDriver reference for non-transactional
      // operations. Must be inside the try block so a failure here can't leak
      // the open trx.
      const trxBaseModel = await Model.getBaseModelSQL(baseModel.context, {
        model: baseModel.model,
        transaction: trx,
        dbDriver: baseModel.dbDriver,
      });

      for (const col of baseModel.model.columns) {
        // skip if not LTAR or Links
        if (!isLinksOrLTAR(col)) continue;

        for (const d of datas) {
          const rowId = baseModel.extractPksValues(d, true);

          // skip if value is not part of the update
          if (!(col.title in d)) continue;

          // extract existing link values to current record
          let existingLinks: Record<string, any>[] | Record<string, any> = [];

          profiler.log(`${col.colOptions.type} list start`);
          if (isMMOrMMLike(col)) {
            existingLinks = await trxBaseModel.mmList(
              {
                colId: col.id,
                parentId: rowId,
              },
              // diff only needs PKs — read pk + display value, skipping the
              // related table's other (incl. virtual) columns. `selectAllRecords`
              // removes the 25-row cap so every existing link is compared.
              { pkAndPvOnly: true },
              true,
            );
          } else if (col.colOptions.type === RelationTypes.HAS_MANY) {
            existingLinks = await trxBaseModel.hmList(
              {
                colId: col.id,
                id: rowId,
              },
              { pkAndPvOnly: true },
              true,
            );
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

      if (ownsTrx) await trx.commit();
    } catch (e) {
      if (ownsTrx) await trx.rollback();
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
    for (const each of linkDataPayload.data) {
      await addOrRemoveLinks(baseModel).addLinks({
        cookie,
        childIds: each.links,
        colId: col.id,
        rowId: each.rowId,
      });
    }
  };
  return {
    updateLTARCols: update,
    updateLTARCol: updateForColumn,
  };
};
