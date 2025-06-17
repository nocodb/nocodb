import { NcApiVersion, RelationTypes, UITypes } from 'nocodb-sdk';
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
import type { LinkToAnotherRecordColumn, Model } from '~/models';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { Column } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

const V3_INSERT_LIMIT = 10;

interface ModelInfo {
  model: Model;
  primaryKey: string;
  columns: Column[];
}

interface RelatedModelInfo {
  model: Model;
  primaryKey: string;
}

@Injectable()
export class DataV3Service {
  constructor(protected dataTableService: DataTableService) {}

  /**
   * Get model information including primary key and columns
   */
  private async getModelInfo(
    context: NcContext,
    modelId: string,
  ): Promise<ModelInfo> {
    const { model } = await this.dataTableService.getModelAndView(context, {
      modelId,
    });
    const columns = await model.getColumns(context);
    const primaryKey = model.primaryKey.title;

    return { model, primaryKey, columns };
  }

  /**
   * Get related model information for LTAR columns
   */
  private async getRelatedModelInfo(
    context: NcContext,
    column: Column,
  ): Promise<RelatedModelInfo> {
    const relatedModel = await (
      column.colOptions as LinkToAnotherRecordColumn
    ).getRelatedTable(context);
    await relatedModel.getColumns(context);
    const relatedPrimaryKey = relatedModel.primaryKey.title;

    return { model: relatedModel, primaryKey: relatedPrimaryKey };
  }

  /**
   * Transform a record to the v3 format {id, fields}
   */
  private transformRecordToV3Format(
    record: any,
    primaryKey: string,
  ): DataRecord {
    const fields = Object.entries(record)
      .filter(([key]) => key !== primaryKey)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return {
      id: record[primaryKey],
      fields: Object.keys(fields).length === 0 ? undefined : fields,
    };
  }

  /**
   * Transform multiple records to v3 format
   */
  private transformRecordsToV3Format(
    records: any[],
    primaryKey: string,
  ): DataRecord[] {
    return records.map((record) =>
      this.transformRecordToV3Format(record, primaryKey),
    );
  }

  /**
   * Transform LTAR fields from v3 format to internal format
   */
  private async transformLTARFieldsToInternal(
    context: NcContext,
    fields: any,
    ltarColumns: Column[],
  ): Promise<any> {
    const transformedFields = { ...fields };

    for (const col of ltarColumns) {
      if (transformedFields[col.title]) {
        const { primaryKey: relatedPrimaryKey } =
          await this.getRelatedModelInfo(context, col);

        // Handle array of records
        if (Array.isArray(transformedFields[col.title])) {
          transformedFields[col.title] = transformedFields[col.title].map(
            (nestedRecord) => ({
              [relatedPrimaryKey]: nestedRecord.id,
              ...nestedRecord.fields,
            }),
          );
        }
        // Handle single record
        else if (transformedFields[col.title].id) {
          transformedFields[col.title] = {
            [relatedPrimaryKey]: transformedFields[col.title].id,
            ...transformedFields[col.title].fields,
          };
        }
      }
    }

    return transformedFields;
  }

  /**
   * Transform nested LTAR data to v3 format
   */
  private async transformNestedLTARData(
    context: NcContext,
    data: any[],
    columns: Column[],
    nestedLimit: number,
  ): Promise<{ transformedData: any[]; hasNextPage: boolean }> {
    let nestedNextPageAvail = false;

    for (const column of columns) {
      if (column.uidt === UITypes.LinkToAnotherRecord) {
        const { primaryKey: relatedPrimaryKey } =
          await this.getRelatedModelInfo(context, column);

        for (const row of data) {
          if (row[column.id]?.length > nestedLimit) {
            row[column.id] = row[column.id]
              .slice(0, nestedLimit)
              .map((nestedRecord) =>
                this.transformRecordToV3Format(nestedRecord, relatedPrimaryKey),
              );
            nestedNextPageAvail = true;
          } else if (row[column.id]) {
            row[column.id] = row[column.id].map((nestedRecord) =>
              this.transformRecordToV3Format(nestedRecord, relatedPrimaryKey),
            );
          }
        }
      }
    }

    return { transformedData: data, hasNextPage: nestedNextPageAvail };
  }

  async dataList(
    context: NcContext,
    param: DataListParams,
  ): Promise<DataListResponse> {
    const pagedData = await this.dataTableService.dataList(context, {
      ...(param as Omit<DataListParams, 'req'>),
      apiVersion: NcApiVersion.V3,
    });

    const { primaryKey, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    // Extract nested page limit
    const nestedLimit =
      +param.query?.nestedLimit || BaseModelSqlv2.config.ltarV3Limit;
    const nestedPage = Math.max(+param.query?.nestedPage || 1, 1);

    // Transform nested LTAR data
    const { hasNextPage: nestedNextPageAvail } =
      await this.transformNestedLTARData(
        context,
        pagedData.list,
        columns,
        nestedLimit,
      );

    const nestedPrevPageAvail = nestedPage > 1;

    const pagedResponse = new PagedResponseV3Impl(pagedData, {
      context,
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
      nestedNextPageAvail,
      nestedPrevPageAvail,
      queryParams: param.query,
    });

    return {
      records: this.transformRecordsToV3Format(pagedResponse.list, primaryKey),
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
    const { primaryKey, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    const ltarColumns = columns.filter(
      (col) => col.uidt === UITypes.LinkToAnotherRecord,
    );

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? await Promise.all(
          param.body.map(async (record) =>
            this.transformLTARFieldsToInternal(
              context,
              record.fields,
              ltarColumns,
            ),
          ),
        )
      : [
          await this.transformLTARFieldsToInternal(
            context,
            param.body.fields,
            ltarColumns,
          ),
        ];

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
        ? this.transformRecordsToV3Format(result, primaryKey)
        : hasPrimaryKey(result)
        ? [this.transformRecordToV3Format(result, primaryKey)]
        : [],
    };
  }

  async dataDelete(
    context: NcContext,
    param: DataDeleteParams,
  ): Promise<{ records: DataRecordWithDeleted[] }> {
    const { primaryKey } = await this.getModelInfo(context, param.modelId);

    // Transform the request body to match internal format
    const recordIds = Array.isArray(param.body)
      ? param.body.map((record) => ({ [primaryKey]: record.id }))
      : [{ [primaryKey]: param.body.id }];

    await this.dataTableService.dataDelete(context, {
      ...param,
      body: recordIds,
    });

    // Transform the response to match the new format
    return {
      records: (Array.isArray(param.body) ? param.body : [param.body]).map(
        (record) => ({
          id: record.id,
          fields: undefined,
          deleted: true,
        }),
      ),
    };
  }

  async dataUpdate(
    context: NcContext,
    param: DataUpdateParams,
  ): Promise<{ records: DataRecord[] }> {
    const { primaryKey, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    const ltarColumns = columns.filter(
      (col) => col.uidt === UITypes.LinkToAnotherRecord,
    );

    // Transform the request body to match internal format
    const transformedBody = Array.isArray(param.body)
      ? await Promise.all(
          param.body.map(async (record) => ({
            [primaryKey]: record.id,
            ...(await this.transformLTARFieldsToInternal(
              context,
              record.fields,
              ltarColumns,
            )),
          })),
        )
      : [
          {
            [primaryKey]: param.body.id,
            ...(await this.transformLTARFieldsToInternal(
              context,
              param.body.fields,
              ltarColumns,
            )),
          },
        ];

    await this.dataTableService.dataUpdate(context, {
      ...param,
      body: transformedBody,
      apiVersion: NcApiVersion.V3,
    });

    // For update operations, return the IDs with undefined fields
    const recordIds = Array.isArray(param.body)
      ? param.body.map((record) => ({ id: record.id, fields: undefined }))
      : [{ id: param.body.id, fields: undefined }];

    return {
      records: recordIds,
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
    const { primaryKey: relatedPrimaryKey } = await this.getRelatedModelInfo(
      context,
      column,
    );

    const colOptions = (await column.getColOptions(
      context,
    )) as LinkToAnotherRecordColumn;

    const isSingleRelation =
      colOptions.type === RelationTypes.BELONGS_TO ||
      colOptions.type === RelationTypes.ONE_TO_ONE;

    // Handle case where response is a single object (ONE_TO_ONE, BELONGS_TO)
    if (
      response &&
      typeof response === 'object' &&
      relatedPrimaryKey in response
    ) {
      const transformedRecord = this.transformRecordToV3Format(
        response,
        relatedPrimaryKey,
      );

      // For single relations, return the record directly, for others return as array
      return isSingleRelation
        ? {
            record: transformedRecord,
            next: null,
            prev: null,
            nestedNext: null,
            nestedPrev: null,
          }
        : {
            records: [transformedRecord],
            next: null,
            prev: null,
            nestedNext: null,
            nestedPrev: null,
          };
    }

    // Handle case where response is a paginated list (HAS_MANY, MANY_TO_MANY)
    if (!response || !('list' in response) || !('pageInfo' in response)) {
      // For single relations, return null record, for others return empty array
      return isSingleRelation
        ? {
            record: null,
            next: null,
            prev: null,
            nestedNext: null,
            nestedPrev: null,
          }
        : {
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

    const transformedRecords = this.transformRecordsToV3Format(
      pagedResponse.list,
      relatedPrimaryKey,
    );

    // For single relations, return the first record directly, for others return as array
    if (isSingleRelation) {
      return {
        record: transformedRecords[0] || null,
        next: pagedResponse.pageInfo.next,
        prev: pagedResponse.pageInfo.prev,
        nestedNext: pagedResponse.pageInfo.nestedNext,
        nestedPrev: pagedResponse.pageInfo.nestedPrev,
      };
    }

    return {
      records: transformedRecords,
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
    const { primaryKey } = await this.getModelInfo(context, param.modelId);

    const result = await this.dataTableService.dataRead(context, {
      ...(param as Omit<DataReadParams, 'req'>),
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
        ? this.transformRecordToV3Format(result, primaryKey)
        : { id: '', fields: {} },
    };
  }
}
