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
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { Column, Model } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

const V3_INSERT_LIMIT = 10;

@Injectable()
export class DataV3Service {
  constructor(protected dataTableService: DataTableService) {}

  async dataList(
    context: NcContext,
    param: DataListParams,
  ): Promise<DataListResponse> {
    const pagedData = await this.dataTableService.dataList(context, {
      ...(param as Omit<DataListParams, 'req'>),
      apiVersion: NcApiVersion.V3,
    });

    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    await model.getColumns(context);
    const primaryKey = model.primaryKey.title;

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
        const relatedModel = await (
          column.colOptions as LinkToAnotherRecordColumn
        ).getRelatedTable(context);
        await model.getColumns(context);
        const relatedPrimaryKey = relatedModel.primaryKey.title;

        // Transform nested data to match the same structure
        for (const row of pagedData.list) {
          if (row[column.id]?.length > nestedLimit) {
            row[column.id] = row[column.id]
              .slice(0, nestedLimit)
              .map((nestedRecord) => ({
                id: nestedRecord[relatedPrimaryKey],
                fields: Object.entries(nestedRecord)
                  .filter(([key]: string[]) => key !== relatedPrimaryKey)
                  .reduce(
                    (acc, [key, value]) => ({ ...acc, [key]: value }),
                    {},
                  ),
              }));
            nestedNextPageAvail = true;
          } else if (row[column.id]) {
            row[column.id] = row[column.id].map((nestedRecord) => ({
              id: nestedRecord[relatedPrimaryKey],
              fields: Object.entries(nestedRecord)
                .filter(([key]: string[]) => key !== relatedPrimaryKey)
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
    // Get all columns to check for LinkToAnotherRecord fields
    const columns = await model.getColumns(context);
    const primaryKey = model.primaryKey.title;

    const ltarColumns = columns.filter(
      (col) => col.uidt === UITypes.LinkToAnotherRecord,
    );

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? await Promise.all(
          param.body.map(async (record) => {
            const fields = { ...record.fields };

            // Transform LinkToAnotherRecord fields
            for (const col of ltarColumns) {
              if (fields[col.id]) {
                const relatedModel = await (
                  col.colOptions as LinkToAnotherRecordColumn
                ).getRelatedTable(context);
                await relatedModel.getColumns(context);
                const relatedPrimaryKey = relatedModel.primaryKey.title;

                // If it's an array of records, transform each one
                if (Array.isArray(fields[col.id])) {
                  fields[col.id] = fields[col.id].map((nestedRecord) => ({
                    [relatedPrimaryKey]: nestedRecord.id,
                    ...nestedRecord.fields,
                  }));
                }
                // If it's a single record, transform it
                else if (fields[col.id].id) {
                  fields[col.id] = {
                    [relatedPrimaryKey]: fields[col.id].id,
                    ...fields[col.id].fields,
                  };
                }
              }
            }

            return fields;
          }),
        )
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
              .filter(([key]: string[]) => key !== primaryKey)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          }))
        : hasPrimaryKey(result)
        ? [
            {
              id: result[primaryKey],
              fields: Object.entries(result)
                .filter(([key]: string[]) => key !== primaryKey)
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
    // Get all columns to check for LinkToAnotherRecord fields
    const columns = await model.getColumns(context);
    const primaryKey = model.primaryKey.title;

    const ltarColumns = columns.filter(
      (col) => col.uidt === UITypes.LinkToAnotherRecord,
    );

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? await Promise.all(
          param.body.map(async (record) => {
            const fields = { ...record.fields };

            // Transform LinkToAnotherRecord fields
            for (const col of ltarColumns) {
              if (fields[col.id]) {
                const relatedModel = (
                  col.colOptions as LinkToAnotherRecordColumn
                ).getRelatedTable(context);
                await relatedModel.getColumns(context);
                const relatedPrimaryKey = relatedModel.primaryKey.title;

                // If it's an array of records, transform each one
                if (Array.isArray(fields[col.id])) {
                  fields[col.id] = fields[col.id].map((nestedRecord) => ({
                    [relatedPrimaryKey]: nestedRecord.id,
                    ...nestedRecord.fields,
                  }));
                }
                // If it's a single record, transform it
                else if (fields[col.id].id) {
                  fields[col.id] = {
                    [relatedPrimaryKey]: fields[col.id].id,
                    ...fields[col.id].fields,
                  };
                }
              }
            }

            return {
              [primaryKey]: record.id,
              ...fields,
            };
          }),
        )
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
              .filter(([key]: string[]) => key !== primaryKey)
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
          }))
        : hasPrimaryKey(result)
        ? [
            {
              id: result[primaryKey],
              fields: Object.entries(result)
                .filter(([key]: unknown[]) => key !== primaryKey)
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
      ...(param as Omit<NestedDataListParams, 'req'>),
      apiVersion: NcApiVersion.V3,
    });

    const column = await Column.get(context, { colId: param.columnId });

    // Get the model to access primary key
    const model = await Model.get(context, param.modelId);
    // Get the related model to access its primary key
    await model.getColumns(context);

    const relatedModel = await (
      column.colOptions as LinkToAnotherRecordColumn
    ).getRelatedTable(context);
    await relatedModel.getColumns(context);
    const relatedPrimaryKey = relatedModel.primaryKey.title;

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
          .filter(([key]: string[]) => key !== relatedPrimaryKey)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      })),
      next: pagedResponse.pageInfo.next,
      prev: pagedResponse.pageInfo.prev,
      nestedNext: pagedResponse.pageInfo.nestedNext,
      nestedPrev: pagedResponse.pageInfo.nestedPrev,
    };
  }
}
