import { isLinksOrLTAR } from 'nocodb-sdk';
import { LTARColsUpdater as LTARColsUpdaterCE } from 'src/db/BaseModelSqlv2/ltar-cols-updater';
import type { Logger } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { Model } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { dataWrapper } from '~/helpers/dbHelpers';
import { Profiler } from '~/helpers/profiler';
import { LinksRequestHandler } from '~/db/links/requestHandler';

// for v3 bulk update with ltar links
export const LTARColsUpdater = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  const { baseModel, logger } = param;
  const updateForColumn = async ({
    linkDataPayload,
    col,
    trx,
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
    const profiler = Profiler.start(`base-model/updateLTARCol`);

    const requestHandler = new LinksRequestHandler();
    profiler.log(`generateLinkRequest for col ${col.id}`);
    const validatedRequest = await requestHandler.validateLinkRequest(
      baseModel.context,
      {
        columnId: col.id,
        modelId: baseModel.model.id,
        baseModel: baseModel,
        links: linkDataPayload.data.map((r) => ({
          rowId: r.rowId,
          linkIds: new Set(r.links),
        })),
        logger,
        cookie,
      },
      trx,
    );
    const linkRequest = await requestHandler.generateLinkRequest(
      baseModel.context,
      {
        ...validatedRequest,
        replaceMode: true,
      },
      trx,
    );
    profiler.log(`handle link for col ${col.id}`);
    await requestHandler.handle(baseModel.context, linkRequest, trx);

    profiler.end();
  };
  const update = async ({
    datas,
    cookie,
  }: {
    datas: any[];
    cookie: NcRequest;
  }) => {
    // if external, fallback to CE version
    if (!(await baseModel.getSource()).isMeta()) {
      return await LTARColsUpdaterCE({
        baseModel: param.baseModel,
        logger,
      }).updateLTARCols({
        datas,
        cookie,
      });
    }

    const profiler = Profiler.start(`base-model/updateLTARCols`);
    const linksOrLtarColumns = baseModel.model.columns.filter((col) =>
      isLinksOrLTAR(col),
    );
    if (!linksOrLtarColumns?.length) {
      profiler.end();
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

    // we transform the request to a more comprehensive format
    for (const col of linksOrLtarColumns) {
      const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
        baseModel.context,
      );
      const { refContext } = colOptions.getRelContext(baseModel.context);
      const relatedModel = await colOptions.getRelatedTable(refContext);
      await relatedModel.getColumns(refContext);
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

    try {
      for (const col of linksOrLtarColumns) {
        if (!linkDataPayloadMap.has(col.id)) {
          continue;
        }
        await updateForColumn({
          linkDataPayload: linkDataPayloadMap.get(col.id),
          cookie,
          col,
          trx,
        });
      }

      profiler.log(`commit`);
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
    profiler.end();
  };
  return {
    updateLTARCols: update,
    updateLTARCol: updateForColumn,
  };
};
