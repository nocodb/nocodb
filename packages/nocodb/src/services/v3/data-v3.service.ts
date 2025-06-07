import { NcApiVersion, UITypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import { NcError } from 'src/helpers/catchError';
import type {
  DataDeleteParams,
  DataInsertParams,
  DataListParams,
  DataListResponse,
  DataReadParams,
  DataRecord,
  DataRecordWithDeleted,
  DataUpdateParams,
  NestedDataListParams,
} from './data-v3.types';
import type { NcContext, NcRequest } from '~/interface/config';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { Model } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { LinkToAnotherRecordColumn } from '~/models/LinkToAnotherRecordColumn';

const V3_INSERT_LIMIT = 10;

@Injectable()
export class DataV3Service {
  constructor(protected dataTableService: DataTableService) {}

  async dataList(
    context: NcContext,
    param: DataListParams,
  ): Promise<DataListResponse> {
    const pagedData = await this.dataTableService.dataList(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });

    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    const primaryKey = model.primaryKey.column_name;

    // extract nested page limit
    const nestedLimit =
      +param.query?.nestedLimit || BaseModelSqlv2.config.ltarV3Limit;
    const nestedPage = Math.max(+param.query?.nestedPage || 1, 1);

    // check if nested next page is available
    // - check for all nested list
    // - check if any Links have limit + 1 record
    const columns = await model.getColumns(context);
    let nestedNextPageAvail = false;
    const nestedPrevPageAvail = nestedPage > 1;
    for (const column of columns) {
      if (column.uidt === UITypes.LinkToAnotherRecord) {
        // Get the related model to access its primary key
        const relatedModel = await (column.colOptions as LinkToAnotherRecordColumn).getRelatedTable(context);
        const relatedPrimaryKey = relatedModel.primaryKey.column_name;

        // Transform nested data to match the same structure
        for (const row of pagedData.list) {
          if (row[column.id]?.length > nestedLimit) {
            row[column.id] = row[column.id].slice(0, nestedLimit).map((nestedRecord) => ({
              id: nestedRecord[relatedPrimaryKey],
              fields: Object.entries(nestedRecord)
                .filter(([key]) => key !== relatedPrimaryKey)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
            }));
            nestedNextPageAvail = true;
          } else if (row[column.id]) {
            row[column.id] = row[column.id].map((nestedRecord) => ({
              id: nestedRecord[relatedPrimaryKey],
              fields: Object.entries(nestedRecord)
                .filter(([key]) => key !== relatedPrimaryKey)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
            }));
          }
        }
      }
    }

    const pagedResponse = new PagedResponseV3Impl(pagedData, {
      context,
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
      nestedNextPageAvail,
      nestedPrevPageAvail,
      queryParams: param.query,
    });

    // Transform the response to match the new format
    return {
      records: pagedResponse.list.map((record) => ({
        id: record[primaryKey],
        fields: Object.entries(record)
          .filter(([key]) => key !== primaryKey)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      })),
      next: pagedResponse.pageInfo.next,
      prev: pagedResponse.pageInfo.prev,
      nestedNext: pagedResponse.pageInfo.nestedNext,
      nestedPrev: pagedResponse.pageInfo.nestedPrev,
    };
  }

  async dataInsert(
    context: NcContext,
    param: DataInsertParams,
  ): Promise<{ records: DataRecord[] }> {
    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    const primaryKey = model.primaryKey.column_name;

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? param.body.map((record) => record.fields)
      : [param.body.fields];

    if (transformedBody.length > V3_INSERT_LIMIT) {
      NcError.maxInsertLimitExceeded(V3_INSERT_LIMIT);
    }

    const result = await this.dataTableService.dataInsert(context, {
      ...param,
      body: transformedBody,
      apiVersion: NcApiVersion.V3,
    });

    // Transform the response to match the new format
    if (!result || typeof result !== 'object') {
      return { records: [] };
    }

    const hasPrimaryKey = (obj: any): obj is Record<string, any> => {
      return primaryKey in obj;
    };

    return {
      records: Array.isArray(result)
        ? result.map((record) => ({
            id: record[primaryKey],
            fields: Object.entries(record)
              .filter(([key]) => key !== primaryKey)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          }))
        : hasPrimaryKey(result)
        ? [
            {
              id: result[primaryKey],
              fields: Object.entries(result)
                .filter(([key]) => key !== primaryKey)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
            },
          ]
        : [],
    };
  }

  async dataDelete(
    context: NcContext,
    param: DataDeleteParams,
  ): Promise<{ records: DataRecordWithDeleted[] }> {
    // Transform the request body to match internal format
    const recordIds = Array.isArray(param.body)
      ? param.body.map((record) => record.id)
      : [param.body.id];

    await this.dataTableService.dataDelete(context, {
      ...param,
      body: recordIds,
    });

    // Transform the response to match the new format
    return {
      records: recordIds.map((id) => ({
        id,
        fields: {},
        deleted: true,
      })),
    };
  }

  async dataUpdate(
    context: NcContext,
    param: DataUpdateParams,
  ): Promise<{ records: DataRecord[] }> {
    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    const primaryKey = model.primaryKey.column_name;

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? param.body.map((record) => ({
          [primaryKey]: record.id,
          ...record.fields,
        }))
      : [
          {
            [primaryKey]: param.body.id,
            ...param.body.fields,
          },
        ];

    const result = await this.dataTableService.dataUpdate(context, {
      ...param,
      body: transformedBody,
      apiVersion: NcApiVersion.V3,
    });

    // Transform the response to match the new format
    if (!result || typeof result !== 'object') {
      return { records: [] };
    }

    const hasPrimaryKey = (obj: any): obj is Record<string, any> => {
      return primaryKey in obj;
    };

    return {
      records: Array.isArray(result)
        ? result.map((record) => ({
            id: record[primaryKey],
            fields: Object.entries(record)
              .filter(([key]) => key !== primaryKey)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          }))
        : hasPrimaryKey(result)
        ? [
            {
              id: result[primaryKey],
              fields: Object.entries(result)
                .filter(([key]) => key !== primaryKey)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
            },
          ]
        : [],
    };
  }

  async nestedDataList(
    context: NcContext,
    param: NestedDataListParams,
  ): Promise<DataListResponse> {
    const response = await this.dataTableService.nestedDataList(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });

    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    const primaryKey = model.primaryKey.column_name;

    // Get the related model to access its primary key
    const column = await model.getColumn(context, param.columnId);
    const relatedModel = await (column.colOptions as LinkToAnotherRecordColumn).getRelatedTable(context);
    const relatedPrimaryKey = relatedModel.primaryKey.column_name;

    // Ensure response is a PagedResponseImpl
    if (!response || !('list' in response) || !('pageInfo' in response)) {
      return {
        records: [],
        next: null,
        prev: null,
        nestedNext: null,
        nestedPrev: null,
      };
    }

    const pagedResponse = new PagedResponseV3Impl(response, {
      context,
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
      queryParams: param.query,
    });

    // Transform the response to match the new format
    return {
      records: pagedResponse.list.map((record) => ({
        id: record[relatedPrimaryKey],
        fields: Object.entries(record)
          .filter(([key]) => key !== relatedPrimaryKey)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      })),
      next: pagedResponse.pageInfo.next,
      prev: pagedResponse.pageInfo.prev,
      nestedNext: pagedResponse.pageInfo.nestedNext,
      nestedPrev: pagedResponse.pageInfo.nestedPrev,
    };
  }

  async dataRead(
    context: NcContext,
    param: DataReadParams,
  ): Promise<{ record: DataRecord }> {
    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    const primaryKey = model.primaryKey.column_name;

    const result = await this.dataTableService.dataRead(context, {
      ...param,
      apiVersion: NcApiVersion.V3,
    });

    // Transform the response to match the new format
    if (!result || typeof result !== 'object') {
      return { record: { id: '', fields: {} } };
    }

    const hasPrimaryKey = (obj: any): obj is Record<string, any> => {
      return primaryKey in obj;
    };

    return {
      record: hasPrimaryKey(result)
        ? {
            id: result[primaryKey],
            fields: Object.entries(result)
              .filter(([key]) => key !== primaryKey)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          }
        : { id: '', fields: {} },
    };
  }
}
