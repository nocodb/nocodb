import { NcApiVersion } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';

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
    return new PagedResponseV3Impl(pagedData, {
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
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
