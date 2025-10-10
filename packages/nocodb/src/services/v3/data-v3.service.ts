import { NcApiVersion, RelationTypes, UITypes } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import type {
  DataDeleteParams,
  DataInsertParams,
  DataListParams,
  DataListResponse,
  DataReadParams,
  DataRecord,
  DataRecordWithDeleted,
  DataUpdateParams,
  DataUpsertParams,
  DataUpsertRequest,
  DataUpsertResponseRecord,
  NestedDataListParams,
} from '~/services/v3/data-v3.types';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { ReusableParams } from '~/utils';
import { getCompositePkValue } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import { Column, Model, Source } from '~/models';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  MAX_NESTING_DEPTH,
  QUERY_STRING_FIELD_ID_ON_RESULT,
  V3_INSERT_LIMIT,
} from '~/constants';
import { processConcurrently, reuseOrSave } from '~/utils';

interface ModelInfo {
  model: Model;
  primaryKey: Column;
  primaryKeys: Column[];
  columns: Column[];
}

interface RelatedModelInfo {
  model: Model;
  primaryKey: Column;
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
    const primaryKey = model.primaryKey;
    const primaryKeys = model.primaryKeys;

    return {
      model,
      primaryKey,
      primaryKeys,
      columns,
    };
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
    const relatedPrimaryKey = relatedModel.primaryKey;
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
      return fields.split(',').map((f) => f.trim());
    }

    return undefined;
  }

  /**
   * Transform a record to the v3 format {id, fields}
   */
  private async transformRecordToV3Format(param: {
    context: NcContext;
    record: any;
    primaryKey: Column;
    primaryKeys?: Column[];
    requestedFields?: string[];
    columns?: Column[];
    nestedLimit?: number;
    skipSubstitutingColumnIds?: boolean;
    reuse?: ReusableParams;
    depth?: number;
  }): Promise<DataRecord> {
    const {
      context,
      record,
      primaryKey,
      primaryKeys,
      requestedFields,
      columns,
      nestedLimit,
      skipSubstitutingColumnIds,
      reuse = {},
      depth = 0,
    } = param;

    const getPrimaryKey = (column: Column) => {
      return skipSubstitutingColumnIds ? column.id : column.title;
    };

    // If specific fields were requested, only include those in the fields object
    // Otherwise, include all non-primary-key fields
    const primaryKeyTitles = primaryKeys
      ? primaryKeys.map((pk) => getPrimaryKey(pk))
      : [getPrimaryKey(primaryKey)];

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
      if (requestedFields.includes(key)) {
        return true;
      }
      const foundColumn = columns.find((c) => c.title === key || c.id === key);
      if (foundColumn) {
        return (
          requestedFields.includes(foundColumn.id) ||
          requestedFields.includes(foundColumn.title)
        );
      }
    };

    const fields = { ...record };
    const transformedFields: Record<string, any> = {};

    // Process each field
    for (const [key, value] of Object.entries(fields)) {
      if (!shouldIncludeField(key)) continue;

      // Handle LTAR fields if columns are provided
      if (columns) {
        const column = columns.find((col) => col.title === key);
        if (column?.uidt === UITypes.LinkToAnotherRecord) {
          if (Array.isArray(value)) {
            // Check depth limit to prevent unbounded recursion
            if (depth >= MAX_NESTING_DEPTH) {
              // At max depth, return simplified representation based on relation type
              transformedFields[key] = value.map((nestedRecord) => {
                if (typeof nestedRecord === 'object' && nestedRecord !== null) {
                  // Try to extract ID from the nested record with fallbacks
                  const id =
                    nestedRecord.id ||
                    nestedRecord.Id ||
                    nestedRecord.ID ||
                    Object.values(nestedRecord)[0];

                  // For read operations, handle missing IDs gracefully
                  return { id: id ? String(id) : null };
                }

                // Handle primitive values - for read operations, convert to string
                return { id: nestedRecord ? String(nestedRecord) : null };
              });
              continue;
            }

            // Cache the related model info per column to avoid N+1 queries
            const relatedModelInfo = await reuseOrSave(
              `relatedModelInfo_${column.id}`,
              reuse,
              async () => this.getRelatedModelInfo(context, column),
            );

            const {
              primaryKey: relatedPrimaryKey,
              primaryKeys: relatedPrimaryKeys,
            } = relatedModelInfo;

            // Handle array of linked records with concurrency control
            const recordsToProcess =
              nestedLimit && value.length > nestedLimit
                ? value.slice(0, nestedLimit)
                : value;

            // Transform all nested records using v3 format
            transformedFields[key] = await processConcurrently(
              recordsToProcess,
              async (nestedRecord) => {
                return this.transformRecordToV3Format({
                  context: context,
                  record: nestedRecord,
                  primaryKey: relatedPrimaryKey,
                  primaryKeys: relatedPrimaryKeys,
                  reuse,
                  depth: depth + 1,
                });
              },
            );
            continue;
          } else if (value && typeof value === 'object') {
            // Handle single nested record (typically BELONGS_TO or ONE_TO_ONE)
            const relatedModelInfo = await reuseOrSave(
              `relatedModelInfo_${column.id}`,
              reuse,
              async () => this.getRelatedModelInfo(context, column),
            );

            const {
              primaryKey: relatedPrimaryKey,
              primaryKeys: relatedPrimaryKeys,
            } = relatedModelInfo;

            // Transform single record using v3 format
            transformedFields[key] = await this.transformRecordToV3Format({
              context: context,
              record: value,
              primaryKey: relatedPrimaryKey,
              primaryKeys: relatedPrimaryKeys,
              reuse,
              depth: depth + 1,
            });
            continue;
          }
        }
      }

      // For non-LTAR fields, just copy the value
      transformedFields[key] = value;
    }

    const recordPrimaryKeyValue = primaryKeys
      ? getCompositePkValue(primaryKeys, record, { skipSubstitutingColumnIds })
      : record[getPrimaryKey(primaryKey)];

    const result: DataRecord = {
      // Always include the 'id' property for APIv3
      id: recordPrimaryKeyValue,
      fields: transformedFields,
    };
    return result;
  }

  /**
   * Transform multiple records to v3 format
   */
  public async transformRecordsToV3Format(param: {
    context: NcContext;
    records: any[];
    primaryKey: Column;
    primaryKeys?: Column[];
    requestedFields?: string[];
    columns?: Column[];
    nestedLimit?: number;
    skipSubstitutingColumnIds?: boolean;
    reuse?: ReusableParams;
    depth?: number;
  }): Promise<DataRecord[]> {
    const { records } = param;

    // Use concurrency control to prevent overwhelming the system
    return processConcurrently(records, async (record) =>
      this.transformRecordToV3Format({
        ...param,
        record,
      }),
    );
  }

  async dataList<T extends boolean>(
    context: NcContext,
    param: DataListParams,
    pagination: T = true as T,
  ): Promise<T extends true ? DataListResponse : DataRecord[]> {
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

    const nestedPrevPageAvail = nestedPage > 1;

    const pagedResponse = new PagedResponseV3Impl(pagedData, {
      context,
      tableId: param.modelId,
      baseUrl: param.req.ncSiteUrl,
      nestedNextPageAvail: false, // Will be set based on transformed data
      nestedPrevPageAvail,
      queryParams: param.query,
    });

    // Transform records with LTAR handling
    const transformedRecords = await this.transformRecordsToV3Format({
      context: context,
      records: pagedResponse.list,
      primaryKey: primaryKey,
      primaryKeys: primaryKeys,
      requestedFields: requestedFields,
      columns: columns,
      nestedLimit: nestedLimit,
      skipSubstitutingColumnIds:
        param.query[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      reuse: {}, // Create reuse cache for this data list operation
      depth: 0, // Start at depth 0 for main records
    });

    if (!pagination) {
      return transformedRecords as T extends true
        ? DataListResponse
        : DataRecord[];
    }

    // Check if any LTAR fields were truncated
    const hasNextPage = transformedRecords.some((record) =>
      Object.values(record.fields).some(
        (value) => Array.isArray(value) && value.length === nestedLimit,
      ),
    );

    return {
      records: transformedRecords,
      next: pagedResponse.pageInfo.next,
      prev: pagedResponse.pageInfo.prev,
      nestedNext: hasNextPage ? pagedResponse.pageInfo.nestedNext : null,
      nestedPrev: pagedResponse.pageInfo.nestedPrev,
    } as T extends true ? DataListResponse : DataRecord[];
  }

  /**
   * Transform LTAR fields from v3 format to internal format
   */
  private async transformLTARFieldsToInternal(
    context: NcContext,
    fields: any,
    ltarColumns: Column[],
    option?: {
      skipSubstitutingColumnIds?: boolean;
    },
  ): Promise<any> {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return fields ?? {};
    }
    const transformedFields = { ...fields };
    const getPrimaryKey = (column: Column) => {
      return option?.skipSubstitutingColumnIds ? column.id : column.title;
    };

    for (const column of ltarColumns) {
      if (fields[column.title]) {
        const {
          primaryKey: relatedPrimaryKey,
          primaryKeys: relatedPrimaryKeys,
        } = await this.getRelatedModelInfo(context, column);

        const fieldValue = fields[column.title];

        // Handle v3 format consistently for all relation types
        if (Array.isArray(fieldValue)) {
          // Array of records - each should have id property
          transformedFields[column.title] = fieldValue.map((nestedRecord) =>
            this.convertRecordIdToInternal(
              nestedRecord,
              relatedPrimaryKey,
              relatedPrimaryKeys,
              getPrimaryKey,
            ),
          );
        } else if (
          fieldValue &&
          typeof fieldValue === 'object' &&
          fieldValue.id
        ) {
          // Single record with id property (v3 format)
          transformedFields[column.title] = this.convertRecordIdToInternal(
            fieldValue,
            relatedPrimaryKey,
            relatedPrimaryKeys,
            getPrimaryKey,
          );
        } else if (fieldValue === null) {
          transformedFields[column.title] = null;
        }
      }
    }

    return transformedFields;
  }

  private resolveColumnIdentifier(
    identifier: string,
    columns: Column[],
    primaryKey?: Column,
  ): Column {
    const normalized = identifier?.trim();
    if (!normalized) {
      NcError.fieldNotFound(identifier ?? '');
    }

    const normalizedLower = normalized.toLowerCase();
    const candidates = [
      ...(primaryKey ? [primaryKey] : []),
      ...columns,
    ].filter(Boolean) as Column[];

    for (const column of candidates) {
      const matchKeys = [
        column.id,
        column.title,
        column.column_name,
        column.id?.toLowerCase?.(),
        column.title?.toLowerCase?.(),
        column.column_name?.toLowerCase?.(),
      ].filter(Boolean) as string[];

      if (
        matchKeys.includes(normalized) ||
        matchKeys.includes(normalizedLower)
      ) {
        return column;
      }
    }

    NcError.fieldNotFound(identifier);
  }

  private getFieldValueForColumn(
    fields: Record<string, any>,
    column: Column,
  ): any {
    if (!fields || typeof fields !== 'object') {
      return undefined;
    }

    const candidates = [
      column.title,
      column.id,
      column.column_name,
    ].filter(Boolean) as string[];

    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        return fields[key];
      }
    }

    return undefined;
  }

  private async findExistingRecordByMatch(
    context: NcContext,
    baseModel: BaseModelSqlv2,
    model: Model,
    columns: Column[],
    matchColumns: Column[],
    fields: Record<string, any>,
  ): Promise<any | null> {
    if (!matchColumns.length) {
      return null;
    }

    const uniqueMatchColumns = matchColumns.filter(
      (column, index, array) =>
        array.findIndex((candidate) => candidate.id === column.id) === index,
    );

    const aliasInput: Record<string, any> = {};

    for (const column of uniqueMatchColumns) {
      const value = this.getFieldValueForColumn(fields, column);
      if (value === undefined) {
        NcError.requiredFieldMissing(column.title ?? column.id ?? '');
      }
      if (column.title) aliasInput[column.title] = value;
      if (column.id) aliasInput[column.id] = value;
    }

    const mappedValues = await model.mapAliasToColumn(
      context,
      aliasInput,
      baseModel.clientMeta,
      baseModel.dbDriver,
      columns,
    );

    const queryBuilder = baseModel.dbDriver(baseModel.tnPath).clone();
    queryBuilder.where((qb) => {
      for (const column of uniqueMatchColumns) {
        const columnName = column.column_name;
        const mappedValue =
          mappedValues[columnName] ??
          mappedValues[column.title] ??
          (column.id ? mappedValues[column.id] : undefined);

        if (mappedValue === undefined) {
          NcError.requiredFieldMissing(column.title ?? column.id ?? '');
        }

        qb.andWhere(columnName, mappedValue);
      }
    });

    const rows = await queryBuilder.limit(2);


    if (rows.length > 1) {
      NcError.duplicateRecord(
        uniqueMatchColumns.map((column) => column.title ?? column.id ?? ''),
      );
    }

    return rows[0] ?? null;
  }

  /**
   * Convert a record ID from v3 format to internal format
   */
  private convertRecordIdToInternal(
    nestedRecord: any,
    relatedPrimaryKey: Column,
    relatedPrimaryKeys: Column[],
    getPrimaryKey: (column: Column) => string,
  ): any {
    // For composite PKs, split the id and create the appropriate object
    if (relatedPrimaryKeys.length > 1) {
      const idString = String(nestedRecord.id);
      const idParts = idString.split('___');

      // Validate that we have the correct number of parts
      if (idParts.length !== relatedPrimaryKeys.length) {
        NcError.unprocessableEntity(
          `Invalid composite key: expected ${relatedPrimaryKeys.length} parts but got ${idParts.length} in "${idString}"`,
        );
      }

      const pkObject = {};
      relatedPrimaryKeys.forEach((pk, index) => {
        const part = idParts[index];

        // Validate that the part exists and is not empty
        if (part === undefined || part === null) {
          NcError.unprocessableEntity(
            `Invalid composite key part at index ${index}: got ${part} in "${idString}"`,
          );
        }

        // Handle escaped underscores, but validate the result
        const cleanedPart = part.replaceAll('\\_', '_');

        // Don't allow completely empty string primary keys (after cleaning)
        if (cleanedPart === '') {
          NcError.unprocessableEntity(
            `Empty primary key part at index ${index} after cleaning in "${idString}"`,
          );
        }

        pkObject[getPrimaryKey(pk)] = cleanedPart;
      });
      return pkObject;
    } else {
      // Single primary key - validate it's not empty
      const pkValue = String(nestedRecord.id);
      if (pkValue === '' || pkValue === 'undefined' || pkValue === 'null') {
        NcError.unprocessableEntity(`Invalid primary key value: "${pkValue}"`);
      }

      return {
        [getPrimaryKey(relatedPrimaryKey)]: pkValue,
      };
    }
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
      return primaryKey.id in obj || primaryKey.title in obj;
    };

    // Extract inserted record IDs
    const insertedIds = Array.isArray(result)
      ? result
          .map((record) => record[primaryKey.id] ?? record[primaryKey.title])
          .filter((id) => id != null)
      : hasPrimaryKey(result)
      ? [result[primaryKey.id] ?? result[primaryKey.title]]
      : [];

    if (insertedIds.length === 0) {
      return { records: [] };
    }

    // Fetch full records using baseModel.chunkList() for better performance
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Convert IDs to strings for chunkList
    const idsAsStrings = insertedIds.map((id) => String(id));

    // Fetch all records in bulk
    const fullRecords = await baseModel.chunkList({
      pks: idsAsStrings,
      apiVersion: NcApiVersion.V3,
    });

    // Create a map for quick lookup by ID
    const recordMap = new Map();
    for (const record of fullRecords) {
      const recordId = baseModel.extractPksValues(record, true);
      recordMap.set(String(recordId), record);
    }

    // Maintain the original order of insertedIds
    const orderedRecords = [];
    for (const id of insertedIds) {
      const record = recordMap.get(String(id));
      if (record) {
        orderedRecords.push(record);
      }
    }

    // Transform and return full records in V3 format
    return {
      records: await this.transformRecordsToV3Format({
        context: context,
        records: orderedRecords,
        primaryKey: primaryKey,
        primaryKeys: primaryKeys,
        requestedFields: undefined,
        columns: columns,
        nestedLimit: undefined,
        skipSubstitutingColumnIds:
          param.cookie.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        reuse: {}, // Create reuse cache for this data insert operation
        depth: 0, // Start at depth 0 for main records
      }),
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
    const recordIds = param.body.map((record) => ({
      [primaryKey.title]: record.id,
    }));

    if (recordIds.length > V3_INSERT_LIMIT) {
      NcError.maxInsertLimitExceeded(V3_INSERT_LIMIT);
    }
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
            [primaryKey.title]: record.id,
            ...(await this.transformLTARFieldsToInternal(
              context,
              record.fields,
              ltarColumns,
            )),
          })),
        )
      : [
          {
            [primaryKey.title]: param.body.id,
            ...(await this.transformLTARFieldsToInternal(
              context,
              param.body.fields,
              ltarColumns,
            )),
          },
        ];

    if (transformedBody.length > V3_INSERT_LIMIT) {
      NcError.maxInsertLimitExceeded(V3_INSERT_LIMIT);
    }

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

    // Fetch full records using baseModel.chunkList() for better performance
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Convert IDs to strings for chunkList
    const idsAsStrings = updatedIds.map((id) => String(id));

    // Fetch all records in bulk
    const fullRecords = await baseModel.chunkList({
      pks: idsAsStrings,
      apiVersion: context.api_version,
    });

    // Create a map for quick lookup by ID
    const recordMap = new Map();
    for (const record of fullRecords) {
      const recordId = baseModel.extractPksValues(record, true);
      recordMap.set(String(recordId), record);
    }

    // Maintain the original order of updatedIds
    const orderedRecords = [];
    for (const id of updatedIds) {
      const record = recordMap.get(String(id));
      if (record) {
        orderedRecords.push(record);
      }
    }

    // Transform and return full records in V3 format
    return {
      records: await this.transformRecordsToV3Format({
        context: context,
        records: orderedRecords,
        primaryKey: primaryKey,
        primaryKeys: primaryKeys,
        requestedFields: undefined,
        columns: columns,
        nestedLimit: undefined,
        skipSubstitutingColumnIds:
          param.cookie.query?.[QUERY_STRING_FIELD_ID_ON_RESULT],
        reuse: {}, // Create reuse cache for this data update operation
        depth: 0, // Start at depth 0 for main records
      }),
    };
  }

  async dataUpsert(
    context: NcContext,
    param: DataUpsertParams,
  ): Promise<{
    records: DataUpsertResponseRecord[];
    created: number;
    updated: number;
  }> {
    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    const ltarColumns = columns.filter(
      (col) => col.uidt === UITypes.LinkToAnotherRecord,
    );

    const requestsArray = Array.isArray(param.body)
      ? param.body
      : param.body
      ? [param.body]
      : [];

    if (!requestsArray.length) {
      return { records: [], created: 0, updated: 0 };
    }

    if (requestsArray.length > V3_INSERT_LIMIT) {
      NcError.maxInsertLimitExceeded(V3_INSERT_LIMIT);
    }

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const skipSubstitutingColumnIds =
      param.cookie.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true';

    type PreparedEntry =
      | {
          type: 'create';
          index: number;
          payload: DataUpsertRequest;
          insertPayload: DataInsertRequest;
        }
      | {
          type: 'update';
          index: number;
          payload: DataUpsertRequest;
          updatePayload: DataUpdateRequest;
        };

    const preparedEntries: PreparedEntry[] = [];

    const normalizeRecordId = (record: any) => {
      if (!record) return undefined;
      if (primaryKeys?.length) {
        return getCompositePkValue(primaryKeys, record, {
          skipSubstitutingColumnIds,
        });
      }
      return record?.[primaryKey.column_name];
    };

    for (let index = 0; index < requestsArray.length; index++) {
      const request = requestsArray[index];

      if (!request || typeof request !== 'object') {
        NcError.unprocessableEntity('Invalid upsert payload');
      }

      if (!request.fields || typeof request.fields !== 'object') {
        NcError.requiredFieldMissing('fields');
      }

      const rawFields = request.fields;
      const transformedFields = await this.transformLTARFieldsToInternal(
        context,
        rawFields,
        ltarColumns,
      );

      let existingRecordId: string | number | undefined;

      const hasValidId =
        request.id !== undefined &&
        request.id !== null &&
        `${request.id}` !== '' &&
        `${request.id}` !== 'undefined' &&
        `${request.id}` !== 'null';

      if (hasValidId) {
        const record = await baseModel.readByPk(
          request.id,
          false,
          undefined,
          {
            throwErrorIfInvalidParams: false,
            apiVersion: NcApiVersion.V3,
          },
        );
        existingRecordId = normalizeRecordId(record);
      }

      let matchIdentifiers: string[] = Array.isArray(request.matchBy)
        ? request.matchBy.filter((identifier) => !!identifier)
        : [];

      if (!existingRecordId && !matchIdentifiers.length && primaryKeys?.length) {
        const hasAllPrimaryValues = primaryKeys.every((pk) => {
          const value = this.getFieldValueForColumn(rawFields, pk);
          return (
            value !== undefined &&
            value !== null &&
            `${value}` !== '' &&
            `${value}` !== 'undefined' &&
            `${value}` !== 'null'
          );
        });
        if (hasAllPrimaryValues) {
          matchIdentifiers = primaryKeys
            .map((pk) => pk.title ?? pk.id ?? pk.column_name)
            .filter((identifier) => !!identifier) as string[];
        }
      }

      if (!existingRecordId && matchIdentifiers.length) {
        const matchColumns = matchIdentifiers.map((identifier) =>
          this.resolveColumnIdentifier(identifier, columns, primaryKey),
        );

        const record = await this.findExistingRecordByMatch(
          context,
          baseModel,
          model,
          columns,
          matchColumns,
          rawFields,
        );
        existingRecordId = normalizeRecordId(record);
      }

      if (existingRecordId !== undefined && existingRecordId !== null) {
        const sanitizedFields = { ...transformedFields };
        const prunePrimaryKey = (column: Column) => {
          if (!column) return;
          if (column.title) delete sanitizedFields[column.title];
          if (column.id) delete sanitizedFields[column.id];
          if (column.column_name) delete sanitizedFields[column.column_name];
        };

        if (primaryKeys?.length) {
          primaryKeys.forEach(prunePrimaryKey);
        } else if (primaryKey) {
          prunePrimaryKey(primaryKey);
        }

        preparedEntries.push({
          type: 'update',
          index,
          payload: request,
          updatePayload: {
            id: existingRecordId,
            fields: sanitizedFields,
          },
        });
      } else {
        preparedEntries.push({
          type: 'create',
          index,
          payload: request,
          insertPayload: {
            fields: transformedFields,
          },
        });
      }
    }

    const insertPayloads = preparedEntries
      .filter((entry) => entry.type === 'create')
      .map((entry) => (entry as Extract<PreparedEntry, { type: 'create' }>).insertPayload);

    const updatePayloads = preparedEntries
      .filter((entry) => entry.type === 'update')
      .map((entry) => (entry as Extract<PreparedEntry, { type: 'update' }>).updatePayload);

    let createdRecords: DataRecord[] = [];
    let updatedRecords: DataRecord[] = [];

    if (insertPayloads.length) {
      const insertResult = await this.dataInsert(context, {
        baseId: param.baseId,
        modelId: param.modelId,
        viewId: param.viewId,
        body:
          insertPayloads.length === 1 ? insertPayloads[0] : insertPayloads,
        cookie: param.cookie,
      });
      createdRecords = insertResult.records ?? [];
    }

    if (updatePayloads.length) {
      const updateResult = await this.dataUpdate(context, {
        baseId: param.baseId,
        modelId: param.modelId,
        viewId: param.viewId,
        body:
          updatePayloads.length === 1 ? updatePayloads[0] : updatePayloads,
        cookie: param.cookie,
      });
      updatedRecords = updateResult.records ?? [];
    }

    const orderedEntries = [...preparedEntries].sort(
      (a, b) => a.index - b.index,
    );

    let createdIndex = 0;
    let updatedIndex = 0;

    const records: DataUpsertResponseRecord[] = orderedEntries.map(
      (entry) => {
        if (entry.type === 'create') {
          const record = createdRecords[createdIndex++];
          if (record) {
            return {
              ...record,
              operation: 'created' as const,
            };
          }
          return {
            id: undefined,
            fields: entry.insertPayload.fields,
            operation: 'created' as const,
          };
        }

        const record = updatedRecords[updatedIndex++];
        if (record) {
          return {
            ...record,
            operation: 'updated' as const,
          };
        }
        return {
          id: entry.updatePayload.id,
          fields: entry.updatePayload.fields,
          operation: 'updated' as const,
        };
      },
    );

    return {
      records,
      created: createdRecords.length,
      updated: updatedRecords.length,
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
    const { primaryKey: relatedPrimaryKey, primaryKeys: relatedPrimaryKeys } =
      await this.getRelatedModelInfo(context, column);

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
      (relatedPrimaryKey.title in response || relatedPrimaryKey.id in response)
    ) {
      // Extract requested fields from query parameters for nested data
      const requestedFields = this.getRequestedFields(param.query);

      // Get related model columns for LTAR transformation
      const relatedModel = await colOptions.getRelatedTable(context);
      const relatedColumns = await relatedModel.getColumns(context);

      const transformedRecord = await this.transformRecordToV3Format({
        context: context,
        record: response,
        primaryKey: relatedPrimaryKey,
        primaryKeys: relatedPrimaryKeys,
        requestedFields: requestedFields,
        columns: relatedColumns,
        nestedLimit: undefined,
        skipSubstitutingColumnIds:
          param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        reuse: {}, // Create reuse cache for this nested data list operation
        depth: 0, // Start at depth 0 for main records
      });

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

    // Get related model columns for LTAR transformation
    const relatedModel = await colOptions.getRelatedTable(context);
    const relatedColumns = await relatedModel.getColumns(context);

    // Extract nested page limit
    const nestedLimit =
      +param.query?.nestedLimit || BaseModelSqlv2.config.ltarV3Limit;

    const transformedRecords = await this.transformRecordsToV3Format({
      context: context,
      records: pagedResponse.list,
      primaryKey: relatedPrimaryKey,
      primaryKeys: relatedPrimaryKeys,
      requestedFields: requestedFields,
      columns: relatedColumns,
      nestedLimit: nestedLimit,
      skipSubstitutingColumnIds:
        param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      reuse: {}, // Create reuse cache for this nested data list operation
      depth: 0, // Start at depth 0 for main records
    });

    // Check if any LTAR fields were truncated
    const hasNextPage = transformedRecords.some((record) =>
      Object.values(record.fields).some(
        (value) => Array.isArray(value) && value.length === nestedLimit,
      ),
    );

    // For single relations, return the record directly, for others return as array
    if (isSingleRelation) {
      const singleResponse: DataListResponse = {
        record: transformedRecords[0] || null,
        next: pagedResponse.pageInfo.next,
        prev: pagedResponse.pageInfo.prev,
        nestedPrev: pagedResponse.pageInfo.nestedPrev,
      };
      if (hasNextPage) {
        singleResponse.nestedNext = pagedResponse.pageInfo.nestedNext;
      }
      return singleResponse;
    }

    const listResponse: DataListResponse = {
      records: transformedRecords,
      next: pagedResponse.pageInfo.next,
      prev: pagedResponse.pageInfo.prev,
      nestedPrev: pagedResponse.pageInfo.nestedPrev,
    };
    if (hasNextPage) {
      listResponse.nestedNext = pagedResponse.pageInfo.nestedNext;
    }
    return listResponse;
  }

  async dataRead(
    context: NcContext,
    param: DataReadParams,
  ): Promise<DataRecord> {
    const { primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    // Extract requested fields from query parameters
    const requestedFields = this.getRequestedFields(param.query);

    const result = await this.dataTableService.dataRead(context, {
      ...(param as Omit<DataReadParams, 'req'>),
      apiVersion: NcApiVersion.V3,
    });

    // Transform the response to match the new format
    if (!result || typeof result !== 'object') {
      return { id: '', fields: {} };
    }

    const hasPrimaryKey = (obj: any): obj is Record<string, any> => {
      return primaryKey.title in obj || primaryKey.id in obj;
    };

    return hasPrimaryKey(result)
      ? await this.transformRecordToV3Format({
          context: context,
          record: result,
          primaryKey: primaryKey,
          primaryKeys: primaryKeys,
          requestedFields: requestedFields,
          columns: columns,
          nestedLimit: undefined,
          skipSubstitutingColumnIds:
            param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
          reuse: {}, // Create reuse cache for this data read operation
          depth: 0, // Start at depth 0 for main records
        })
      : { id: '', fields: {} };
  }

  /**
   * Normalize various refRowIds formats to string[]
   */
  private normalizeRefRowIds(
    refRowIds:
      | string
      | string[]
      | number
      | number[]
      | Record<string, any>
      | Record<string, any>[],
  ): string[] {
    // Handle array of objects with id property (lowercase - APIv3 format)
    if (
      Array.isArray(refRowIds) &&
      refRowIds.length > 0 &&
      typeof refRowIds[0] === 'object' &&
      'id' in refRowIds[0]
    ) {
      return refRowIds.map((record) => String(record.id));
    }

    // Handle array of strings/numbers
    if (Array.isArray(refRowIds)) {
      return refRowIds.map((id) => String(id));
    }

    // Handle single object with id property (lowercase - APIv3 format)
    if (
      typeof refRowIds === 'object' &&
      refRowIds !== null &&
      'id' in refRowIds
    ) {
      return [String(refRowIds.id)];
    }

    // Handle single string/number
    return [String(refRowIds)];
  }

  async nestedLink(
    context: NcContext,
    param: {
      modelId: string;
      columnId: string;
      rowId: string;
      refRowIds:
        | string
        | string[]
        | number
        | number[]
        | Record<string, any>
        | Record<string, any>[];
      query?: any;
      cookie?: any;
      viewId?: string;
    },
  ): Promise<{ success: boolean }> {
    // Normalize the input to the expected format
    const normalizedRefRowIds = this.normalizeRefRowIds(param.refRowIds);

    await this.dataTableService.nestedLink(context, {
      modelId: param.modelId,
      rowId: param.rowId,
      columnId: param.columnId,
      refRowIds: normalizedRefRowIds,
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
      refRowIds:
        | string
        | string[]
        | number
        | number[]
        | Record<string, any>
        | Record<string, any>[];
      query?: any;
      cookie?: any;
      viewId?: string;
    },
  ): Promise<{ success: boolean }> {
    // Normalize the input to the expected format
    const normalizedRefRowIds = this.normalizeRefRowIds(param.refRowIds);

    await this.dataTableService.nestedUnlink(context, {
      modelId: param.modelId,
      rowId: param.rowId,
      columnId: param.columnId,
      refRowIds: normalizedRefRowIds,
      query: param.query || {},
      cookie: param.cookie,
      viewId: param.viewId,
    });

    return { success: true };
  }
}
