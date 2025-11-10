import type { NocoSDK } from '@noco-integrations/core';


export interface RecordField {
  [key: string]: any;
}

export interface DataRecord {
  id?: string | number;
  fields: RecordField;
}

export interface DataRecordId {
  id: string | number;
}

export interface DataRecordWithDeleted extends DataRecordId {
  deleted: boolean;
}

export interface DataListResponse {
  records?: DataRecord[];
  record?: DataRecord | null;
  next?: string;
  prev?: string;
  nestedNext?: string;
  nestedPrev?: string;
}

export interface DataInsertRequest {
  fields: RecordField;
}

export interface DataUpdateRequest {
  id: string | number;
  fields: RecordField;
}

export interface DataDeleteRequest {
  id: string | number;
}

export interface DataListParams {
  baseId?: string;
  modelId: string;
  query: any;
  viewId?: string;
  ignorePagination?: boolean;
  req: NocoSDK.NcRequest;
}

export interface DataInsertParams {
  baseId?: string;
  viewId?: string;
  modelId: string;
  body: DataInsertRequest | DataInsertRequest[];
  cookie: any;
}

export interface DataUpdateParams {
  baseId?: string;
  modelId: string;
  viewId?: string;
  body: DataUpdateRequest | DataUpdateRequest[];
  cookie: any;
}

export interface DataDeleteParams {
  baseId?: string;
  modelId: string;
  viewId?: string;
  cookie: any;
  body?: DataDeleteRequest | DataDeleteRequest[];
  queryRecords?: string | string[];
}

export interface NestedDataListParams {
  modelId: string;
  rowId: string;
  query: any;
  viewId: string;
  columnId: string;
  req: NocoSDK.NcRequest;
}

export interface DataReadParams {
  modelId: string;
  rowId: string;
  query: any;
  viewId?: string;
  req: NocoSDK.NcRequest;
}

export interface TransformRecordToV3Param {
  context: NocoSDK.NcContext;
  record: any;
  primaryKey: NocoSDK.ColumnType;
  primaryKeys?: NocoSDK.ColumnType[];
  requestedFields?: string[];
  columns?: NocoSDK.ColumnType[];
  nestedLimit?: number;
  skipSubstitutingColumnIds?: boolean;
  depth?: number;
}

export interface TransformRecordsToV3FormatParam {
  context: NocoSDK.NcContext;
  records: any[];
  primaryKey: NocoSDK.ColumnType;
  primaryKeys?: NocoSDK.ColumnType[];
  requestedFields?: string[];
  columns?: NocoSDK.ColumnType[];
  nestedLimit?: number;
  skipSubstitutingColumnIds?: boolean;
  depth?: number;
}

export type NestedLinkParams = {
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
};

export interface IDataV3Service {
  transformRecordsToV3Format(
    param: TransformRecordsToV3FormatParam,
  ): Promise<DataRecord[]>;

  dataList<T extends boolean>(
    context: NocoSDK.NcContext,
    param: DataListParams,
    pagination?: T,
  ): Promise<T extends true ? DataListResponse : DataRecord[]>;

  dataInsert(
    context: NocoSDK.NcContext,
    param: DataInsertParams,
  ): Promise<{ records: DataRecord[] }>;

  dataDelete(
    context: NocoSDK.NcContext,
    param: DataDeleteParams,
  ): Promise<{ records: DataRecordWithDeleted[] }>;

  dataUpdate(
    context: NocoSDK.NcContext,
    param: DataUpdateParams,
  ): Promise<{ records: DataRecord[] }>;

  nestedDataList(
    context: NocoSDK.NcContext,
    param: NestedDataListParams,
  ): Promise<DataListResponse>;

  dataRead(
    context: NocoSDK.NcContext,
    param: DataReadParams,
  ): Promise<DataRecord>;

  nestedLink(
    context: NocoSDK.NcContext,
    param: NestedLinkParams,
  ): Promise<{ success: boolean }>;

  nestedUnlink(
    context: NocoSDK.NcContext,
    param: NestedLinkParams,
  ): Promise<{ success: boolean }>;
}
