import { NcApiVersion, RelationTypes, UITypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import { NcError } from 'src/helpers/catchError';
import { getCompositePkValue } from 'src/helpers/dbHelpers';
import type {
  DataDeleteParams,
  DataInsertParams,
  DataListParams,
  DataListResponse,
  DataReadParams,
  DataRecord,
  DataRecordId,
  DataRecordWithDeleted,
  DataUpdateParams,
  NestedDataListParams,
} from './data-v3.types';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { Column, Model, Source } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const V3_INSERT_LIMIT = 10;

interface ModelInfo {
  model: Model;
  primaryKey: string;
  primaryKeys: Column[];
  columns: Column[];
}

interface RelatedModelInfo {
  model: Model;
  primaryKey: string;
  primaryKeys: Column[];
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
    const primaryKeys = model.primaryKeys;

    return { model, primaryKey, primaryKeys, columns };
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
    const primaryKeys = relatedModel.primaryKeys;

    return { model: relatedModel, primaryKey: relatedPrimaryKey, primaryKeys };
  }

  /**
   * Extract requested fields from query parameters
   */
  private getRequestedFields(query: any): string[] | undefined {
    const fields = query?.fields || query?.f;
    if (!fields) return undefined;
    
    if (Array.isArray(fields)) {
      return fields;
    }
    
    if (typeof fields === 'string') {
      return fields.split(',').map(f => f.trim());
    }
    
    return undefined;
  }

  /**
   * Transform a record to the v3 format {id, fields}
   */
  private transformRecordToV3Format(
    record: any,
    primaryKey: string,
    primaryKeys?: Column[],
    requestedFields?: string[],
  ): DataRecord {
    // If specific fields were requested, only include those in the fields object
    // Otherwise, include all non-primary-key fields
    const primaryKeyTitles = primaryKeys ? primaryKeys.map(pk => pk.title) : [primaryKey];
    
    const shouldIncludeField = (key: string) => {
      // For APIv3, primary keys should NEVER be in the fields object
      // They are always returned as the 'id' property at the root level
      if (primaryKeyTitles.includes(key)) {
        return false;
      }
      
      // For non-primary-key fields, include them if:
      // 1. No field selection was made, OR
      // 2. Field selection was made and this field is in the selection
      if (!requestedFields) {
        return true; // No field selection, include all non-PK fields
      }
      return requestedFields.includes(key);
    };

    const fields = Object.entries(record)
      .filter(([key]) => shouldIncludeField(key))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    const recordPrimaryKeyValue = primaryKeys 
      ? getCompositePkValue(primaryKeys, record) 
      : record[primaryKey];

    const result: DataRecord = {
      fields,
    };

    // Always include the 'id' property for APIv3
    result.id = recordPrimaryKeyValue;

    return result;
  }

  /**
   * Transform multiple records to v3 format
   */
  private transformRecordsToV3Format(
    records: any[],
    primaryKey: string,
    primaryKeys?: Column[],
    requestedFields?: string[],
  ): DataRecord[] {
    return records.map((record) =>
      this.transformRecordToV3Format(record, primaryKey, primaryKeys, requestedFields),
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

    for (const column of ltarColumns) {
      if (fields[column.title]) {
        const { primaryKey: relatedPrimaryKey, primaryKeys: relatedPrimaryKeys } =
          await this.getRelatedModelInfo(context, column);

        if (Array.isArray(fields[column.title])) {
          // Handle array of linked records
          transformedFields[column.title] = fields[column.title].map(
            (nestedRecord: any) => {
              if (typeof nestedRecord === 'object' && nestedRecord.id) {
                // For composite PKs, split the id and create the appropriate object
                if (relatedPrimaryKeys.length > 1) {
                  const idParts = nestedRecord.id.toString().split('___');
                  const pkObject = {};
                  relatedPrimaryKeys.forEach((pk, index) => {
                    pkObject[pk.title] = idParts[index]?.replaceAll('\\_', '_');
                  });
                  return pkObject;
                } else {
                  // Single primary key
                  return { [relatedPrimaryKey]: nestedRecord.id };
                }
              }
              return nestedRecord;
            },
          );
        } else if (typeof fields[column.title] === 'object') {
          // Handle single linked record
          const nestedRecord = fields[column.title];
          if (nestedRecord.id) {
            // For composite PKs, split the id and create the appropriate object
            if (relatedPrimaryKeys.length > 1) {
              const idParts = nestedRecord.id.toString().split('___');
              const pkObject = {};
              relatedPrimaryKeys.forEach((pk, index) => {
                pkObject[pk.title] = idParts[index]?.replaceAll('\\_', '_');
              });
              transformedFields[column.title] = pkObject;
            } else {
              // Single primary key
              transformedFields[column.title] = {
                [relatedPrimaryKey]: nestedRecord.id,
              };
            }
          }
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
        const { primaryKey: relatedPrimaryKey, primaryKeys: relatedPrimaryKeys } =
          await this.getRelatedModelInfo(context, column);

        for (const row of data) {
          // Use column.title instead of column.id to access the LTAR data
          if (row[column.title] && Array.isArray(row[column.title])) {
            if (row[column.title].length > nestedLimit) {
              row[column.title] = row[column.title]
                .slice(0, nestedLimit)
                .map((nestedRecord) =>
                  this.transformRecordToV3Format(nestedRecord, relatedPrimaryKey, relatedPrimaryKeys, undefined),
                );
              nestedNextPageAvail = true;
            } else {
              row[column.title] = row[column.title].map((nestedRecord) =>
                this.transformRecordToV3Format(nestedRecord, relatedPrimaryKey, relatedPrimaryKeys, undefined),
              );
            }
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
      query: {
        ...param.query,
        limit: +param.query?.limit || +param.query?.pageSize,
      },
      apiVersion: NcApiVersion.V3,
    });

    const { primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    // Extract requested fields from query parameters
    const requestedFields = this.getRequestedFields(param.query);

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
      records: this.transformRecordsToV3Format(pagedResponse.list, primaryKey, primaryKeys, requestedFields),
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
    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
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

    // Extract inserted record IDs
    const insertedIds = Array.isArray(result)
      ? result.map((record) => record[primaryKey]).filter(id => id != null)
      : hasPrimaryKey(result)
      ? [result[primaryKey]]
      : [];

    if (insertedIds.length === 0) {
      return { records: [] };
    }

    // Fetch full records using baseModel.readByPk() to maintain order
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    
    // Fetch records individually to maintain order
    const fullRecords = [];
    for (const id of insertedIds) {
      const record = await baseModel.readByPk(id, false, {}, {
        apiVersion: NcApiVersion.V3,
      });
      if (record) {
        fullRecords.push(record);
      }
    }

    // Transform and return full records in V3 format
    return {
      records: this.transformRecordsToV3Format(fullRecords, primaryKey, primaryKeys, undefined),
    };
  }

  async dataDelete(
    context: NcContext,
    param: DataDeleteParams,
  ): Promise<{ records: DataRecordWithDeleted[] }> {
    // Merge the request body with the records in query params
    param.body = [
      ...(Array.isArray(param.body)
        ? param.body
        : param.body
        ? [param.body]
        : []),
      ...(param.queryRecords
        ? Array.isArray(param.queryRecords)
          ? param.queryRecords.map((id) => ({ id }))
          : [{ id: param.queryRecords }]
        : []),
    ];

    const { primaryKey } = await this.getModelInfo(context, param.modelId);

    // Transform the request body to match internal format
    const recordIds = param.body.map((record) => ({ [primaryKey]: record.id }));

    await this.dataTableService.dataDelete(context, {
      ...param,
      body: recordIds,
    });

    // Transform the response to match the new format
    return {
      records: param.body.map((record) => ({
        id: record.id,
        deleted: true,
      })),
    };
  }

  async dataUpdate(
    context: NcContext,
    param: DataUpdateParams,
  ): Promise<{ records: DataRecord[] }> {
    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
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

    // Extract updated record IDs
    const updatedIds = Array.isArray(param.body)
      ? param.body.map((record) => record.id)
      : [param.body.id];

    if (updatedIds.length === 0) {
      return { records: [] };
    }

    // Fetch full records using baseModel.readByPk() to maintain order
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    
    // Fetch records individually to maintain order
    const fullRecords = [];
    for (const id of updatedIds) {
      const record = await baseModel.readByPk(id, false, {}, {
        apiVersion: NcApiVersion.V3,
      });
      if (record) {
        fullRecords.push(record);
      }
    }

    // Transform and return full records in V3 format
    return {
      records: this.transformRecordsToV3Format(fullRecords, primaryKey, primaryKeys, undefined),
    };
  }

  async nestedDataList(
    context: NcContext,
    param: NestedDataListParams,
  ): Promise<DataListResponse> {
    const response = await this.dataTableService.nestedDataList(context, {
      ...(param as Omit<NestedDataListParams, 'req'>),
      query: {
        ...param.query,
        limit: +param.query?.limit || +param.query?.pageSize,
      },
      apiVersion: NcApiVersion.V3,
    });

    const column = await Column.get(context, { colId: param.columnId });
    const { primaryKey: relatedPrimaryKey, primaryKeys: relatedPrimaryKeys } = await this.getRelatedModelInfo(
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
        // Extract requested fields from query parameters for nested data
        const requestedFields = this.getRequestedFields(param.query);
        
        const transformedRecord = this.transformRecordToV3Format(
          response,
          relatedPrimaryKey,
          relatedPrimaryKeys,
          requestedFields,
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

    // Extract requested fields from query parameters for nested data
    const requestedFields = this.getRequestedFields(param.query);

    const transformedRecords = this.transformRecordsToV3Format(
      pagedResponse.list,
      relatedPrimaryKey,
      relatedPrimaryKeys,
      requestedFields,
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
    const { primaryKey, primaryKeys } = await this.getModelInfo(context, param.modelId);

    // Extract requested fields from query parameters
    const requestedFields = this.getRequestedFields(param.query);

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

    const transformedRecord = hasPrimaryKey(result)
      ? this.transformRecordToV3Format(result, primaryKey, primaryKeys, requestedFields)
      : { id: '', fields: {} };

    return { record: transformedRecord };
  }

  async nestedLink(
    context: NcContext,
    param: {
      modelId: string;
      columnId: string;
      rowId: string;
      refRowIds: Array<{ id: string }>;
      query?: any;
      cookie?: any;
      viewId?: string;
    },
  ): Promise<{ success: boolean }> {
    // Transform the v3 request format to internal format
    const internalRefRowIds = param.refRowIds.map(record => record.id);

    await this.dataTableService.nestedLink(context, {
      modelId: param.modelId,
      rowId: param.rowId,
      columnId: param.columnId,
      refRowIds: internalRefRowIds,
      query: param.query || {},
      cookie: param.cookie,
      viewId: param.viewId,
    });

    return { success: true };
  }

  async nestedUnlink(
    context: NcContext,
    param: {
      modelId: string;
      columnId: string;
      rowId: string;
      refRowIds: Array<{ id: string }>;
      query?: any;
      cookie?: any;
      viewId?: string;
    },
  ): Promise<{ success: boolean }> {
    // Transform the v3 request format to internal format
    const internalRefRowIds = param.refRowIds.map(record => record.id);

    await this.dataTableService.nestedUnlink(context, {
      modelId: param.modelId,
      rowId: param.rowId,
      columnId: param.columnId,
      refRowIds: internalRefRowIds,
      query: param.query || {},
      cookie: param.cookie,
      viewId: param.viewId,
    });

    return { success: true };
  }
}
