import {
  isLinksOrLTAR,
  NcApiVersion,
  recordsV2ToV3,
  recordV2ToV3,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { LTARColsUpdater } from 'src/db/BaseModelSqlv2/ltar-cols-updater';
import type { ModelMeta } from 'nocodb-sdk';
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
  DataUpsertRecordResponse,
  NestedDataListParams,
} from '~/services/v3/data-v3.types';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { ReusableParams } from '~/utils';
import { dataWrapper } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import { Column, Model, Source } from '~/models';
import { PagedResponseV3Impl } from '~/helpers/PagedResponse';
import { DataTableService } from '~/services/data-table.service';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  MAX_NESTING_DEPTH,
  QUERY_STRING_FIELD_ID_ON_RESULT,
  QUERY_STRING_LINKS_AS_LTAR,
  V3_DATA_PAYLOAD_LIMIT,
} from '~/constants';
import { reuseOrSave } from '~/utils';
import { Profiler } from '~/helpers/profiler';

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

const UPSERT_MAX_MERGE_FIELDS = 3;
const UPSERT_DISALLOWED_UITYPES = new Set([
  UITypes.ID,
  UITypes.Attachment,
  UITypes.LinkToAnotherRecord,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
  UITypes.Links,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.AutoNumber,
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.Button,
]);

@Injectable()
export class DataV3Service {
  constructor(protected dataTableService: DataTableService) {}
  logger = new Logger(DataV3Service.name);
  /**
   * Get model information including primary key and columns
   */
  private async getModelInfo(
    context: NcContext,
    modelId: string,
    user?: any,
  ): Promise<ModelInfo> {
    const { model } = await this.dataTableService.getModelAndView(context, {
      modelId,
      user,
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
    _context: NcContext,
    column: Column,
  ): Promise<RelatedModelInfo | null> {
    const context = { ..._context, base_id: column.base_id };
    const colOptions = column.colOptions as LinkToAnotherRecordColumn;

    // getRelatedTable internally calls getRelContext({...context, base_id: this.base_id})
    // which correctly resolves the related base for cross-base links
    const relatedModel = await colOptions.getRelatedTable(context);

    if (!relatedModel) {
      this.logger.warn(
        `Related model not found for column ${column.id} (fk_related_model_id: ${colOptions.fk_related_model_id})`,
      );
      return null;
    }

    // Use the refContext computed by getRelContext (now correctly cached
    // from the getRelatedTable call above) for loading columns
    const { refContext } = colOptions.getRelContext(context);

    await relatedModel.getColumns(refContext);
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
   * Pre-resolve related model info for LTAR/Links/Lookup/Rollup columns
   * into a modelMap (modelId → ModelMeta) and columnModelMap (columnId → modelId).
   * Recurses up to MAX_NESTING_DEPTH for nested LTAR columns.
   */
  private async buildModelMaps(
    context: NcContext,
    columns: Column[],
    depth: number,
    reuse: ReusableParams,
    linksAsLtar: boolean,
  ): Promise<{
    modelMap: Record<string, ModelMeta>;
    columnModelMap: Record<string, string>;
  }> {
    const modelMap: Record<string, ModelMeta> = {};
    const columnModelMap: Record<string, string> = {};

    if (depth >= MAX_NESTING_DEPTH) return { modelMap, columnModelMap };

    // Pass 1: LTAR/Links columns — resolve related models
    for (const column of columns) {
      if (
        column.uidt !== UITypes.LinkToAnotherRecord &&
        !(column.uidt === UITypes.Links && linksAsLtar)
      ) {
        continue;
      }

      const info = await reuseOrSave(
        `relatedModelInfo_${column.id}`,
        reuse,
        async () => this.getRelatedModelInfo(context, column),
      );

      if (!info) continue;

      const modelId = info.model.id;
      columnModelMap[column.id] = modelId;

      // Skip if model already resolved (handles circular refs)
      if (!modelMap[modelId]) {
        modelMap[modelId] = {
          id: modelId,
          title: info.model.title,
          primaryKeys: info.primaryKeys,
          columns: info.model.columns,
        };

        // Recurse into the related model's columns using the related model's
        // base context. Without this, same-base links within a cross-base
        // related model would be looked up in the original request's base
        // instead of the related model's base.
        const relatedModelContext = info.model.base_id
          ? { ...context, base_id: info.model.base_id }
          : context;

        const nested = await this.buildModelMaps(
          relatedModelContext,
          info.model.columns,
          depth + 1,
          reuse,
          linksAsLtar,
        );
        Object.assign(modelMap, nested.modelMap);
        Object.assign(columnModelMap, nested.columnModelMap);
      }
    }

    // Pass 2: Lookup/Rollup columns — map to their LTAR's related model
    for (const column of columns) {
      if (column.uidt !== UITypes.Lookup && column.uidt !== UITypes.Rollup) {
        continue;
      }

      const colOptions = column.colOptions as any;
      const relationColumnId = colOptions?.fk_relation_column_id;

      if (relationColumnId && columnModelMap[relationColumnId]) {
        columnModelMap[column.id] = columnModelMap[relationColumnId];
      }
    }

    return { modelMap, columnModelMap };
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
    linksAsLtar?: boolean;
  }): Promise<DataRecord> {
    const {
      columns,
      context,
      reuse = {},
      linksAsLtar = false,
      depth = 0,
    } = param;

    const { modelMap, columnModelMap } = columns
      ? await this.buildModelMaps(context, columns, depth, reuse, linksAsLtar)
      : { modelMap: undefined, columnModelMap: undefined };

    const pks = param.primaryKeys ?? [param.primaryKey];

    return recordV2ToV3(param.record, {
      primaryKeys: pks,
      columns,
      requestedFields: param.requestedFields,
      useColumnId: param.skipSubstitutingColumnIds,
      linksAsLtar,
      modelMap,
      columnModelMap,
      nestedLimit: param.nestedLimit,
      maxDepth: MAX_NESTING_DEPTH,
      depth,
    });
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
    linksAsLtar?: boolean;
  }): Promise<DataRecord[]> {
    const {
      records,
      columns,
      context,
      reuse = {},
      linksAsLtar = false,
      depth = 0,
    } = param;

    // Pre-resolve all related model info once for the batch
    const { modelMap, columnModelMap } = columns
      ? await this.buildModelMaps(context, columns, depth, reuse, linksAsLtar)
      : { modelMap: undefined, columnModelMap: undefined };

    const pks = param.primaryKeys ?? [param.primaryKey];

    return recordsV2ToV3(records, {
      primaryKeys: pks,
      columns,
      requestedFields: param.requestedFields,
      useColumnId: param.skipSubstitutingColumnIds,
      linksAsLtar,
      modelMap,
      columnModelMap,
      nestedLimit: param.nestedLimit,
      maxDepth: MAX_NESTING_DEPTH,
      depth,
    });
  }

  async validateDataListQueryParams(
    context: NcContext,
    param: DataListParams & { modelInfo: ModelInfo },
  ) {
    const columns = param.modelInfo.columns;
    if (param.query.sort) {
      let fieldsArr: string[] = [];
      let parsedSortJSON;

      if (typeof param.query.sort === 'string') {
        try {
          parsedSortJSON = JSON.parse(param.query.sort);
        } catch {
          NcError.get(context).invalidRequestBody(
            `Query parameter 'sort' needs to a JSON string in format of [{"field": "fieldId", "direction": "asc"}]`,
          );
        }
      } else if (typeof param.query.sort === 'object') {
        parsedSortJSON = param.query.sort;
      } else {
        NcError.get(context).invalidRequestBody(
          `Query parameter 'sort' needs to be a single string`,
        );
      }
      const parsedSort: any | any[] = Array.isArray(parsedSortJSON)
        ? parsedSortJSON
        : [parsedSortJSON];

      if (
        parsedSort.some(
          (s) => s.direction && !['asc', 'desc'].includes(s.direction),
        )
      ) {
        NcError.get(context).invalidRequestBody(
          `Query parameter 'sort' direction value can only be 'asc' or 'desc'`,
        );
      }

      fieldsArr = parsedSort.map((s) => s.field);
      const idList = columns.map((col) => col.id);
      const titleList = columns.map((col) => col.title);
      const columnNameList = columns.map((col) => col.column_name);
      const hayStack = [...idList, ...titleList, ...columnNameList];
      const notFoundField = fieldsArr.find(
        (field) => !hayStack.includes(field),
      );
      if (notFoundField) {
        NcError.get(context).fieldNotFound({
          field: notFoundField,
          onSection: `'sort' query parameter`,
        });
      }
    }
    if (param.query.fields) {
      let fieldsArr: string[] = [];
      if (typeof param.query.fields !== 'string') {
        if (Array.isArray(param.query.fields)) {
          fieldsArr = param.query.fields;
        } else {
          NcError.get(context).invalidRequestBody(
            `Query parameter 'fields' needs to be a single string`,
          );
        }
      }
      // in array format
      else if (param.query.fields.startsWith('[')) {
        try {
          fieldsArr = JSON.parse(param.query.fields);
          param.query.fields = fieldsArr;
        } catch {
          NcError.get(context).invalidRequestBody(
            `Query parameter fields need to be an array of string, or a comma separated`,
          );
        }
      } else {
        fieldsArr = param.query.fields.split(',');
      }
      const idList = columns.map((col) => col.id);
      const titleList = columns.map((col) => col.title);
      const columnNameList = columns.map((col) => col.column_name);
      const hayStack = [...idList, ...titleList, ...columnNameList];
      const notFoundField = fieldsArr.find(
        (field) => !hayStack.includes(field),
      );
      if (notFoundField) {
        NcError.get(context).fieldNotFound({
          field: notFoundField,
          onSection: `'fields' query parameter`,
        });
      }
    }
  }

  async dataList<T extends boolean>(
    context: NcContext,
    param: DataListParams,
    pagination: T = true as T,
  ): Promise<T extends true ? DataListResponse : DataRecord[]> {
    const modelInfo = await this.getModelInfo(context, param.modelId);
    const { primaryKey, primaryKeys, columns } = modelInfo;
    await this.validateDataListQueryParams(context, { ...param, modelInfo });

    const pagedData = await this.dataTableService.dataList(context, {
      ...(param as Omit<DataListParams, 'req'>),
      query: {
        ...param.query,
        limit: +param.query?.limit || +param.query?.pageSize,
      },
      apiVersion: NcApiVersion.V3,
    });

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

    const linksAsLtar = param.query[QUERY_STRING_LINKS_AS_LTAR] === 'true';

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
      linksAsLtar,
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
      const key = dataWrapper(fields).getColumnKeyName(column);
      if (fields[key]) {
        const info = await this.getRelatedModelInfo(context, column);

        if (!info) continue;

        const {
          primaryKey: relatedPrimaryKey,
          primaryKeys: relatedPrimaryKeys,
        } = info;

        const fieldValue = fields[key];

        // Handle v3 format consistently for all relation types
        if (Array.isArray(fieldValue)) {
          // Array of records - each should have id property
          transformedFields[key] = fieldValue.map((nestedRecord) =>
            this.convertRecordIdToInternal(
              context,
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
          transformedFields[key] = this.convertRecordIdToInternal(
            context,
            fieldValue,
            relatedPrimaryKey,
            relatedPrimaryKeys,
            getPrimaryKey,
          );
        } else if (fieldValue === null) {
          transformedFields[key] = null;
        }
      }
    }

    return transformedFields;
  }

  /**
   * Convert a record ID from v3 format to internal format
   */
  private convertRecordIdToInternal(
    context: NcContext,
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
        NcError.get(context).unprocessableEntity(
          `Invalid composite key: expected ${relatedPrimaryKeys.length} parts but got ${idParts.length} in "${idString}"`,
        );
      }

      const pkObject = {};
      relatedPrimaryKeys.forEach((pk, index) => {
        const part = idParts[index];

        // Validate that the part exists and is not empty
        if (part === undefined || part === null) {
          NcError.get(context).unprocessableEntity(
            `Invalid composite key part at index ${index}: got ${part} in "${idString}"`,
          );
        }

        // Handle escaped underscores, but validate the result
        const cleanedPart = part.replaceAll('\\_', '_');

        // Don't allow completely empty string primary keys (after cleaning)
        if (cleanedPart === '') {
          NcError.get(context).unprocessableEntity(
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
        NcError.get(context).unprocessableEntity(
          `Invalid primary key value: "${pkValue}"`,
        );
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
    // validate insert
    this.validateRequestFormat(context, {
      body: param.body,
      validateAdditionalProp: true,
    });

    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    const ltarColumns = columns.filter((col) => isLinksOrLTAR(col));

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

    if (transformedBody.length > V3_DATA_PAYLOAD_LIMIT) {
      NcError.get(context).maxPayloadLimitExceeded(V3_DATA_PAYLOAD_LIMIT);
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

    const linksAsLtar =
      param.cookie.query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

    // Fetch all records in bulk
    const fullRecords = await baseModel.chunkList({
      pks: idsAsStrings,
      apiVersion: NcApiVersion.V3,
      args: {
        ...(linksAsLtar ? { linksAsLtar: 'true' } : {}),
      },
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
        linksAsLtar,
      }),
    };
  }

  async dataUpsert(
    context: NcContext,
    param: DataUpsertParams,
  ): Promise<{ records: DataUpsertRecordResponse[] }> {
    const { body } = param;

    // 1. Validate top-level request structure
    if (!body.records) {
      NcError.get(context).invalidRequestBody("Property 'records' is required");
    }

    const records = Array.isArray(body.records) ? body.records : [body.records];

    if (records.length === 0) {
      NcError.get(context).invalidRequestBody("'records' must not be empty");
    }

    // Validate each record has 'fields'
    for (const [index, record] of records.entries()) {
      if (!record.fields || typeof record.fields !== 'object') {
        NcError.get(context).invalidRequestBody(
          `Property 'fields' is required on record at index ${index}`,
        );
      }
      const otherProps = Object.keys(record).filter(
        (prop) => prop !== 'fields',
      );
      if (otherProps.length) {
        NcError.get(context).invalidRequestBody(
          `Properties ${otherProps
            .map((f) => `'${f}'`)
            .join(
              ',',
            )} on record at index ${index} are not allowed. Only 'fields' is accepted.`,
        );
      }
    }

    if (records.length > V3_DATA_PAYLOAD_LIMIT) {
      NcError.get(context).maxPayloadLimitExceeded(V3_DATA_PAYLOAD_LIMIT);
    }

    // 2. Get model info
    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );

    // 2b. Validate that records do not contain primary key fields
    const pkTitles = new Set(primaryKeys.map((pk) => pk.title));

    for (const [index, record] of records.entries()) {
      const pkFieldsInRecord = Object.keys(record.fields).filter((key) =>
        pkTitles.has(key),
      );
      if (pkFieldsInRecord.length) {
        NcError.get(context).invalidRequestBody(
          `Record at index ${index} contains primary key field${
            pkFieldsInRecord.length > 1 ? 's' : ''
          } ${pkFieldsInRecord
            .map((f) => `'${f}'`)
            .join(
              ', ',
            )} in 'fields'. Primary key fields are not allowed in upsert records.`,
        );
      }
    }

    // 3. Resolve merge fields to columns
    if (!body.fieldsToMergeOn?.length) {
      NcError.get(context).invalidRequestBody(
        `fieldsToMergeOn is required and must contain at least one field`,
      );
    }

    if (body.fieldsToMergeOn.length > UPSERT_MAX_MERGE_FIELDS) {
      NcError.get(context).invalidRequestBody(
        `fieldsToMergeOn exceeds maximum of ${UPSERT_MAX_MERGE_FIELDS} fields`,
      );
    }

    const mergeColumns: Column[] = [];
    for (const fieldRef of body.fieldsToMergeOn) {
      // Support both field title and column id
      const col = columns.find(
        (c) => c.title === fieldRef || c.id === fieldRef,
      );
      if (!col) {
        NcError.get(context).invalidRequestBody(
          `fieldsToMergeOn: field '${fieldRef}' does not exist in table`,
        );
      }
      if (UPSERT_DISALLOWED_UITYPES.has(col.uidt as UITypes)) {
        NcError.get(context).invalidRequestBody(
          `fieldsToMergeOn: field '${col.title}' has unsupported type '${col.uidt}' for merge matching`,
        );
      }
      mergeColumns.push(col);
    }

    // Validate that every record provides values for all merge fields
    for (const [index, record] of records.entries()) {
      for (const mergeCol of mergeColumns) {
        // Check by both title and id to support either key format in record fields
        if (
          record.fields[mergeCol.title] === undefined &&
          record.fields[mergeCol.id] === undefined
        ) {
          NcError.get(context).invalidRequestBody(
            `Record at index ${index} is missing value for merge field '${mergeCol.title}'`,
          );
        }
      }
    }

    // 4. Transform LTAR fields
    const ltarColumns = columns.filter((col) => isLinksOrLTAR(col));

    const transformedBody = await Promise.all(
      records.map(async (record) =>
        this.transformLTARFieldsToInternal(context, record.fields, ltarColumns),
      ),
    );

    // 5. Get base model
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 6. Find existing records by merge fields to track insert vs update status
    let existingPkSet = new Set<string>();

    if (mergeColumns?.length) {
      const mergeColNames = mergeColumns.map((col) => col.column_name);
      const mergeValuesPerRecord = transformedBody.map((data) =>
        mergeColNames.map((cn) => data[cn]),
      );
      const existingRecords = await baseModel.findByMergeFields(
        mergeColumns,
        mergeValuesPerRecord,
      );
      existingPkSet = new Set(
        existingRecords.map((r) => String(baseModel.extractPksValues(r, true))),
      );
    }

    // 7. Call bulkUpsert with merge columns
    const allRecords = await baseModel.bulkUpsert(transformedBody, {
      cookie: param.cookie,
      mergeColumns,
      throwOnDuplicate: true,
    });

    // 8. Build ID-to-status mapping
    const statusMap = new Map<string, 'inserted' | 'updated'>();

    for (const record of allRecords) {
      const pk = String(baseModel.extractPksValues(record, true));
      statusMap.set(pk, existingPkSet.has(pk) ? 'updated' : 'inserted');
    }

    const linksAsLtar =
      param.cookie.query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

    // 9. Transform to V3 format
    const v3Records = await this.transformRecordsToV3Format({
      context,
      records: allRecords,
      primaryKey,
      primaryKeys,
      requestedFields: undefined,
      columns,
      nestedLimit: undefined,
      skipSubstitutingColumnIds:
        param.cookie.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
      reuse: {},
      depth: 0,
      linksAsLtar,
    });

    // 10. Attach status to each record
    const result: DataUpsertRecordResponse[] = v3Records.map((record) => ({
      ...record,
      status: statusMap.get(String(record.id)) ?? 'inserted',
    }));

    return { records: result };
  }

  async dataDelete(
    context: NcContext,
    param: DataDeleteParams,
  ): Promise<{ records: DataRecordWithDeleted[] }> {
    // validate update
    this.validateRequestFormat(context, {
      body: param.body,
      validateId: true,
    });

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

    if (recordIds.length > V3_DATA_PAYLOAD_LIMIT) {
      NcError.get(context).maxPayloadLimitExceeded(V3_DATA_PAYLOAD_LIMIT);
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
    // validate update
    this.validateRequestFormat(context, {
      body: param.body,
      validateAdditionalProp: true,
      validateId: true,
    });

    const profiler = Profiler.start(`data-v3/dataUpdate`);
    const { model, primaryKey, primaryKeys, columns } = await this.getModelInfo(
      context,
      param.modelId,
    );
    profiler.log(`getModelInfo done`);
    const ltarColumns = columns.filter((col) => isLinksOrLTAR(col));

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
    profiler.log(`transformLTARFieldsToInternal done`);

    if (transformedBody.length > V3_DATA_PAYLOAD_LIMIT) {
      NcError.get(context).maxPayloadLimitExceeded(V3_DATA_PAYLOAD_LIMIT);
    }

    await this.dataTableService.dataUpdate(context, {
      ...param,
      body: transformedBody,
      apiVersion: NcApiVersion.V3,
    });
    profiler.log(`dataTableService.dataUpdate done`);

    // Extract updated record IDs
    const updatedIds = Array.isArray(param.body)
      ? param.body.map((record) => record.id)
      : [param.body.id];

    if (updatedIds.length === 0) {
      profiler.end();
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

    const linksAsLtar =
      param.cookie.query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

    // Fetch all records in bulk
    const fullRecords = await baseModel.chunkList({
      pks: idsAsStrings,
      apiVersion: context.api_version,
      args: {
        ...(linksAsLtar ? { linksAsLtar: 'true' } : {}),
      },
    });
    profiler.log(`baseModel.chunkList done`);

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

    const resultRecords = await this.transformRecordsToV3Format({
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
      linksAsLtar,
    });
    profiler.end();

    // Transform and return full records in V3 format
    return {
      records: resultRecords,
    };
  }

  validateRequestFormat(
    context: NcContext,
    param: {
      body: any;
      validateAdditionalProp?: boolean;
      validateId?: boolean;
    },
  ) {
    for (const [index, row] of (Array.isArray(param.body)
      ? param.body
      : [param.body]
    ).entries()) {
      if (param.validateId) {
        if (!row.id) {
          NcError.get(context).invalidRequestBody(
            `Property 'id' is required on index ${index}`,
          );
        }
      }
      if (param.validateAdditionalProp) {
        const otherProps = Object.keys(row).filter(
          (prop) => !['id', 'fields'].includes(prop),
        );
        if (otherProps.length) {
          NcError.get(context).invalidRequestBody(
            `Properties ${otherProps
              .map((field) => `'${field}'`)
              .join(
                ',',
              )} on index ${index} is not allowed. All record parameters need to be put inside 'fields' property`,
          );
        }
      }
    }
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
    const relatedModelInfo = await this.getRelatedModelInfo(context, column);

    if (!relatedModelInfo) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const { primaryKey: relatedPrimaryKey, primaryKeys: relatedPrimaryKeys } =
      relatedModelInfo;

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

      const linksAsLtar = param.query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

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
        linksAsLtar,
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

    const linksAsLtar = param.query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

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
      linksAsLtar,
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

    const linksAsLtar = param.query[QUERY_STRING_LINKS_AS_LTAR] === 'true';

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
          linksAsLtar,
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

    this.dataTableService.validateIds(context, param.refRowIds);
    const { model, view } = await this.dataTableService.getModelAndView(
      context,
      param,
    );
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const column = await this.dataTableService.getColumn(context, param);

    await baseModel.model.getColumns(baseModel.context);

    await LTARColsUpdater({
      baseModel,
      logger: this.logger,
    }).updateLTARCol({
      linkDataPayload: {
        data: [
          {
            rowId: param.rowId,
            links: Array.isArray(normalizedRefRowIds)
              ? normalizedRefRowIds
              : [normalizedRefRowIds],
          },
        ],
      },
      col: column,
      cookie: param.cookie,
      trx: baseModel.dbDriver,
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
