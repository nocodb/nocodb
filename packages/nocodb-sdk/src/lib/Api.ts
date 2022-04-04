/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface UserType {
  /** Unique identifier for the given user. */
  id: number;
  firstname: string;
  lastname: string;

  /** @format email */
  email: string;

  /**
   * @format date
   * @example 1997-10-31
   */
  date_of_birth?: string;

  /** Set to true if the user's email has been verified. */
  email_verified: boolean;

  /**
   * The date that the user was created.
   * @format date
   */
  createDate?: string;
}

export interface UserListType {
  users: { list: UserType; pageInfo: PaginatedType };
}

export interface ProjectReqType {
  title?: string;
  description?: string;
  color?: string;
  bases?: BaseReqType[];
}

export interface ProjectType {
  id?: string;
  title?: string;
  status?: string;
  description?: string;
  meta?: string | object;
  color?: string;
  deleted?: string | boolean;
  order?: number;
  bases?: BaseType[];
  is_meta?: boolean;
  prefix?: string;
  created_at?: any;
  updated_at?: any;
  slug?: string;
}

export interface ProjectListType {
  list?: ProjectType[];
  pageInfo?: PaginatedType;
}

export interface BaseType {
  id?: string;
  project_id?: string;
  alias?: string;
  type?: string;
  is_meta?: boolean;
  config?: any;
  created_at?: any;
  updated_at?: any;
  inflection_column?: string;
  inflection_table?: string;
}

export interface BaseReqType {
  id?: string;
  project_id?: string;
  alias?: string;
  type?: string;
  is_meta?: boolean;
  config?: any;
  inflection_column?: string;
  inflection_table?: string;
}

export interface BaseListType {
  bases: { list: BaseType[]; pageInfo: PaginatedType };
}

export interface TableType {
  id?: string;
  fk_project_id?: string;
  fk_base_id?: string;
  table_name: string;
  title: string;
  type?: string;
  enabled?: boolean;
  parent_id?: string;
  show_as?: string;
  tags?: string;
  pinned?: boolean;
  deleted?: boolean;
  order?: number;
  columns?: ColumnType[];
  columnsById?: object;
  slug?: string;
}

export interface ViewType {
  id?: string;
  title?: string;
  deleted?: boolean;
  order?: number;
  fk_model_id?: string;
  slug?: string;
}

export interface TableInfoType {
  id?: string;
  fk_project_id?: string;
  fk_base_id?: string;
  title: string;
  table_nameme: string;
  type?: string;
  enabled?: string;
  parent_id?: string;
  show_as?: string;
  tags?: string;
  pinned?: boolean;
  deleted?: boolean;
  order?: number;
  column?: ColumnType[];
  filters?: FilterType[];
  sort?: SortType[];
}

export interface TableReqType {
  id?: string;
  fk_project_id?: string;
  fk_base_id?: string;
  table_name: string;
  title: string;
  type?: string;
  enabled?: string;
  parent_id?: string;
  show_as?: string;
  tags?: string;
  pinned?: boolean;
  deleted?: boolean;
  order?: number;
  columns?: ColumnType[];
}

export interface TableListType {
  list?: TableType[];
  pageInfo?: PaginatedType;
}

export interface FilterType {
  id?: string;
  fk_model_id?: string;
  fk_column_id?: string;
  logical_op?: string;
  comparison_op?: string;
  value?: string | number | number | boolean | null;
  is_group?: boolean;
  children?: FilterType[];
  project_id?: string;
  base_id?: string;
  fk_parent_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
}

export interface FilterListType {
  filters: { list: FilterType[] };
}

export interface SortType {
  id?: string;
  fk_model_id?: string;
  fk_column_id?: string;
  direction?: string;
  order?: number;
  project_id?: string;
  base_id?: string;
}

export interface SortListType {
  sorts: { list: SharedViewType[] };
}

export interface ColumnType {
  id?: string;
  base_id?: string;
  fk_model_id?: string;
  title?: string;
  uidt: string;
  dt?: string;
  np?: string;
  ns?: string;
  clen?: string | number;
  cop?: string;
  pk?: boolean;
  pv?: boolean;
  rqd?: boolean;
  column_name?: string;
  un?: boolean;
  ct?: string;
  ai?: boolean;
  unique?: boolean;
  cdf?: string;
  cc?: string;
  csn?: string;
  dtx?: string;
  dtxp?: string;
  dtxs?: string;
  au?: boolean;
  deleted?: boolean;
  visible?: boolean;
  order?: number;
  colOptions?:
    | LinkToAnotherRecordType
    | FormulaType
    | RollupType
    | LookupType
    | SelectOptionsType[]
    | object;
}

export interface ColumnListType {
  columns: { list: ColumnType[] };
}

export interface LinkToAnotherRecordType {
  id?: string;
  type?: string;
  virtual?: boolean;
  fk_column_id?: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_related_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  ur?: string;
  dr?: string;
  fk_index_name?: string;
  deleted?: string;
  order?: string;
}

export interface LookupType {
  id?: string;
  type?: string;
  virtual?: boolean;
  fk_column_id?: string;
  fk_relation_column_id?: string;
  fk_lookup_column_id?: string;
  deleted?: string;
  order?: string;
}

export interface RollupType {
  id?: string;
  type?: string;
  virtual?: boolean;
  fk_column_id?: string;
  fk_relation_column_id?: string;
  fk_rollup_column_id?: string;
  rollup_function?: string;
  deleted?: string;
  order?: string;
}

export interface FormulaType {
  id?: string;
  type?: string;
  virtual?: boolean;
  fk_column_id?: string;
  formula?: string;
  deleted?: string;
  order?: string;
}

export interface SelectOptionsType {
  id?: string;
  type?: string;
  virtual?: boolean;
  fk_column_id?: string;
  title?: string;
  color?: string;
  order?: number;
}

export interface GridType {
  id?: string;
  title?: string;
  alias?: string;
  deleted?: boolean;
  order?: number;
}

export interface GalleryType {
  fk_view_id?: string;
  title?: string;
  alias?: string;
  deleted?: boolean;
  order?: number;
  next_enabled?: boolean;
  prev_enabled?: boolean;
  cover_image_idx?: number;
  cover_image?: string;
  restrict_types?: string;
  restrict_size?: string;
  restrict_number?: string;
  columns?: GalleryColumnType[];
  fk_model_id?: string;
  fk_cover_image_col_id?: string;
}

export interface GalleryColumnType {
  id?: string;
  label?: string;
  help?: string;
  fk_col_id?: string;
  fk_gallery_id?: string;
}

export interface GridColumnType {
  id?: string;
  label?: string;
  help?: string;
  fk_column_id?: string;
  fk_gallery_id?: string;
  width?: string;
}

export interface KanbanColumnType {
  id?: string;
  label?: string;
  help?: string;
  fk_column_id?: string;
  fk_kanban_id?: string;
}

export interface KanbanType {
  id?: string;
  title?: string;
  alias?: string;
  public?: boolean;
  password?: string;
  columns?: KanbanColumnType[];
  fk_model_id?: string;
}

export interface FormType {
  id?: string;
  title?: string;
  heading?: string;
  subheading?: string;
  sucess_msg?: string;
  redirect_url?: string;
  redirect_after_secs?: string;
  email?: string;
  banner_image_url?: string;
  logo_url?: string;
  submit_another_form?: boolean;
  columns?: FormColumnType[];
  fk_model_id?: string;
}

export interface FormColumnType {
  fk_column_id?: string;
  id?: string;
  fk_view_id?: string;
  uuid?: any;
  label?: string;
  help?: any;
  required?: boolean;
  show?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
  description?: string;
}

export interface PaginatedType {
  pageSize?: number;
  totalRows?: number;
  sort?: string | any[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  page?: number;
}

export interface HookListType {
  list?: object[];
  pageInfo?: PaginatedType;
}

export interface SharedViewType {
  id?: string;
  fk_view_id?: string;
  password?: string;
  deleted?: string;
}

export interface SharedViewListType {
  list?: SharedViewType[];
  pageInfo?: PaginatedType;
}

export interface ViewListType {
  list?: GridType | FormType | KanbanType | GalleryType;
  pageInfo?: PaginatedType;
}

export interface AttachmentType {
  url?: string;
  title?: string;
  mimetype?: string;
  size?: string;
  icon?: string;
}

export interface WebhookType {
  id?: string;
  title?: string;
  type?: string;
}

export interface AuditType {
  id?: string;
  user?: string;
  ip?: string;
  base_id?: string;
  project_id?: string;
  fk_model_id?: string;
  row_id?: string;
  op_type?: string;
  op_sub_type?: string;
  status?: string;
  description?: string;
  details?: string;
}

export interface HookType {
  id?: string;
  fk_model_id?: string;
  title?: string;
  description?: string;
  env?: string;
  type?: string;
  event?: 'After' | 'Before';
  operation?: 'insert' | 'delete' | 'update';
  async?: boolean;
  payload?: string;
  url?: string;
  headers?: string;
  condition?: boolean;
  notification?: string;
  retries?: number;
  retry_interval?: number;
  timeout?: number;
  active?: boolean;
}

export interface PluginType {
  id?: string;
  title?: string;
  description?: string;
  active?: boolean;
  rating?: number;
  version?: string;
  docs?: string;
  status?: string;
  status_details?: string;
  logo?: string;
  icon?: string;
  tags?: string;
  category?: string;
  input_schema?: string;
  input?: string;
  creator?: string;
  creator_website?: string;
  price?: string;
}

export interface ModelRoleVisibilityType {
  id?: string;
  project_id?: string;
  base_id?: string;
  fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  disabled?: boolean;
}

export interface ApiTokenType {
  id?: string;
  token?: string;
  description?: string;
}

export interface HookLogType {
  id?: string;
  base_id?: string;
  project_id?: string;
  fk_hook_id?: string;
  type?: string;
  event?: string;
  operation?: string;
  test_call?: boolean;
  payload?: string;
  conditions?: string;
  notifications?: string;
  error_code?: string;
  error_message?: string;
  error?: string;
  execution_time?: string;
  response?: string;
  triggered_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type ColumnReqType =
  | {
      uidt?:
        | 'ID'
        | 'SingleLineText'
        | 'LongText'
        | 'Attachment'
        | 'Checkbox'
        | 'MultiSelect'
        | 'SingleSelect'
        | 'Collaborator'
        | 'Date'
        | 'Year'
        | 'Time'
        | 'PhoneNumber'
        | 'Email'
        | 'URL'
        | 'Number'
        | 'Decimal'
        | 'Currency'
        | 'Percent'
        | 'Duration'
        | 'Rating'
        | 'Count'
        | 'DateTime'
        | 'CreateTime'
        | 'LastModifiedTime'
        | 'AutoNumber'
        | 'Geometry'
        | 'JSON'
        | 'SpecificDBType'
        | 'Barcode'
        | 'Button';
      id?: string;
      base_id?: string;
      fk_model_id?: string;
      title?: string;
      dt?: string;
      np?: string;
      ns?: string;
      clen?: string | number;
      cop?: string;
      pk?: boolean;
      pv?: boolean;
      rqd?: boolean;
      column_name?: string;
      un?: boolean;
      ct?: string;
      ai?: boolean;
      unique?: boolean;
      cdf?: string;
      cc?: string;
      csn?: string;
      dtx?: string;
      dtxp?: string;
      dtxs?: string;
      au?: boolean;
      ''?: string;
    }
  | {
      uidt: 'LinkToAnotherRecord';
      title: string;
      parentId: string;
      childId: string;
      type: 'hm' | 'bt' | 'mm';
    }
  | {
      uidt?: 'Rollup';
      title?: string;
      fk_relation_column_id?: string;
      fk_rollup_column_id?: string;
      rollup_function?: string;
    }
  | {
      uidt?: 'Lookup';
      title?: string;
      fk_relation_column_id?: string;
      fk_lookup_column_id?: string;
    }
  | { uidt?: string; formula_raw?: string; formula?: string; title?: string };

import axios, { AxiosInstance, AxiosRequestConfig, ResponseType } from 'axios';

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams
  extends Omit<AxiosRequestConfig, 'data' | 'params' | 'url' | 'responseType'> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseType;
  /** wrapped response */
  wrapped?: boolean;
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<
  FullRequestParams,
  'body' | 'method' | 'query' | 'path'
>;

export interface ApiConfig<SecurityDataType = unknown>
  extends Omit<AxiosRequestConfig, 'data' | 'cancelToken'> {
  securityWorker?: (
    securityData: SecurityDataType | null
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export enum ContentType {
  Json = 'application/json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>['securityWorker'];
  private secure?: boolean;
  private format?: ResponseType;

  constructor({
    securityWorker,
    secure,
    format,
    ...axiosConfig
  }: ApiConfig<SecurityDataType> = {}) {
    this.instance = axios.create({
      ...axiosConfig,
      baseURL: axiosConfig.baseURL || 'http://localhost:8080',
    });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  private mergeRequestParams(
    params1: AxiosRequestConfig,
    params2?: AxiosRequestConfig
  ): AxiosRequestConfig {
    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.instance.defaults.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createFormData(input: Record<string, unknown>): FormData {
    if (input instanceof FormData) {
      return input;
    }
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];

      if (property instanceof Blob) {
        formData.append(key, property);
      } else if (typeof property === 'object' && property !== null) {
        if (Array.isArray(property)) {
          // eslint-disable-next-line functional/no-loop-statement
          for (const prop of property) {
            formData.append(`${key}[]`, prop);
          }
        } else {
          formData.append(key, JSON.stringify(property));
        }
      } else {
        formData.append(key, `${property}`);
      }
      return formData;
    }, new FormData());
  }

  public request = async <T = any, _E = any>({
    secure,
    path,
    type,
    query,
    format,
    wrapped,
    body,
    ...params
  }: FullRequestParams): Promise<T> => {
    const secureParams =
      ((typeof secure === 'boolean' ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = (format && this.format) || void 0;

    if (
      type === ContentType.FormData &&
      body &&
      body !== null &&
      typeof body === 'object'
    ) {
      requestParams.headers.common = { Accept: '*/*' };
      requestParams.headers.post = {};
      requestParams.headers.put = {};

      body = this.createFormData(body as Record<string, unknown>);
    }

    return this.instance
      .request({
        ...requestParams,
        headers: {
          ...(type && type !== ContentType.FormData
            ? { 'Content-Type': type }
            : {}),
          ...(requestParams.headers || {}),
        },
        params: query,
        responseType: responseFormat,
        data: body,
        url: path,
      })
      .then((response) => {
        if (wrapped) return response;
        return response.data;
      });
  };
}

/**
 * @title nocodb
 * @version 1.0
 * @baseUrl http://localhost:8080
 */
export class Api<
  SecurityDataType extends unknown
> extends HttpClient<SecurityDataType> {
  auth = {
    /**
     * @description Create a new user with provided email and password and first user is marked as super admin.
     *
     * @tags Auth
     * @name Signup
     * @summary Signup
     * @request POST:/auth/user/signup
     * @response `200` `{ token?: string }` OK
     * @response `400` `void` Bad Request
     * @response `401` `void` Unauthorized
     * @response `403` `void` Forbidden
     */
    signup: (
      data: { email?: string; password?: string },
      params: RequestParams = {}
    ) =>
      this.request<{ token?: string }, void>({
        path: `/auth/user/signup`,
        method: 'POST',
        body: data,
        format: 'json',
        ...params,
      }),

    /**
     * @description Authenticate existing user with their email and password. Successful login will return a JWT access-token.
     *
     * @tags Auth
     * @name Signin
     * @summary Signin
     * @request POST:/auth/user/signin
     * @response `200` `{ token?: string }` OK
     */
    signin: (
      data: { email: string; password: string },
      params: RequestParams = {}
    ) =>
      this.request<{ token?: string }, any>({
        path: `/auth/user/signin`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Returns authenticated user info
     *
     * @tags Auth
     * @name Me
     * @summary User Info
     * @request GET:/auth/user/me
     * @response `200` `UserType` OK
     */
    me: (params: RequestParams = {}) =>
      this.request<UserType, any>({
        path: `/auth/user/me`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Emails user with a reset url.
     *
     * @tags Auth
     * @name PasswordForgot
     * @summary Password Forgot
     * @request POST:/auth/password/forgot
     * @response `200` `void` OK
     */
    passwordForgot: (data: { email?: string }, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/auth/password/forgot`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Change password of authenticated user with a new one.
     *
     * @tags Auth
     * @name PasswordChange
     * @summary Password Change
     * @request POST:/auth/password/change
     * @response `200` `void` OK
     */
    passwordChange: (
      data: {
        currentPassword?: string;
        newPassword?: string;
        verifyPassword?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/auth/password/change`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Validtae password reset url token.
     *
     * @tags Auth
     * @name PasswordResetTokenValidate
     * @summary Reset Token Verify
     * @request POST:/auth/token/validate/{token}
     * @response `200` `void` OK
     */
    passwordResetTokenValidate: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/auth/token/validate/${token}`,
        method: 'POST',
        ...params,
      }),

    /**
     * @description Api for verifying email where token need to be passed which is shared to user email.
     *
     * @tags Auth
     * @name EmailValidate
     * @summary Verify Email
     * @request POST:/auth/email/validate/{token}
     * @response `200` `void` OK
     */
    emailValidate: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/auth/email/validate/${token}`,
        method: 'POST',
        ...params,
      }),

    /**
     * @description Update user password to new by using reset token.
     *
     * @tags Auth
     * @name PasswordReset
     * @summary Password Reset
     * @request POST:/auth/password/reset/{token}
     * @response `200` `void` OK
     */
    passwordReset: (
      token: string,
      data: { new_password?: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/auth/password/reset/${token}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name TokenVerify
     * @summary Password Verify
     * @request POST:/auth/token/verify
     * @response `200` `void` OK
     */
    tokenVerify: (
      data: { token?: string; email?: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/auth/token/verify`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name TokenRefresh
     * @summary Refresh Token
     * @request POST:/auth/token/refresh
     * @response `200` `void` OK
     */
    tokenRefresh: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/auth/token/refresh`,
        method: 'POST',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name ProjectUserList
     * @summary Project Users
     * @request GET:/projects/{projectId}/users
     * @response `200` `{ users?: { list: (UserType)[], pageInfo: PaginatedType } }` OK
     */
    projectUserList: (projectId: string, params: RequestParams = {}) =>
      this.request<
        { users?: { list: UserType[]; pageInfo: PaginatedType } },
        any
      >({
        path: `/projects/${projectId}/users`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name ProjectUserAdd
     * @summary Project User Add
     * @request POST:/projects/{projectId}/users
     * @response `200` `any` OK
     */
    projectUserAdd: (
      projectId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/projects/${projectId}/users`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name ProjectUserUpdate
     * @summary Project User Update
     * @request PUT:/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserUpdate: (
      projectId: string,
      userId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/projects/${projectId}/users/${userId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name ProjectUserRemove
     * @summary Project User Remove
     * @request DELETE:/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserRemove: (
      projectId: string,
      userId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/projects/${projectId}/users/${userId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),
  };
  project = {
    /**
     * No description
     *
     * @tags Project
     * @name MetaGet
     * @summary Project Info
     * @request GET:/projects/{projectId}/info
     * @response `200` `{ Node?: string, Arch?: string, Platform?: string, Docker?: boolean, Database?: string, ProjectOnRootDB?: string, RootDB?: string, PackageVersion?: string }` OK
     */
    metaGet: (projectId: string, params: RequestParams = {}) =>
      this.request<
        {
          Node?: string;
          Arch?: string;
          Platform?: string;
          Docker?: boolean;
          Database?: string;
          ProjectOnRootDB?: string;
          RootDB?: string;
          PackageVersion?: string;
        },
        any
      >({
        path: `/projects/${projectId}/info`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name ModelVisibilityList
     * @summary UI ACL
     * @request GET:/projects/{projectId}/modelVisibility
     * @response `200` `(any)[]` OK
     */
    modelVisibilityList: (
      projectId: string,
      query?: { includeM2M?: boolean },
      params: RequestParams = {}
    ) =>
      this.request<any[], any>({
        path: `/projects/${projectId}/modelVisibility`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name ModelVisibilitySet
     * @request POST:/projects/{projectId}/modelVisibility
     * @response `200` `any` OK
     */
    modelVisibilitySet: (
      projectId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/projects/${projectId}/modelVisibility`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Read project details
     *
     * @tags Project
     * @name List
     * @request GET:/projects/
     * @response `201` `ProjectListType`
     */
    list: (
      query?: { page?: number; pageSize?: number; sort?: string },
      params: RequestParams = {}
    ) =>
      this.request<ProjectListType, any>({
        path: `/projects/`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name Create
     * @request POST:/projects/
     * @response `200` `ProjectType` OK
     */
    create: (
      data: ProjectType & { external?: boolean },
      params: RequestParams = {}
    ) =>
      this.request<ProjectType, any>({
        path: `/projects/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Read project details
     *
     * @tags Project
     * @name Read
     * @request GET:/projects/{projectId}
     * @response `200` `object` OK
     */
    read: (projectId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/projects/${projectId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name Delete
     * @request DELETE:/projects/{projectId}
     * @response `200` `void` OK
     */
    delete: (projectId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/projects/${projectId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Read project details
     *
     * @tags Project
     * @name SharedBaseGet
     * @request GET:/projects/{projectId}/sharedBase
     * @response `200` `{ uuid?: string, url?: string }` OK
     */
    sharedBaseGet: (projectId: string, params: RequestParams = {}) =>
      this.request<{ uuid?: string; url?: string }, any>({
        path: `/projects/${projectId}/sharedBase`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name SharedBaseDisable
     * @request DELETE:/projects/{projectId}/sharedBase
     * @response `200` `void` OK
     */
    sharedBaseDisable: (projectId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/projects/${projectId}/sharedBase`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name SharedBaseCreate
     * @request POST:/projects/{projectId}/sharedBase
     * @response `200` `{ url?: string, uuid?: string }` OK
     */
    sharedBaseCreate: (
      projectId: string,
      data: { roles?: string; password?: string },
      params: RequestParams = {}
    ) =>
      this.request<{ url?: string; uuid?: string }, any>({
        path: `/projects/${projectId}/sharedBase`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name SharedBaseUpdate
     * @request PUT:/projects/{projectId}/sharedBase
     * @response `200` `void` OK
     */
    sharedBaseUpdate: (
      projectId: string,
      data: { roles?: string; password?: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/projects/${projectId}/sharedBase`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name MetaDiffSync
     * @request POST:/projects/{projectId}/metaDiff
     * @response `200` `any` OK
     */
    metaDiffSync: (projectId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/projects/${projectId}/metaDiff`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name MetaDiffGet
     * @request GET:/projects/{projectId}/metaDiff
     * @response `200` `any` OK
     */
    metaDiffGet: (projectId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/projects/${projectId}/metaDiff`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name AuditList
     * @request GET:project/{projectId}/audits
     * @response `200` `{ list: (AuditType)[], pageInfo: PaginatedType }` OK
     */
    auditList: (
      projectId: string,
      query?: { offset?: string; limit?: string },
      params: RequestParams = {}
    ) =>
      this.request<{ list: AuditType[]; pageInfo: PaginatedType }, any>({
        path: `project/${projectId}/audits`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  public = {
    /**
     * @description Read project details
     *
     * @tags Public
     * @name SharedBaseGet
     * @request GET:/public/sharedBase/{sharedBaseUuid}
     * @response `200` `{ project_id?: string }` OK
     */
    sharedBaseGet: (sharedBaseUuid: string, params: RequestParams = {}) =>
      this.request<{ project_id?: string }, any>({
        path: `/public/sharedBase/${sharedBaseUuid}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataList
     * @request POST:/public/data/{uuid}/list
     * @response `200` `any` OK
     */
    dataList: (
      uuid: string,
      data: { password?: string; sorts?: SortType[]; filters?: FilterType[] },
      query?: { limit?: string; offset?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/list`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataNestedList
     * @request GET:/public/data/{uuid}/{rowId}/{relationType}/{columnId}
     * @response `200` `any` OK
     */
    dataNestedList: (
      uuid: string,
      rowId: string,
      relationType: 'mm' | 'hm',
      columnId: string,
      query?: { limit?: string; offset?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/${rowId}/${relationType}/${columnId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataNestedExcludedList
     * @request GET:/public/data/{uuid}/{rowId}/{relationType}/{columnId}/exclude
     * @response `200` `any` OK
     */
    dataNestedExcludedList: (
      uuid: string,
      rowId: string,
      relationType: 'mm' | 'hm',
      columnId: string,
      query?: { limit?: string; offset?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/${rowId}/${relationType}/${columnId}/exclude`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataCreate
     * @request POST:/public/data/{uuid}/create
     * @response `200` `any` OK
     */
    dataCreate: (
      uuid: string,
      data: { data?: any; password?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/create`,
        method: 'POST',
        body: data,
        type: ContentType.FormData,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name CsvExport
     * @request POST:/public/data/{uuid}/export/{type}
     * @response `200` `any` OK
     */
    csvExport: (
      uuid: string,
      type: 'csv' | 'excel',
      data: { password?: string; filters?: FilterType[]; sorts?: SortType[] },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/export/${type}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        wrapped: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataRelationList
     * @request POST:/public/data/{uuid}/relationTable/{relationColumnId}
     * @response `200` `any` OK
     */
    dataRelationList: (
      uuid: string,
      relationColumnId: string,
      data: { password?: string },
      query?: { limit?: string; offset?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/public/data/${uuid}/relationTable/${relationColumnId}`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name SharedViewMetaGet
     * @request POST:/public/meta/{uuid}
     * @response `200` `object` OK
     */
    sharedViewMetaGet: (
      uuid: string,
      data: { password?: string },
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/public/meta/${uuid}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  dbView = {
    /**
     * No description
     *
     * @tags DB View
     * @name Upload
     * @summary Attachment
     * @request POST:/projects/{projectId}/views/{viewId}/upload
     */
    upload: (
      projectId: string,
      viewId: string,
      data: { files?: any; json?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/projects/${projectId}/views/${viewId}/upload`,
        method: 'POST',
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name Update
     * @request PUT:/views/{viewId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      data: {
        order?: string;
        title?: string;
        show_system_fields?: boolean;
        lock_type?: 'collaborative' | 'locked' | 'personal';
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name Delete
     * @request DELETE:/views/{viewId}
     * @response `200` `void` OK
     */
    delete: (viewId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name ShowAllColumn
     * @request POST:/views/{viewId}/showAll
     * @response `200` `void` OK
     */
    showAllColumn: (
      viewId: string,
      query?: { ignoreIds?: any[] },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}/showAll`,
        method: 'POST',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name HideAllColumn
     * @request POST:/views/{viewId}/hideAll
     * @response `200` `void` OK
     */
    hideAllColumn: (
      viewId: string,
      query?: { ignoreIds?: any[] },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}/hideAll`,
        method: 'POST',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridCreate
     * @request POST:/tables/{tableId}/grids
     * @response `200` `GridType` OK
     */
    gridCreate: (tableId: string, data: GridType, params: RequestParams = {}) =>
      this.request<GridType, any>({
        path: `/tables/${tableId}/grids`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridUpdate
     * @request PUT:/tables/{tableId}/grids/{gridId}
     * @response `200` `void` OK
     */
    gridUpdate: (tableId: string, gridId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}/grids/${gridId}`,
        method: 'PUT',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridDelete
     * @request DELETE:/tables/{tableId}/grids/{gridId}
     * @response `200` `void` OK
     */
    gridDelete: (tableId: string, gridId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}/grids/${gridId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridRead
     * @request GET:/tables/{tableId}/grids/{gridId}
     * @response `200` `void` OK
     */
    gridRead: (tableId: string, gridId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}/grids/${gridId}`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name FormCreate
     * @request POST:/tables/{tableId}/forms
     * @response `200` `FormType` OK
     */
    formCreate: (tableId: string, data: FormType, params: RequestParams = {}) =>
      this.request<FormType, any>({
        path: `/tables/${tableId}/forms`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name FormUpdate
     * @request PUT:/forms/{formId}
     * @response `200` `void` OK
     */
    formUpdate: (formId: string, data: FormType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/forms/${formId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name FormRead
     * @request GET:/forms/{formId}
     * @response `200` `FormType` OK
     */
    formRead: (formId: string, params: RequestParams = {}) =>
      this.request<FormType, any>({
        path: `/forms/${formId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name FormColumnUpdate
     * @request PUT:/formColumns/{columnId}
     * @response `200` `any` OK
     */
    formColumnUpdate: (
      columnId: string,
      data: FormColumnType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/formColumns/${columnId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridColumnsList
     * @request GET:/grid/{gidId}/gridColumns
     * @response `200` `(GridColumnType)[]` OK
     */
    gridColumnsList: (gidId: string, params: RequestParams = {}) =>
      this.request<GridColumnType[], any>({
        path: `/grid/${gidId}/gridColumns`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GridColumnUpdate
     * @request PUT:/gridColumns/{columnId}
     * @response `200` `any` OK
     */
    gridColumnUpdate: (
      columnId: string,
      data: GridColumnType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/gridColumns/${columnId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GalleryCreate
     * @request POST:/tables/{tableId}/galleries
     * @response `200` `object` OK
     */
    galleryCreate: (
      tableId: string,
      data: GalleryType,
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/tables/${tableId}/galleries`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GalleryUpdate
     * @request PUT:/galleries/{galleryId}
     * @response `200` `void` OK
     */
    galleryUpdate: (
      galleryId: string,
      data: GalleryType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/galleries/${galleryId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GalleryDelete
     * @request DELETE:/galleries/{galleryId}
     * @response `200` `void` OK
     */
    galleryDelete: (galleryId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/galleries/${galleryId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name GalleryRead
     * @request GET:/galleries/{galleryId}
     * @response `200` `GalleryType` OK
     */
    galleryRead: (galleryId: string, params: RequestParams = {}) =>
      this.request<GalleryType, any>({
        path: `/galleries/${galleryId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name KanbanCreate
     * @request POST:/tables/{tableId}/kanbans
     * @response `200` `void` OK
     */
    kanbanCreate: (tableId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}/kanbans`,
        method: 'POST',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name KanbanUpdate
     * @request PUT:/tables/{tableId}/kanbans/{kanbanId}
     * @response `200` `void` OK
     */
    kanbanUpdate: (
      tableId: string,
      kanbanId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/kanbans/${kanbanId}`,
        method: 'PUT',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name KanbanDelete
     * @request DELETE:/tables/{tableId}/kanbans/{kanbanId}
     * @response `200` `void` OK
     */
    kanbanDelete: (
      tableId: string,
      kanbanId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/kanbans/${kanbanId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name KanbanRead
     * @request GET:/tables/{tableId}/kanbans/{kanbanId}
     * @response `200` `void` OK
     */
    kanbanRead: (
      tableId: string,
      kanbanId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/kanbans/${kanbanId}`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View
     * @name List
     * @request GET:/tables/{tableId}/views
     * @response `200` `ViewListType`
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<ViewListType, any>({
        path: `/tables/${tableId}/views`,
        method: 'GET',
        ...params,
      }),
  };
  dbTable = {
    /**
     * No description
     *
     * @tags DB Table
     * @name Create
     * @request POST:/projects/{projectId}/{baseId}/tables
     * @response `200` `TableType` OK
     */
    create: (
      projectId: string,
      baseId: string,
      data: TableReqType,
      params: RequestParams = {}
    ) =>
      this.request<TableType, any>({
        path: `/projects/${projectId}/${baseId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table
     * @name List
     * @request GET:/projects/{projectId}/{baseId}/tables
     * @response `200` `TableListType`
     */
    list: (
      projectId: string,
      baseId: string,
      query?: {
        page?: number;
        pageSize?: number;
        sort?: string;
        includeM2M?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<TableListType, any>({
        path: `/projects/${projectId}/${baseId}/tables`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table
     * @name Read
     * @request GET:/tables/{tableId}
     * @response `200` `TableInfoType` OK
     */
    read: (tableId: string, params: RequestParams = {}) =>
      this.request<TableInfoType, any>({
        path: `/tables/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table
     * @name Update
     * @request PUT:/tables/{tableId}
     * @response `200` `any` OK
     */
    update: (
      tableId: string,
      data: { title?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/tables/${tableId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table
     * @name Delete
     * @request DELETE:/tables/{tableId}
     * @response `200` `void` OK
     */
    delete: (tableId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table
     * @name Reorder
     * @request POST:/tables/{tableId}/reorder
     * @response `200` `void` OK
     */
    reorder: (
      tableId: string,
      data: { order?: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/reorder`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  dbTableColumn = {
    /**
     * @description Read project details
     *
     * @tags DB Table column
     * @name List
     * @summary Column List
     * @request GET:/tables/{tableId}/columns
     * @response `200` `ColumnListType`
     * @response `201` `ColumnType` Created
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<ColumnListType, any>({
        path: `/tables/${tableId}/columns`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table column
     * @name Create
     * @summary Column create
     * @request POST:/tables/{tableId}/columns
     * @response `200` `void` OK
     */
    create: (
      tableId: string,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Read project details
     *
     * @tags DB Table column
     * @name Read
     * @summary Column Read
     * @request GET:/tables/{tableId}/columns/{columnId}
     * @response `200` `ColumnType` OK
     */
    read: (tableId: string, columnId: string, params: RequestParams = {}) =>
      this.request<ColumnType, any>({
        path: `/tables/${tableId}/columns/${columnId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table column
     * @name Update
     * @summary Column Update
     * @request PUT:/tables/{tableId}/columns/{columnId}
     * @response `200` `ColumnType` OK
     */
    update: (
      tableId: string,
      columnId: string,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<ColumnType, any>({
        path: `/tables/${tableId}/columns/${columnId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table column
     * @name Delete
     * @request DELETE:/tables/{tableId}/columns/{columnId}
     * @response `200` `void` OK
     */
    delete: (tableId: string, columnId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/tables/${tableId}/columns/${columnId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table column
     * @name PrimaryColumnSet
     * @request POST:/tables/{tableId}/columns/{columnId}/primary
     * @response `200` `void` OK
     */
    primaryColumnSet: (
      tableId: string,
      columnId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/tables/${tableId}/columns/${columnId}/primary`,
        method: 'POST',
        ...params,
      }),
  };
  dbViewColumn = {
    /**
     * No description
     *
     * @tags DB View Column
     * @name List
     * @request GET:/views/{viewId}/columns
     */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/views/${viewId}/columns`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Column
     * @name Create
     * @request POST:/views/{viewId}/columns
     * @response `200` `void` OK
     */
    create: (viewId: string, data: any, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Column
     * @name Read
     * @request GET:/views/{viewId}/columns/{columnId}
     * @response `200` `any` OK
     */
    read: (viewId: string, columnId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/views/${viewId}/columns/${columnId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Column
     * @name Update
     * @request PUT:/views/{viewId}/columns/{columnId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      columnId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}/columns/${columnId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  dbViewShare = {
    /**
     * No description
     *
     * @tags DB View Share
     * @name Create
     * @request POST:/views/{viewId}/share
     * @response `200` `{ uuid?: string }` OK
     */
    create: (viewId: string, params: RequestParams = {}) =>
      this.request<{ uuid?: string }, any>({
        path: `/views/${viewId}/share`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Share
     * @name Update
     * @request PUT:/views/{viewId}/share
     * @response `200` `SharedViewType` OK
     */
    update: (
      viewId: string,
      data: { password?: string },
      params: RequestParams = {}
    ) =>
      this.request<SharedViewType, any>({
        path: `/views/${viewId}/share`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Share
     * @name Delete
     * @request DELETE:/views/{viewId}/share
     * @response `200` `void` OK
     */
    delete: (viewId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/share`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Share
     * @name List
     * @request GET:/tables/{viewId}/share
     * @response `200` `(any)[]` OK
     */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<any[], any>({
        path: `/tables/${viewId}/share`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTableSort = {
    /**
     * No description
     *
     * @tags DB Table Sort
     * @name List
     * @request GET:/views/{viewId}/sorts
     * @response `200` `{ uuid?: string, url?: string }` OK
     */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<{ uuid?: string; url?: string }, any>({
        path: `/views/${viewId}/sorts`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Sort
     * @name Create
     * @request POST:/views/{viewId}/sorts
     * @response `200` `void` OK
     */
    create: (viewId: string, data: SortType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/sorts`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Sort
     * @name Get
     * @request GET:/views/{viewId}/sorts/{sortId}
     * @response `200` `SortType` OK
     */
    get: (viewId: string, sortId: string, params: RequestParams = {}) =>
      this.request<SortType, any>({
        path: `/views/${viewId}/sorts/${sortId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Sort
     * @name Update
     * @request PUT:/views/{viewId}/sorts/{sortId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      sortId: string,
      data: SortType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}/sorts/${sortId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Sort
     * @name Delete
     * @request DELETE:/views/{viewId}/sorts/{sortId}
     * @response `200` `void` OK
     */
    delete: (viewId: string, sortId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/sorts/${sortId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbTableFilter = {
    /**
     * No description
     *
     * @tags DB Table Filter
     * @name Read
     * @request GET:/views/{viewId}/filters
     * @response `200` `FilterListType`
     */
    read: (viewId: string, params: RequestParams = {}) =>
      this.request<FilterListType, any>({
        path: `/views/${viewId}/filters`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Filter
     * @name Create
     * @request POST:/views/{viewId}/filters
     * @response `200` `void` OK
     */
    create: (viewId: string, data: FilterType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Filter
     * @name Get
     * @request GET:/views/{viewId}/filters/{filterId}
     * @response `200` `FilterType` OK
     */
    get: (viewId: string, filterId: string, params: RequestParams = {}) =>
      this.request<FilterType, any>({
        path: `/views/${viewId}/filters/${filterId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Filter
     * @name Update
     * @request PUT:/views/{viewId}/filters/{filterId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      filterId: string,
      data: FilterType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/views/${viewId}/filters/${filterId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Filter
     * @name Delete
     * @request DELETE:/views/{viewId}/filters/{filterId}
     * @response `200` `void` OK
     */
    delete: (viewId: string, filterId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/views/${viewId}/filters/${filterId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Filter
     * @name ChildrenRead
     * @request GET:/views/{viewId}/filters/{filterParentId}/children
     * @response `200` `FilterType` OK
     */
    childrenRead: (
      viewId: string,
      filterParentId: string,
      params: RequestParams = {}
    ) =>
      this.request<FilterType, any>({
        path: `/views/${viewId}/filters/${filterParentId}/children`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTableWebhookFilter = {
    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name Read
     * @request GET:/hooks/{hookId}/filters
     * @response `200` `FilterListType`
     */
    read: (hookId: string, params: RequestParams = {}) =>
      this.request<FilterListType, any>({
        path: `/hooks/${hookId}/filters`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name Create
     * @request POST:/hooks/{hookId}/filters
     * @response `200` `void` OK
     */
    create: (hookId: string, data: FilterType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/hooks/${hookId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name Get
     * @request GET:/hooks/{viewId}/filters/{filterId}
     * @response `200` `FilterType` OK
     */
    get: (viewId: string, filterId: string, params: RequestParams = {}) =>
      this.request<FilterType, any>({
        path: `/hooks/${viewId}/filters/${filterId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name Update
     * @request PUT:/hooks/{viewId}/filters/{filterId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      filterId: string,
      data: FilterType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/hooks/${viewId}/filters/${filterId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name Delete
     * @request DELETE:/hooks/{viewId}/filters/{filterId}
     * @response `200` `void` OK
     */
    delete: (viewId: string, filterId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/hooks/${viewId}/filters/${filterId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook Filter
     * @name ChildrenRead
     * @request GET:/hooks/{viewId}/filters/{filterParentId}/children
     * @response `200` `FilterType` OK
     */
    childrenRead: (
      viewId: string,
      filterParentId: string,
      params: RequestParams = {}
    ) =>
      this.request<FilterType, any>({
        path: `/hooks/${viewId}/filters/${filterParentId}/children`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  data = {
    /**
     * No description
     *
     * @tags Data
     * @name List
     * @request GET:/data/{tableId}
     * @response `200` `any` OK
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/data/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name Create
     * @request POST:/data/{tableId}
     * @response `200` `any` OK
     */
    create: (tableId: string, data: any, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/data/${tableId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description CSV or Excel export
     *
     * @tags Data
     * @name CsvExport
     * @request GET:/data/{tableId}/export/{type}
     * @response `200` `any` OK
     */
    csvExport: (
      tableId: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${tableId}/export/${type}`,
        method: 'GET',
        wrapped: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name NestedList
     * @request GET:/data/{tableId}/{rowId}/{relationType}/{colId}
     * @response `201` `any` Created
     */
    nestedList: (
      tableId: string,
      rowId: string,
      colId: string,
      relationType: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${tableId}/${rowId}/${relationType}/${colId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name NestedExcludedList
     * @request GET:/data/{tableId}/{rowId}/{relationType}/{colId}/exclude
     * @response `201` `any` Created
     */
    nestedExcludedList: (
      tableId: string,
      rowId: string,
      colId: string,
      relationType: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${tableId}/${rowId}/${relationType}/${colId}/exclude`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name NestedAdd
     * @request POST:/data/{tableId}/{rowId}/{relationType}/{colId}/{referenceTableRowId}
     * @response `201` `any` Created
     */
    nestedAdd: (
      tableId: string,
      rowId: string,
      colId: string,
      relationType: string,
      referenceTableRowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${tableId}/${rowId}/${relationType}/${colId}/${referenceTableRowId}`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name NestedDelete
     * @request DELETE:/data/{tableId}/{rowId}/{relationType}/{colId}/{referenceTableRowId}
     * @response `200` `void` OK
     */
    nestedDelete: (
      tableId: string,
      rowId: string,
      colId: string,
      relationType: string,
      referenceTableRowId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/data/${tableId}/${rowId}/${relationType}/${colId}/${referenceTableRowId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name Read
     * @request GET:/data/{tableId}/{rowId}
     * @response `201` `any` Created
     */
    read: (tableId: string, rowId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/data/${tableId}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name Update
     * @request PUT:/data/{tableId}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      tableId: string,
      rowId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${tableId}/${rowId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Data
     * @name Delete
     * @request DELETE:/data/{tableId}/{rowId}
     * @response `200` `void` OK
     */
    delete: (tableId: string, rowId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/data/${tableId}/${rowId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbTableRow = {
    /**
     * No description
     *
     * @tags DB Table Row
     * @name List
     * @request GET:/data/{orgs}/{projectName}/{tableAlias}
     * @response `200` `any` OK
     */
    list: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      query?: { fields?: any[]; sort?: any[]; where?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name Create
     * @request POST:/data/{orgs}/{projectName}/{tableAlias}
     * @response `200` `any` OK
     */
    create: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name Read
     * @request GET:/data/{orgs}/{projectName}/{tableAlias}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name Update
     * @request PUT:/data/{orgs}/{projectName}/{tableAlias}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      rowId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/${rowId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name ModelDelete
     * @request DELETE:/data/{orgs}/{projectName}/{tableAlias}/{rowId}
     * @response `200` `void` OK
     */
    modelDelete: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/${rowId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name BulkDelete
     * @request DELETE:/bulkData/{orgs}/{projectName}/{tableAlias}/
     * @response `200` `void` OK
     */
    bulkDelete: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      data: any[],
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/bulkData/${orgs}/${projectName}/${tableAlias}/`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name BulkInsert
     * @request POST:/bulkData/{orgs}/{projectName}/{tableAlias}/
     * @response `200` `void` OK
     */
    bulkInsert: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      data: any[],
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/bulkData/${orgs}/${projectName}/${tableAlias}/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name BulkUpdate
     * @request PATCH:/bulkData/{orgs}/{projectName}/{tableAlias}/
     * @response `200` `any` OK
     */
    bulkUpdate: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/bulkData/${orgs}/${projectName}/${tableAlias}/`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name BulkUpdateAll
     * @request PATCH:/bulkData/{orgs}/{projectName}/{tableAlias}/all
     * @response `200` `any` OK
     */
    bulkUpdateAll: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      data: object,
      query?: { where?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/bulkData/${orgs}/${projectName}/${tableAlias}/all`,
        method: 'PATCH',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Row
     * @name BulkDeleteAll
     * @request DELETE:/bulkData/{orgs}/{projectName}/{tableAlias}/all
     * @response `200` `any` OK
     */
    bulkDeleteAll: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      query?: { where?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/bulkData/${orgs}/${projectName}/${tableAlias}/all`,
        method: 'DELETE',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  dbViewRow = {
    /**
     * No description
     *
     * @tags DB View Row
     * @name List
     * @request GET:/data/{orgs}/{projectName}/{tableAlias}/views/{viewName}
     * @response `200` `any` OK
     */
    list: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      viewName: string,
      query?: { fields?: any[]; sort?: any[]; where?: string; nested?: any },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/views/${viewName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Row
     * @name Create
     * @request POST:/data/{orgs}/{projectName}/{tableAlias}/views/{viewName}
     * @response `200` `any` OK
     */
    create: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      viewName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/views/${viewName}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Row
     * @name Read
     * @request GET:/data/{orgs}/{projectName}/{tableAlias}/views/{viewName}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      viewName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/views/${viewName}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Row
     * @name Update
     * @request PUT:/data/{orgs}/{projectName}/{tableAlias}/views/{viewName}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      viewName: string,
      rowId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/views/${viewName}/${rowId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB View Row
     * @name Delete
     * @request DELETE:/data/{orgs}/{projectName}/{tableAlias}/views/{viewName}/{rowId}
     * @response `200` `void` OK
     */
    delete: (
      orgs: string,
      projectName: string,
      tableAlias: string,
      viewName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/data/${orgs}/${projectName}/${tableAlias}/views/${viewName}/${rowId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  utils = {
    /**
     * No description
     *
     * @tags Utils
     * @name CommentList
     * @request GET:/audits/comments
     * @response `201` `any` Created
     */
    commentList: (
      query: { row_id: string; fk_model_id: string; comments_only?: boolean },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/audits/comments`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name CommentRow
     * @request POST:/audits/comments
     * @response `200` `void` OK
     */
    commentRow: (
      data: { row_id: string; fk_model_id: string; comment: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/audits/comments`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name CommentCount
     * @request GET:/audits/comments/count
     * @response `201` `any` Created
     */
    commentCount: (
      query: { ids: any[]; fk_model_id: string },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/audits/comments/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name AuditRowUpdate
     * @request POST:/audits/rowUpdate
     * @response `200` `void` OK
     */
    auditRowUpdate: (
      data: {
        fk_model_id?: string;
        column_name?: string;
        row_id?: string;
        value?: string;
        prev_value?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/audits/rowUpdate`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name TestConnection
     * @request POST:/testConnection
     * @response `200` `{ code?: number, message?: string }` OK
     */
    testConnection: (data: any, params: RequestParams = {}) =>
      this.request<{ code?: number; message?: string }, any>({
        path: `/testConnection`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name AppInfo
     * @request GET:/appInfo
     * @response `200` `any` OK
     */
    appInfo: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/appInfo`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Get All K/V pairs in NocoCache
     *
     * @tags Utils
     * @name CacheGet
     * @summary Your GET endpoint
     * @request GET:/cache
     */
    cacheGet: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/cache`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Delete All K/V pairs in NocoCache
     *
     * @tags Utils
     * @name CacheDelete
     * @request DELETE:/cache
     * @response `200` `void` OK
     */
    cacheDelete: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/cache`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbTableWebhook = {
    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name List
     * @request GET:/tables/{tableId}/hooks
     * @response `200` `{ list: (HookType)[], pageInfo: PaginatedType }` OK
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<{ list: HookType[]; pageInfo: PaginatedType }, any>({
        path: `/tables/${tableId}/hooks`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name Create
     * @request POST:/tables/{tableId}/hooks
     * @response `200` `AuditType` OK
     */
    create: (tableId: string, data: AuditType, params: RequestParams = {}) =>
      this.request<AuditType, any>({
        path: `/tables/${tableId}/hooks`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name Test
     * @request POST:/tables/{tableId}/hooks/test
     * @response `200` `any` OK
     */
    test: (
      tableId: string,
      data: { payload?: { data?: any; user?: any }; hook?: HookType },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/tables/${tableId}/hooks/test`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name Update
     * @request PUT:/hooks/{hookId}
     * @response `200` `HookType` OK
     */
    update: (hookId: string, data: HookType, params: RequestParams = {}) =>
      this.request<HookType, any>({
        path: `/hooks/${hookId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name Delete
     * @request DELETE:/hooks/{hookId}
     * @response `200` `void` OK
     */
    delete: (hookId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/hooks/${hookId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB Table Webhook
     * @name SamplePayloadGet
     * @request GET:/tables/{tableId}/hooks/samplePayload/{operation}
     * @response `200` `{ plugins?: { list: (PluginType)[], pageInfo: PaginatedType } }` OK
     */
    samplePayloadGet: (
      tableId: string,
      operation: 'update' | 'delete' | 'insert',
      params: RequestParams = {}
    ) =>
      this.request<
        { plugins?: { list: PluginType[]; pageInfo: PaginatedType } },
        any
      >({
        path: `/tables/${tableId}/hooks/samplePayload/${operation}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  plugin = {
    /**
     * No description
     *
     * @tags Plugin
     * @name List
     * @request GET:/plugins
     * @response `200` `{ list?: (PluginType)[], pageInfo?: PaginatedType }` OK
     */
    list: (params: RequestParams = {}) =>
      this.request<{ list?: PluginType[]; pageInfo?: PaginatedType }, any>({
        path: `/plugins`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Check plugin is active or not
     *
     * @tags Plugin
     * @name Status
     * @request GET:/plugins/{pluginTitle}/status
     * @response `200` `boolean` OK
     */
    status: (pluginTitle: string, params: RequestParams = {}) =>
      this.request<boolean, any>({
        path: `/plugins/${pluginTitle}/status`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Plugin
     * @name Test
     * @request POST:/plugins/test
     * @response `200` `any` OK
     * @response `400` `void` Bad Request
     * @response `401` `void` Unauthorized
     */
    test: (
      data: { id?: string; title?: string; input?: any; category?: string },
      params: RequestParams = {}
    ) =>
      this.request<any, void>({
        path: `/plugins/test`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Plugin
     * @name Update
     * @request PUT:/plugins/{pluginId}
     * @response `200` `PluginType` OK
     */
    update: (pluginId: string, data: PluginType, params: RequestParams = {}) =>
      this.request<PluginType, any>({
        path: `/plugins/${pluginId}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Plugin
     * @name Read
     * @request GET:/plugins/{pluginId}
     * @response `200` `PluginType` OK
     */
    read: (pluginId: string, params: RequestParams = {}) =>
      this.request<PluginType, any>({
        path: `/plugins/${pluginId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  apiToken = {
    /**
     * No description
     *
     * @tags Api token
     * @name List
     * @summary Your GET endpoint
     * @request GET:/projects/{projectId}/apiTokens
     * @response `200` `(ApiTokenType)[]` OK
     */
    list: (projectId: string, params: RequestParams = {}) =>
      this.request<ApiTokenType[], any>({
        path: `/projects/${projectId}/apiTokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Api token
     * @name Create
     * @request POST:/projects/{projectId}/apiTokens
     * @response `200` `void` OK
     * @response `201` `ApiTokenType` Created
     */
    create: (
      projectId: string,
      data: { description?: string },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/projects/${projectId}/apiTokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Api token
     * @name Delete
     * @request DELETE:/projects/{projectId}/apiTokens/{token}
     * @response `200` `void` OK
     */
    delete: (projectId: string, token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/projects/${projectId}/apiTokens/${token}`,
        method: 'DELETE',
        ...params,
      }),
  };
}
