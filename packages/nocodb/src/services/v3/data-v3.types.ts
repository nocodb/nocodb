import type { NcRequest } from '~/interface/config';

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
  req: NcRequest;
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
  req: NcRequest;
}

export interface DataReadParams {
  modelId: string;
  rowId: string;
  query: any;
  viewId?: string;
  req: NcRequest;
}
