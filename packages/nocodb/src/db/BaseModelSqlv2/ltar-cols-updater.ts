import { isLinksOrLTAR } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { NcRequest } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { Model } from '~/models';
import { dataWrapper } from '~/helpers/dbHelpers';
import { Profiler } from '~/helpers/profiler';
import { LinksRequestHandler } from '~/db/links/requestHandler';

// for v3 bulk update with ltar links
export const LTARColsUpdater = (param: {
  baseModel: IBaseModelSqlV2;
  logger: Logger;
}) => {
  const { baseModel } = param;
  const update = async ({ datas }: { datas: any[]; cookie: NcRequest }) => {
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

    // we transform the request to a more comprehensive format
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

    try {
      for (const col of linksOrLtarColumns) {
        if (!linkDataPayloadMap.has(col.id)) {
          continue;
        }
        const requestHandler = new LinksRequestHandler();
        profiler.log(`generateLinkRequest for col ${col.id}`);
        const validatedRequest = await requestHandler.validateLinkRequest(
          baseModel.context,
          {
            columnId: col.id,
            modelId: baseModel.model.id,
            baseModel: baseModel,
            links: linkDataPayloadMap.get(col.id).data.map((r) => ({
              rowId: r.rowId,
              linkIds: new Set(r.links),
            })),
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
  };
};
