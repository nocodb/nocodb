import {
  Api,
  BaseType,
  ColumnType,
  FilterType,
  HookType,
  SortType,
} from './Api';

export interface SigninPayloadType {
  email: string;
  password: string;
}

export interface PasswordForgotPayloadType {
  email?: string;
}

export interface PasswordChangePayloadType {
  currentPassword?: string;
  newPassword?: string;
  verifyPassword?: string;
}

export interface PasswordResetPayloadType {
  new_password?: string;
}

export interface TokenVerifyPayloadType {
  token?: string;
  email?: string;
}

export type ProjectUserAddPayloadType = any;

export type ProjectUserUpdatePayloadType = any;

export interface ModelVisibilityListParamsType {
  includeM2M?: boolean;
  baseId: string;
}

export type ModelVisibilitySetPayloadType = any;

export interface ListParamsType {
  page?: number;
  pageSize?: number;
  sort?: string;
}

export type CreatePayloadType = BaseType & { external?: boolean };

export interface SharedBasePayload {
  roles?: string;
  password?: string;
}

export interface SharedBaseUpdatePayloadType {
  roles?: string;
  password?: string;
}

export interface UploadPayloadType {
  files?: any;
  json?: string;
}

export interface ListParams7Type {
  page?: number;
  pageSize?: number;
  sort?: string;
  includeM2M?: boolean;
  baseId: string;
}

export interface UpdatePayloadType {
  title?: string;
}

export interface ReorderPayloadType {
  order?: string;
}

export type CreateInputType =
  | ColumnType
  | {
      uidt: 'LinkToAnotherRecord';
      title: string;
      parentId: string;
      childId: string;
      type: 'hm' | 'bt' | 'mm';
    };

export interface UpdateInputType {
  order?: string;
  title?: string;
  show_system_fields?: boolean;
  lock_type?: 'collaborative' | 'locked' | 'personal';
}

export type CreatePayload8Type = any;

export interface ShowAllColumnParamsType {
  ignoreIds?: any[];
  viewId: string;
}

export interface HideAllColumnParamsType {
  ignoreIds?: any[];
  viewId: string;
}

export type UpdatePayload4Type = any;

export interface UpdatePayload7Type {
  password?: string;
}

export type CreatePayload3Type = any;

export interface ListParams4Type {
  fields?: any[];
  sort?: any[];
  where?: string;
  orgs: string;
  projectName: string;
  tableAlias: string;
}

export interface CreatePayload9Type {
  description?: string;
}

export interface ListParams10Type {
  fields?: any[];
  sort?: any[];
  where?: string;

  /** Query params for nested data */
  nested?: any;
  orgs: string;
  projectName: string;
  tableAlias: string;
  viewName: string;
}

export type CreatePayload5Type = any;

export interface DataListPayloadType {
  password?: string;
  sorts?: SortType[];
  filters?: FilterType[];
}

export interface FileType {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  size: number;
  path: string;
}

export interface DataListParamsType {
  limit?: string;
  offset?: string;
  uuid: string;
}

export interface DataNestedListParamsType {
  limit?: string;
  offset?: string;
  uuid: string;
  rowId: string;
  relationType: 'mm' | 'hm';
  columnId: string;
}

export interface DataNestedExcludedListParamsType {
  limit?: string;
  offset?: string;
  uuid: string;
  rowId: string;
  relationType: 'mm' | 'hm';
  columnId: string;
}

export interface DataCreatePayloadType {
  data?: any;
  password?: string;
}

export interface CsvExportBodyType {
  password?: string;
  filters?: FilterType[];
  sorts?: SortType[];
}

export interface DataRelationListPayloadType {
  password?: string;
}

export interface DataRelationListParamsType {
  limit?: string;
  offset?: string;
  uuid: string;
  relationColumnId: string;
}

export interface SharedViewMetaGetPayloadType {
  password?: string;
}

export type UpdatePayload10Type = any;

export type UpdatePayload9Type = any;

export interface CommentListParamsType {
  row_id: string;
  fk_model_id: string;
  comments_only?: boolean;
}

export interface CommentRowPayloadType {
  row_id: string;
  fk_model_id: string;
  comment: string;
}

export interface CommentCountParamsType {
  ids: any[];
  fk_model_id: string;
}

export interface AuditListParamsType {
  offset?: string;
  limit?: string;
  baseId: string;
}

export interface TestPayloadType {
  payload?: { data?: any; user?: any };
  hook?: HookType;
}

export interface TestBodyType {
  id?: string;
  title?: string;
  input?: any;
  category?: string;
}

export type TestConnectionPayloadType = any;

export type BulkDeletePayloadType = any[];

export type BulkInsertPayloadType = any[];
//
// export type BulkUpdatePayloadType = object[];
//
// export type BulkUpdateAllPayloadType = object;

export interface BulkUpdateAllParamsType {
  where?: string;
  orgs: string;
  projectName: string;
  tableAlias: string;
}

export interface BulkDeleteAllParamsType {
  where?: string;
  orgs: string;
  projectName: string;
  tableAlias: string;
}

// @ts-ignore
// eslint-disable-next-line functional/no-class
class CustomAPI extends Api<unknown> {}

export default CustomAPI;
