import type { NocoSDK } from '../sdk';

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

export interface ITablesService {
  list(
    context: NocoSDK.NcContext,
    param: { base_id: string },
  ): Promise<Array<{ id: string; title: string; table_name: string }>>;

  tableUpdate(
    context: NocoSDK.NcContext,
    param: {
      tableId: any;
      table: Partial<NocoSDK.TableReqType> & { base_id?: string };
      baseId?: string;
      user: NocoSDK.UserType;
      req: NocoSDK.NcRequest;
    },
  ): Promise<boolean>;

  reorderTable(
    context: NocoSDK.NcContext,
    param: { tableId: string; order: any; req: NocoSDK.NcRequest },
  ): Promise<any>;

  tableDelete(
    context: NocoSDK.NcContext,
    param: {
      tableId: string;
      user: NocoSDK.UserType;
      forceDeleteRelations?: boolean;
      forceDeleteSyncs?: boolean;
      req?: any;
    },
  ): Promise<any>;

  getTableWithAccessibleViews(
    context: NocoSDK.NcContext,
    param: {
      tableId: string;
      user: NocoSDK.UserType;
    },
  ): Promise<NocoSDK.TableType & {
    views: Array<NocoSDK.ViewType>
    columns: Array<NocoSDK.ColumnType>
  }>;

  getAccessibleTables(
    context: NocoSDK.NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
    },
  ): Promise<NocoSDK.TableType[]>;

  tableCreate(
    context: NocoSDK.NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: NocoSDK.TableReqType;
      user: NocoSDK.UserType;
      req: NocoSDK.NcRequest;
      synced?: boolean;
      apiVersion?: NocoSDK.NcApiVersion;
    },
  ): Promise<NocoSDK.TableType>;
}
