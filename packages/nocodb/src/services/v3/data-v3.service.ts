import { NcApiVersion, UITypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { Model } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

@Injectable()
export class DataV3Service {
  constructor(protected dataTableService: DataTableService) {}

  async dataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      query: any;
      viewId?: string;
      ignorePagination?: boolean;
      req: NcRequest;
    },
  ) {
    const pagedData = await this.dataTableService.dataList(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });

    // extract nested page limit
    const nestedLimit =
      +param.query?.nestedLimit || BaseModelSqlv2.config.ltarV3Limit;
    const nestedPage = Math.max(+param.query?.nestedPage || 1, 1);

    // check if nested next page is available
    // - check for all nested list
    // - check if any Links have limit + 1 record
    const columns = await Model.get(context, param.modelId).then((model) =>
      model.getColumns(context),
    );
    let nestedNextPageAvail = false;
    for (const column of columns) {
      if (column.uidt === UITypes.LinkToAnotherRecord) {
        // slice if more than limit and mark as more available
        for (const row of pagedData.list) {
          if (row[column.id]?.length > nestedLimit) {
            row[column.id] = row[column.id].slice(0, nestedLimit);
            nestedNextPageAvail = true;
          }
        }
      }
    }

    return new PagedResponseV3Impl(pagedData, {
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
      nestedNextPageAvail,
      nestedPrevPageAvail: nestedPage > 1,
    });
  }

  async dataInsert(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      body: any;
      cookie: any;
    },
  ) {
    // todo: refactor and do within a transaction
    if (Array.isArray(param.body)) {
      return Promise.all(
        param.body.map((data) => {
          return this.dataTableService.dataInsert(context, {
            ...param,
            body: data,
            apiVersion: NcApiVersion.V3,
          });
        }),
      );
    }

    return this.dataTableService.dataInsert(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });
  }

  async dataDelete(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      cookie: any;
      body: any;
    },
  ) {
    return this.dataTableService.dataDelete(context, {
      ...param,
    });
  }

  async dataUpdate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      body: any;
      cookie: any;
    },
  ) {
    return this.dataTableService.dataUpdate(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });
  }
}
