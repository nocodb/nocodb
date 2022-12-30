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
  id: string;
  /** @format email */
  email: string;
  roles?: string;
  /** Set to true if the user's email has been verified. */
  email_verified: boolean;
  /**
   * The date that the user was created.
   * @format date
   */
  created_at?: string;
  /**
   * The date that the user was created.
   * @format date
   */
  updated_at?: string;
  display_name?: string;
  user_name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
}

export interface WorkspaceUserType {
  /** @format email */
  email?: string;
  roles?: string;
  fk_user_id?: string;
  invite_token?: string;
  invite_accepted?: boolean;
}

export interface WorkspaceUserInviteType {
  /** @format email */
  email?: string;
  roles?: string;
}

/**
 * Book of Noco docs
 */
export interface BookType {
  /** Unique identifier for the given book. */
  id?: string;
  project_id?: string;
  pages_table_name?: string;
  title?: string;
  description?: string;
  create_by_id?: string;
  order?: number;
  slug?: string;
  is_published?: boolean;
  /** @format date */
  last_published_date?: string;
  last_published_by_id?: string;
  /** @format date */
  updated_at?: string;
  last_updated_by_id?: string;
  /** @format date */
  created_at?: string;
  created_by_id?: string;
  /** @format date */
  archived_date?: string;
  archived_by_id?: string;
  metaJson?: string | object;
}

/**
 * Page of Noco docs
 */
export interface DocsPageType {
  /** Unique identifier for the given page. */
  id?: string;
  title: string;
  description?: string;
  content: string;
  order?: number;
  published_content?: string;
  slug?: string;
  parent_page_id?: string;
  is_parent?: boolean;
  book_id?: string;
  is_published?: boolean;
  /** @format date */
  last_published_date?: string;
  last_published_by_id?: string;
  /** @format date */
  updated_at?: string;
  last_updated_by_id?: string;
  /** @format date */
  created_at?: string;
  created_by_id?: string;
  /** @format date */
  archived_date?: string;
  archived_by_id?: string;
  metaJson?: string | object;
}

export interface PageReqQueryParamsType {
  offset?: number;
  limit?: number;
  query?: string;
}

export interface UserListType {
  users: {
    list: UserType;
    pageInfo: PaginatedType;
  };
}

export interface ProjectReqType {
  title?: string;
  description?: string;
  color?: string;
  fk_workspace_id?: string;
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
  type?: string;
  prefix?: string;
  created_at?: any;
  updated_at?: any;
  slug?: string;
  fk_workspace_id?: string;
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
  order?: number;
  enabled?: boolean;
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
  bases: {
    list: BaseType[];
    pageInfo: PaginatedType;
  };
}

export interface TableType {
  id?: string;
  project_id?: string;
  base_id?: string;
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
  mm?: boolean | number;
  meta?: any;
}

export interface ViewType {
  id?: string;
  title: string;
  deleted?: boolean;
  order?: number;
  fk_model_id?: string;
  slug?: string;
  uuid?: string;
  meta?: any;
  show_system_fields?: boolean;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  type?: number;
  view?: FormType | GridType | GalleryType | KanbanType;
}

export interface TableInfoType {
  id?: string;
  fk_project_id?: string;
  fk_base_id?: string;
  title: string;
  table_name: string;
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
  mm?: boolean;
  columns: ColumnType[];
  meta?: any;
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
  value?: string | number | boolean | null;
  is_group?: boolean;
  children?: FilterType[];
  project_id?: string;
  base_id?: string;
  fk_parent_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
}

export interface FilterListType {
  filters: {
    list: FilterType[];
  };
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
  sorts: {
    list: SharedViewType[];
  };
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
  system?: number | boolean;
  meta?: any;
  colOptions?:
    | LinkToAnotherRecordType
    | FormulaType
    | RollupType
    | LookupType
    | SelectOptionsType
    | object;
}

export interface ColumnListType {
  columns: {
    list: ColumnType[];
  };
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
  formula_raw?: string;
  deleted?: string;
  order?: string;
}

export interface SelectOptionsType {
  options: SelectOptionType[];
}

export interface SelectOptionType {
  id?: string;
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
  lock_type?: 'collaborative' | 'locked' | 'personal';
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
  lock_type?: 'collaborative' | 'locked' | 'personal';
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
  columns?: KanbanColumnType[];
  fk_model_id?: string;
  fk_grp_col_id?: string | null;
  fk_cover_image_col_id?: string;
  meta?: string | object;
}

export interface FormType {
  id?: string;
  title?: string;
  heading?: string;
  subheading?: string;
  success_msg?: string;
  redirect_url?: string;
  redirect_after_secs?: string;
  email?: string;
  banner_image_url?: string;
  logo_url?: string;
  submit_another_form?: boolean;
  show_blank_form?: boolean;
  columns?: FormColumnType[];
  fk_model_id?: string;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  meta?: any;
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
  meta?: any;
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
  list?: ViewType[];
  pageInfo?: PaginatedType;
}

export interface WorkspaceListType {
  list?: WorkspaceType[];
  pageInfo?: PaginatedType;
}

export interface CowriterListType {
  list?: CowriterType[];
  pageInfo?: PaginatedType;
}

export interface WorkspaceUserListType {
  list?: WorkspaceUserType[];
  pageInfo?: PaginatedType;
}

export interface AttachmentType {
  url?: string;
  title?: string;
  mimetype?: string;
  size?: string;
  icon?: string;
}

export interface WorkspaceType {
  id?: string;
  title?: string;
  description?: string;
  meta?: any;
  fk_user_id?: string;
  deleted?: boolean;
  order?: number;
  deleted_at?: any;
  created_at?: any;
  updated_at?: any;
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
  input?: string | null;
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
  fk_user_id?: string;
  created_at?: any;
  updated_at?: any;
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

export interface NormalColumnRequestType {
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
}

export interface LinkToAnotherColumnReqType {
  uidt: 'LinkToAnotherRecord';
  title: string;
  virtual?: boolean;
  parentId: string;
  childId: string;
  type: 'hm' | 'bt' | 'mm';
}

export interface RollupColumnReqType {
  uidt?: 'Rollup';
  title?: string;
  fk_relation_column_id?: string;
  fk_rollup_column_id?: string;
  rollup_function?: string;
}

export interface LookupColumnReqType {
  uidt?: 'Lookup';
  title?: string;
  fk_relation_column_id?: string;
  fk_lookup_column_id?: string;
}

export interface FormulaColumnReqType {
  uidt?: string;
  formula_raw?: string;
  formula?: string;
  title?: string;
}

export type ColumnReqType = (
  | NormalColumnRequestType
  | LinkToAnotherColumnReqType
  | RollupColumnReqType
  | FormulaColumnReqType
  | LookupColumnReqType
) & {
  column_name?: string;
  title?: string;
  column_order?: {
    view_id?: string;
    order?: number;
  };
};

export interface UserInfoType {
  id?: string;
  email?: string;
  email_verified?: string;
  user_name?: string;
  display_name?: string;
  roles?: any;
}

export interface FollowerType {
  fk_follower_id?: string;
}

/**
 * Cowriter Model
 */
export interface CowriterType {
  id?: string;
  fk_model_id?: string;
  prompt_statement?: string;
  prompt_statement_template?: string;
  output?: string;
  is_read?: boolean;
  time_taken?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

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

export type RequestParams = Omit<FullRequestParams, 'body' | 'method' | 'path'>;

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
  nocoDocs = {
    /**
     * @description Get public book
     *
     * @tags Noco docs
     * @name GetPublicBook
     * @summary get public book
     * @request GET:/api/v1/public/docs/books/{slug}
     * @response `200` `BookType` OK
     */
    getPublicBook: (
      slug: string,
      query: {
        /** Project id */
        projectId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType, any>({
        path: `/api/v1/public/docs/books/${slug}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get public book
     *
     * @tags Noco docs
     * @name ListDraftPages
     * @summary list draft pages
     * @request GET:/api/v1/docs/page-drafts
     * @response `200` `(DocsPageType)[]` OK
     */
    listDraftPages: (
      query: {
        /** Project id */
        projectId: string;
        /** book id */
        bookId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<DocsPageType[], any>({
        path: `/api/v1/docs/page-drafts`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get public book
     *
     * @tags Noco docs
     * @name ListPublicPages
     * @summary list public pages
     * @request GET:/api/v1/public/docs/pages
     * @response `200` `(DocsPageType)[]` OK
     */
    listPublicPages: (
      query: {
        /** Project id */
        projectId: string;
        /** book id */
        bookId: string;
        /** parent_page_id */
        parent_page_id?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<DocsPageType[], any>({
        path: `/api/v1/public/docs/pages`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description List books
     *
     * @tags Noco docs
     * @name ListBooks
     * @summary List books
     * @request GET:/api/v1/docs/books
     * @response `200` `(BookType)[]` OK
     */
    listBooks: (
      query?: {
        /** Book id */
        id?: string;
        /** Project id */
        projectId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType[], any>({
        path: `/api/v1/docs/books`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete book
     *
     * @tags Noco docs
     * @name DeleteBook
     * @summary Delete book
     * @request DELETE:/api/v1/docs/book/{id}
     * @response `200` `void` OK
     */
    deleteBook: (
      id: string,
      query: {
        /** Project id */
        projectId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/docs/book/${id}`,
        method: 'DELETE',
        query: query,
        ...params,
      }),

    /**
     * @description Update book
     *
     * @tags Noco docs
     * @name UpdateBook
     * @summary Update book
     * @request PUT:/api/v1/docs/book/{id}
     * @response `200` `BookType` OK
     */
    updateBook: (
      id: string,
      data: {
        /** Book of Noco docs */
        attributes?: BookType;
        /** Project id */
        projectId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType, any>({
        path: `/api/v1/docs/book/${id}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create book
     *
     * @tags Noco docs
     * @name CreateBook
     * @summary Create book
     * @request POST:/api/v1/docs/book
     * @response `200` `BookType` OK
     */
    createBook: (
      data: {
        /** Book of Noco docs */
        attributes?: BookType;
        /** Project id */
        projectId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType, any>({
        path: `/api/v1/docs/book`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create book
     *
     * @tags Noco docs
     * @name CreateBookMagic
     * @summary Create magic
     * @request POST:/api/v1/docs/book/magic
     * @response `200` `BookType` OK
     */
    createBookMagic: (
      data: {
        /** Book of Noco docs */
        attributes?: BookType;
        /** Project id */
        projectId: string;
        /** Project id */
        bookId: string;
        /** Title */
        title: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType, any>({
        path: `/api/v1/docs/book/magic`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create book
     *
     * @tags Noco docs
     * @name ImportBook
     * @summary Import book
     * @request POST:/api/v1/docs/book/import
     * @response `200` `BookType` OK
     */
    importBook: (
      data: {
        /** Book of Noco docs */
        attributes?: BookType;
        /** Project id */
        bookId: string;
        /** Project id */
        user: string;
        /** Project id */
        repo: string;
        /** Project id */
        branch: string;
        /** Project id */
        path: string;
        /** Project id */
        projectId: string;
        /** Project id */
        type: string;
        /** Project id */
        from: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<BookType, any>({
        path: `/api/v1/docs/book/import`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description List pages
     *
     * @tags Noco docs
     * @name ListPages
     * @summary List pages
     * @request GET:/api/v1/docs/pages
     * @response `200` `(DocsPageType)[]` OK
     */
    listPages: (
      query: {
        /** Page number */
        projectId: string;
        /** book id */
        bookId: string;
        /** Parent page id */
        parent_page_id?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<DocsPageType[], any>({
        path: `/api/v1/docs/pages`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete page
     *
     * @tags Noco docs
     * @name DeletePage
     * @summary Delete page
     * @request DELETE:/api/v1/docs/page/{id}
     * @response `200` `void` OK
     */
    deletePage: (
      id: string,
      query: {
        /** Project id */
        projectId: string;
        /** Book id */
        bookId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/docs/page/${id}`,
        method: 'DELETE',
        query: query,
        ...params,
      }),

    /**
     * @description Update page
     *
     * @tags Noco docs
     * @name UpdatePage
     * @summary Update page
     * @request PUT:/api/v1/docs/page/{id}
     * @response `200` `DocsPageType` OK
     */
    updatePage: (
      id: string,
      data: {
        /** Page of Noco docs */
        attributes?: DocsPageType;
        /** Project id */
        projectId: string;
        /** Book id */
        bookId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<DocsPageType, any>({
        path: `/api/v1/docs/page/${id}`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create page
     *
     * @tags Noco docs
     * @name CreatePage
     * @summary Create page
     * @request POST:/api/v1/docs/page
     * @response `200` `DocsPageType` OK
     */
    createPage: (
      data: {
        /** Page of Noco docs */
        attributes?: DocsPageType;
        /** Project id */
        projectId: string;
        /** Book id */
        bookId: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<DocsPageType, any>({
        path: `/api/v1/docs/page`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  auth = {
    /**
 * @description Create a new user with provided email and password and first user is marked as super admin. 
 * 
 * @tags Auth
 * @name Signup
 * @summary Signup
 * @request POST:/api/v1/auth/user/signup
 * @response `200` `{
  token?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad Request
 * @response `401` `void` Unauthorized
 * @response `403` `void` Forbidden
 */
    signup: (
      data: {
        email?: string;
        password?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          token?: string;
        },
        {
          msg?: string;
        } | void
      >({
        path: `/api/v1/auth/user/signup`,
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
 * @request POST:/api/v1/auth/user/signin
 * @response `200` `{
  token?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad Request
 */
    signin: (
      data: {
        email: string;
        password: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          token?: string;
        },
        {
          msg?: string;
        }
      >({
        path: `/api/v1/auth/user/signin`,
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
     * @summary User info
     * @request GET:/api/v1/auth/user/me
     * @response `200` `UserInfoType` OK
     */
    me: (
      query?: {
        /** Pass project id to get project specific roles along with user info */
        project_id?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<UserInfoType, any>({
        path: `/api/v1/auth/user/me`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Emails user with a reset url.
     *
     * @tags Auth
     * @name PasswordForgot
     * @summary Password forgot
     * @request POST:/api/v1/auth/password/forgot
     * @response `200` `void` OK
     * @response `401` `void` Unauthorized
     */
    passwordForgot: (
      data: {
        email?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, void>({
        path: `/api/v1/auth/password/forgot`,
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
 * @summary Password change
 * @request POST:/api/v1/auth/password/change
 * @response `200` `{
  msg?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad request
 */
    passwordChange: (
      data: {
        currentPassword?: string;
        newPassword?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          msg?: string;
        },
        {
          msg?: string;
        }
      >({
        path: `/api/v1/auth/password/change`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Validtae password reset url token.
     *
     * @tags Auth
     * @name PasswordResetTokenValidate
     * @summary Reset token verify
     * @request POST:/api/v1/auth/token/validate/{token}
     * @response `200` `void` OK
     */
    passwordResetTokenValidate: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/auth/token/validate/${token}`,
        method: 'POST',
        ...params,
      }),

    /**
     * @description Api for verifying email where token need to be passed which is shared to user email.
     *
     * @tags Auth
     * @name EmailValidate
     * @summary Verify email
     * @request POST:/api/v1/auth/email/validate/{token}
     * @response `200` `void` OK
     */
    emailValidate: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/auth/email/validate/${token}`,
        method: 'POST',
        ...params,
      }),

    /**
     * @description Update user password to new by using reset token.
     *
     * @tags Auth
     * @name PasswordReset
     * @summary Password reset
     * @request POST:/api/v1/auth/password/reset/{token}
     * @response `200` `void` OK
     */
    passwordReset: (
      token: string,
      data: {
        new_password?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/auth/password/reset/${token}`,
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
     * @summary Refresh token
     * @request POST:/api/v1/auth/token/refresh
     * @response `200` `void` OK
     */
    tokenRefresh: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/auth/token/refresh`,
        method: 'POST',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Auth
 * @name ProjectUserList
 * @summary Project users
 * @request GET:/api/v1/db/meta/projects/{projectId}/users
 * @response `200` `{
  users?: {
  list: (UserType)[],
  pageInfo: PaginatedType,

},

}` OK
 */
    projectUserList: (projectId: string, params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: UserType[];
            pageInfo: PaginatedType;
          };
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/users`,
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
     * @request POST:/api/v1/db/meta/projects/{projectId}/users
     * @response `200` `any` OK
     */
    projectUserAdd: (
      projectId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/users`,
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
     * @summary Project user update
     * @request PATCH:/api/v1/db/meta/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserUpdate: (
      projectId: string,
      userId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/users/${userId}`,
        method: 'PATCH',
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
     * @summary Project user remove
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserRemove: (
      projectId: string,
      userId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/users/${userId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
     * @description Resend Invitation to a specific user
     *
     * @tags Auth
     * @name ProjectUserResendInvite
     * @request POST:/api/v1/db/meta/projects/{projectId}/users/{userId}/resend-invite
     * @response `200` `any` OK
     */
    projectUserResendInvite: (
      projectId: string,
      userId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/users/${userId}/resend-invite`,
        method: 'POST',
        format: 'json',
        ...params,
      }),
  };
  orgTokens = {
    /**
 * No description
 * 
 * @tags Org tokens
 * @name List
 * @summary Organisation API Tokens List
 * @request GET:/api/v1/tokens
 * @response `200` `{
  users?: {
  list: ((ApiTokenType & {
  created_by?: string,

}))[],
  pageInfo: PaginatedType,

},

}` OK
 */
    list: (params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: (ApiTokenType & {
              created_by?: string;
            })[];
            pageInfo: PaginatedType;
          };
        },
        any
      >({
        path: `/api/v1/tokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org tokens
     * @name Create
     * @request POST:/api/v1/tokens
     * @response `200` `void` OK
     */
    create: (data: ApiTokenType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/tokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org tokens
     * @name Delete
     * @request DELETE:/api/v1/tokens/{token}
     * @response `200` `void` OK
     */
    delete: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/tokens/${token}`,
        method: 'DELETE',
        ...params,
      }),
  };
  orgLicense = {
    /**
 * No description
 * 
 * @tags Org license
 * @name Get
 * @summary App license get
 * @request GET:/api/v1/license
 * @response `200` `{
  key?: string,

}` OK
 */
    get: (params: RequestParams = {}) =>
      this.request<
        {
          key?: string;
        },
        any
      >({
        path: `/api/v1/license`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org license
     * @name Set
     * @summary App license get
     * @request POST:/api/v1/license
     * @response `200` `void` OK
     */
    set: (
      data: {
        key?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/license`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  orgAppSettings = {
    /**
 * No description
 * 
 * @tags Org app settings
 * @name Get
 * @summary App settings get
 * @request GET:/api/v1/app-settings
 * @response `200` `{
  invite_only_signup?: boolean,

}` OK
 */
    get: (params: RequestParams = {}) =>
      this.request<
        {
          invite_only_signup?: boolean;
        },
        any
      >({
        path: `/api/v1/app-settings`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org app settings
     * @name Set
     * @summary App app settings get
     * @request POST:/api/v1/app-settings
     * @response `200` `void` OK
     */
    set: (
      data: {
        invite_only_signup?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/app-settings`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  orgUsers = {
    /**
 * No description
 * 
 * @tags Org users
 * @name List
 * @summary Organisation Users
 * @request GET:/api/v1/users
 * @response `200` `{
  users?: {
  list: (UserType)[],
  pageInfo: PaginatedType,

},

}` OK
 */
    list: (params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: UserType[];
            pageInfo: PaginatedType;
          };
        },
        any
      >({
        path: `/api/v1/users`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org users
     * @name Add
     * @summary Organisation User Add
     * @request POST:/api/v1/users
     * @response `200` `any` OK
     */
    add: (data: UserType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/users`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org users
     * @name Update
     * @summary Organisation User Update
     * @request PATCH:/api/v1/users/{userId}
     * @response `200` `void` OK
     */
    update: (userId: string, data: UserType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org users
     * @name Delete
     * @summary Organisation User Delete
     * @request DELETE:/api/v1/users/{userId}
     * @response `200` `void` OK
     */
    delete: (userId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Organisation User GetByUsername
     *
     * @tags Org users
     * @name GetByUsername
     * @summary Organisation User GetByUsername
     * @request GET:/api/v1/users/{username}
     * @response `200` `UserType` OK
     */
    getByUsername: (username: string, params: RequestParams = {}) =>
      this.request<UserType, any>({
        path: `/api/v1/users/${username}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Org users
     * @name ResendInvite
     * @summary Organisation User Invite
     * @request POST:/api/v1/users/{userId}/resend-invite
     * @response `200` `void` OK
     */
    resendInvite: (userId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/resend-invite`,
        method: 'POST',
        ...params,
      }),

    /**
     * @description Create Organisation User Profile
     *
     * @tags Org users
     * @name ProfileCreate
     * @summary Organisation User Profile - Create
     * @request POST:/api/v1/users/{userId}/profile
     * @response `200` `void` OK
     */
    profileCreate: (
      userId: string,
      data: UserType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/profile`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get Organisation User Profile
     *
     * @tags Org users
     * @name ProfileGet
     * @summary Organisation User Profile - Get
     * @request GET:/api/v1/users/{userId}/profile
     * @response `200` `void` OK
     */
    profileGet: (userId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/profile`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Update Organisation User Profile
     *
     * @tags Org users
     * @name ProfileUpdate
     * @request PATCH:/api/v1/users/{userId}/profile
     * @response `200` `void` OK
     */
    profileUpdate: (
      userId: string,
      data: UserType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/profile`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Create Organisation User Follower Relationship (Follow)
     *
     * @tags Org users
     * @name FollowerCreate
     * @summary Organisation User Follower - Create
     * @request POST:/api/v1/users/{userId}/follower
     * @response `200` `void` OK
     */
    followerCreate: (
      userId: string,
      data: FollowerType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/follower`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description List Organisation User Followers
     *
     * @tags Org users
     * @name FollowerList
     * @summary Organisation User Follower - List
     * @request GET:/api/v1/users/{userId}/follower
     * @response `200` `void` OK
     */
    followerList: (
      userId: string,
      data: FollowerType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/follower`,
        method: 'GET',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete Organisation User Follower Relationship (Unfollow)
     *
     * @tags Org users
     * @name FollowerDelete
     * @summary Organisation User Follower - Delete
     * @request DELETE:/api/v1/users/{userId}/follower
     * @response `200` `void` OK
     */
    followerDelete: (
      userId: string,
      data: FollowerType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/follower`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description List Organisation User Following
     *
     * @tags Org users
     * @name FollowingList
     * @summary Organisation User Following - List
     * @request GET:/api/v1/users/{userId}/following
     * @response `200` `void` OK
     */
    followingList: (userId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/following`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Check if Organisation User is following someone
     *
     * @tags Org users
     * @name IsFollowing
     * @summary Organisation User IsFollowing
     * @request GET:/api/v1/users/{userId}/isFollowing/{followerId}
     * @response `200` `void` OK
     */
    isFollowing: (
      userId: string,
      followerId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/isFollowing/${followerId}`,
        method: 'GET',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Org users
 * @name GeneratePasswordResetToken
 * @summary Organisation User Generate Password Reset Token
 * @request POST:/api/v1/users/{userId}/generate-reset-url
 * @response `200` `{
  reset_password_token?: string,
  reset_password_url?: string,

}` OK
 */
    generatePasswordResetToken: (userId: string, params: RequestParams = {}) =>
      this.request<
        {
          reset_password_token?: string;
          reset_password_url?: string;
        },
        any
      >({
        path: `/api/v1/users/${userId}/generate-reset-url`,
        method: 'POST',
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
 * @summary Project info
 * @request GET:/api/v1/db/meta/projects/{projectId}/info
 * @response `200` `{
  Node?: string,
  Arch?: string,
  Platform?: string,
  Docker?: boolean,
  Database?: string,
  ProjectOnRootDB?: string,
  RootDB?: string,
  PackageVersion?: string,

}` OK
 */
    metaGet: (projectId: string, params: RequestParams = {}, query: object) =>
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
        path: `/api/v1/db/meta/projects/${projectId}/info`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name ModelVisibilityList
     * @summary UI ACL
     * @request GET:/api/v1/db/meta/projects/{projectId}/visibility-rules
     * @response `200` `(any)[]` OK
     */
    modelVisibilityList: (
      projectId: string,
      query?: {
        includeM2M?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<any[], any>({
        path: `/api/v1/db/meta/projects/${projectId}/visibility-rules`,
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
     * @request POST:/api/v1/db/meta/projects/{projectId}/visibility-rules
     * @response `200` `any` OK
     */
    modelVisibilitySet: (
      projectId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/visibility-rules`,
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
     * @summary Project list
     * @request GET:/api/v1/db/meta/projects/
     * @response `201` `ProjectListType`
     */
    list: (
      query?: {
        page?: number;
        pageSize?: number;
        sort?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<ProjectListType, any>({
        path: `/api/v1/db/meta/projects/`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name Create
     * @summary Project create
     * @request POST:/api/v1/db/meta/projects/
     * @response `200` `ProjectType` OK
     */
    create: (
      data: ProjectType & {
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<ProjectType, any>({
        path: `/api/v1/db/meta/projects/`,
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
     * @summary Project read
     * @request GET:/api/v1/db/meta/projects/{projectId}
     * @response `200` `object` OK
     */
    read: (projectId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name Delete
     * @summary Project delete
     * @request DELETE:/api/v1/db/meta/projects/{projectId}
     * @response `200` `void` OK
     */
    delete: (projectId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name Update
     * @summary Project update
     * @request PATCH:/api/v1/db/meta/projects/{projectId}
     * @response `200` `void` OK
     */
    update: (projectId: string, data: any, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
 * @description Read project details
 * 
 * @tags Project
 * @name SharedBaseGet
 * @request GET:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  uuid?: string,
  url?: string,
  roles?: string,

}` OK
 */
    sharedBaseGet: (projectId: string, params: RequestParams = {}) =>
      this.request<
        {
          uuid?: string;
          url?: string;
          roles?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name SharedBaseDisable
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/shared
     * @response `200` `void` OK
     */
    sharedBaseDisable: (projectId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
        method: 'DELETE',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Project
 * @name SharedBaseCreate
 * @request POST:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  uuid?: string,
  url?: string,
  roles?: string,

}` OK
 */
    sharedBaseCreate: (
      projectId: string,
      data: {
        roles?: string;
        password?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          uuid?: string;
          url?: string;
          roles?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
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
 * @request PATCH:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  uuid?: string,
  url?: string,
  roles?: string,

}` OK
 */
    sharedBaseUpdate: (
      projectId: string,
      data: {
        roles?: string;
        password?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          uuid?: string;
          url?: string;
          roles?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Project compare cost
     *
     * @tags Project
     * @name Cost
     * @summary Project compare cost
     * @request GET:/api/v1/db/meta/projects/{projectId}/cost
     * @response `200` `object` OK
     */
    cost: (projectId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}/cost`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name MetaDiffSync
     * @request POST:/api/v1/db/meta/projects/{projectId}/meta-diff
     * @response `200` `any` OK
     */
    metaDiffSync: (projectId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Project
     * @name MetaDiffGet
     * @request GET:/api/v1/db/meta/projects/{projectId}/meta-diff
     * @response `200` `any` OK
     */
    metaDiffGet: (projectId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Project
 * @name AuditList
 * @request GET:/api/v1/db/meta/projects/{projectId}/audits
 * @response `200` `{
  list: (AuditType)[],
  pageInfo: PaginatedType,

}` OK
 */
    auditList: (
      projectId: string,
      query?: {
        offset?: string;
        limit?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          list: AuditType[];
          pageInfo: PaginatedType;
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/audits`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  base = {
    /**
     * @description Read project base details
     *
     * @tags Base
     * @name Read
     * @summary Base read
     * @request GET:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `object` OK
     */
    read: (projectId: string, baseId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name Delete
     * @summary Base delete
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `void` OK
     */
    delete: (projectId: string, baseId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name Update
     * @summary Base update
     * @request PATCH:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `void` OK
     */
    update: (
      projectId: string,
      baseId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get project base list
     *
     * @tags Base
     * @name List
     * @summary Base list
     * @request GET:/api/v1/db/meta/projects/{projectId}/bases/
     * @response `200` `object` OK
     */
    list: (projectId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name Create
     * @summary Base create
     * @request POST:/api/v1/db/meta/projects/{projectId}/bases/
     * @response `200` `BaseType` OK
     */
    create: (
      projectId: string,
      data: BaseType & {
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<BaseType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name TableList
     * @request GET:/api/v1/db/meta/projects/{projectId}/{baseId}/tables
     * @response `200` `TableListType`
     */
    tableList: (
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
        path: `/api/v1/db/meta/projects/${projectId}/${baseId}/tables`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name TableCreate
     * @request POST:/api/v1/db/meta/projects/{projectId}/{baseId}/tables
     * @response `200` `TableType` OK
     */
    tableCreate: (
      projectId: string,
      baseId: string,
      data: TableReqType,
      params: RequestParams = {}
    ) =>
      this.request<TableType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/${baseId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name TableMagic
     * @request POST:/api/v1/db/meta/projects/{projectId}/{baseId}/tables/magic
     * @response `200` `TableType` OK
     */
    tableMagic: (
      projectId: string,
      baseId: string,
      data: {
        table_name: string;
        title: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<TableType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/${baseId}/tables/magic`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name SchemaMagic
     * @request POST:/api/v1/db/meta/projects/{projectId}/{baseId}/schema/magic
     * @response `200` `TableType` OK
     */
    schemaMagic: (
      projectId: string,
      baseId: string,
      data: {
        schema_name: string;
        title: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<TableType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/${baseId}/schema/magic`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name MetaDiffSync
     * @request POST:/api/v1/db/meta/projects/{projectId}/meta-diff/{baseId}
     * @response `200` `any` OK
     */
    metaDiffSync: (
      projectId: string,
      baseId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff/${baseId}`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name MetaDiffGet
     * @request GET:/api/v1/db/meta/projects/{projectId}/meta-diff/{baseId}
     * @response `200` `any` OK
     */
    metaDiffGet: (
      projectId: string,
      baseId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTable = {
    /**
     * No description
     *
     * @tags DB table
     * @name Create
     * @request POST:/api/v1/db/meta/projects/{projectId}/tables
     * @response `200` `TableType` OK
     */
    create: (
      projectId: string,
      data: TableReqType,
      params: RequestParams = {}
    ) =>
      this.request<TableType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table
     * @name List
     * @request GET:/api/v1/db/meta/projects/{projectId}/tables
     * @response `200` `TableListType`
     */
    list: (
      projectId: string,
      query?: {
        page?: number;
        pageSize?: number;
        sort?: string;
        includeM2M?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<TableListType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/tables`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table
     * @name Read
     * @request GET:/api/v1/db/meta/tables/{tableId}
     * @response `200` `TableInfoType` OK
     */
    read: (tableId: string, params: RequestParams = {}) =>
      this.request<TableInfoType, any>({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table
     * @name Update
     * @request PATCH:/api/v1/db/meta/tables/{tableId}
     * @response `200` `any` OK
     */
    update: (
      tableId: string,
      data: {
        table_name?: string;
        title?: string;
        project_id?: string;
        meta?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table
     * @name Delete
     * @request DELETE:/api/v1/db/meta/tables/{tableId}
     * @response `200` `void` OK
     */
    delete: (tableId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table
     * @name Reorder
     * @request POST:/api/v1/db/meta/tables/{tableId}/reorder
     * @response `200` `void` OK
     */
    reorder: (
      tableId: string,
      data: {
        order?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/tables/${tableId}/reorder`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  dbTableColumn = {
    /**
     * No description
     *
     * @tags DB table column
     * @name Create
     * @summary Column create
     * @request POST:/api/v1/db/meta/tables/{tableId}/columns
     * @response `200` `void` OK
     */
    create: (
      tableId: string,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/tables/${tableId}/columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table column
     * @name Update
     * @summary Column Update
     * @request PATCH:/api/v1/db/meta/columns/{columnId}
     * @response `200` `ColumnType` OK
     */
    update: (
      columnId: string,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<ColumnType, any>({
        path: `/api/v1/db/meta/columns/${columnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table column
     * @name Delete
     * @request DELETE:/api/v1/db/meta/columns/{columnId}
     * @response `200` `void` OK
     */
    delete: (columnId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/columns/${columnId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table column
     * @name PrimaryColumnSet
     * @request POST:/api/v1/db/meta/columns/{columnId}/primary
     * @response `200` `void` OK
     */
    primaryColumnSet: (columnId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/columns/${columnId}/primary`,
        method: 'POST',
        ...params,
      }),
  };
  dbView = {
    /**
     * No description
     *
     * @tags DB view
     * @name List
     * @request GET:/api/v1/db/meta/tables/{tableId}/views
     * @response `200` `ViewListType`
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<ViewListType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/views`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name Update
     * @request PATCH:/api/v1/db/meta/views/{viewId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      data: {
        order?: number;
        meta?: any;
        title?: string;
        show_system_fields?: boolean;
        lock_type?: 'collaborative' | 'locked' | 'personal';
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name Delete
     * @request DELETE:/api/v1/db/meta/views/{viewId}
     * @response `200` `void` OK
     */
    delete: (viewId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name ShowAllColumn
     * @request POST:/api/v1/db/meta/views/{viewId}/show-all
     * @response `200` `void` OK
     */
    showAllColumn: (
      viewId: string,
      query?: {
        ignoreIds?: any[];
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/show-all`,
        method: 'POST',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name HideAllColumn
     * @request POST:/api/v1/db/meta/views/{viewId}/hide-all
     * @response `200` `void` OK
     */
    hideAllColumn: (
      viewId: string,
      query?: {
        ignoreIds?: any[];
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/hide-all`,
        method: 'POST',
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GridCreate
     * @request POST:/api/v1/db/meta/tables/{tableId}/grids
     * @response `200` `GridType` OK
     */
    gridCreate: (tableId: string, data: GridType, params: RequestParams = {}) =>
      this.request<GridType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/grids`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name FormCreate
     * @request POST:/api/v1/db/meta/tables/{tableId}/forms
     * @response `200` `FormType` OK
     */
    formCreate: (tableId: string, data: FormType, params: RequestParams = {}) =>
      this.request<FormType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/forms`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name FormUpdate
     * @request PATCH:/api/v1/db/meta/forms/{formId}
     * @response `200` `void` OK
     */
    formUpdate: (formId: string, data: FormType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/forms/${formId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name FormRead
     * @request GET:/api/v1/db/meta/forms/{formId}
     * @response `200` `FormType` OK
     */
    formRead: (formId: string, params: RequestParams = {}) =>
      this.request<FormType, any>({
        path: `/api/v1/db/meta/forms/${formId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name FormColumnUpdate
     * @request PATCH:/api/v1/db/meta/form-columns/{formViewColumnId}
     * @response `200` `any` OK
     */
    formColumnUpdate: (
      formViewColumnId: string,
      data: FormColumnType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/form-columns/${formViewColumnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GridColumnsList
     * @request GET:/api/v1/db/meta/grids/{gridId}/grid-columns
     * @response `200` `(GridColumnType)[]` OK
     */
    gridColumnsList: (gridId: string, params: RequestParams = {}) =>
      this.request<GridColumnType[], any>({
        path: `/api/v1/db/meta/grids/${gridId}/grid-columns`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GridColumnUpdate
     * @request PATCH:/api/v1/db/meta/grid-columns/{columnId}
     * @response `200` `any` OK
     */
    gridColumnUpdate: (
      columnId: string,
      data: GridColumnType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/grid-columns/${columnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GalleryCreate
     * @request POST:/api/v1/db/meta/tables/{tableId}/galleries
     * @response `200` `object` OK
     */
    galleryCreate: (
      tableId: string,
      data: GalleryType,
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/tables/${tableId}/galleries`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GalleryUpdate
     * @request PATCH:/api/v1/db/meta/galleries/{galleryId}
     * @response `200` `void` OK
     */
    galleryUpdate: (
      galleryId: string,
      data: GalleryType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/galleries/${galleryId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name GalleryRead
     * @request GET:/api/v1/db/meta/galleries/{galleryId}
     * @response `200` `GalleryType` OK
     */
    galleryRead: (galleryId: string, params: RequestParams = {}) =>
      this.request<GalleryType, any>({
        path: `/api/v1/db/meta/galleries/${galleryId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name KanbanCreate
     * @request POST:/api/v1/db/meta/tables/{tableId}/kanbans
     * @response `200` `object` OK
     */
    kanbanCreate: (
      tableId: string,
      data: KanbanType,
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/tables/${tableId}/kanbans`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name KanbanUpdate
     * @request PATCH:/api/v1/db/meta/kanbans/{kanbanId}
     * @response `200` `void` OK
     */
    kanbanUpdate: (
      kanbanId: string,
      data: KanbanType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/kanbans/${kanbanId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view
     * @name KanbanRead
     * @request GET:/api/v1/db/meta/kanbans/{kanbanId}
     * @response `200` `KanbanType` OK
     */
    kanbanRead: (kanbanId: string, params: RequestParams = {}) =>
      this.request<KanbanType, any>({
        path: `/api/v1/db/meta/kanbans/${kanbanId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbViewShare = {
    /**
     * No description
     *
     * @tags DB view share
     * @name List
     * @summary Shared view list
     * @request GET:/api/v1/db/meta/tables/{tableId}/share
     * @response `200` `(any)[]` OK
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<any[], any>({
        path: `/api/v1/db/meta/tables/${tableId}/share`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags DB view share
 * @name Create
 * @request POST:/api/v1/db/meta/views/{viewId}/share
 * @response `200` `{
  uuid?: string,

}` OK
 */
    create: (viewId: string, params: RequestParams = {}) =>
      this.request<
        {
          uuid?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/views/${viewId}/share`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view share
     * @name Update
     * @request PATCH:/api/v1/db/meta/views/{viewId}/share
     * @response `200` `SharedViewType` OK
     */
    update: (
      viewId: string,
      data: {
        password?: string;
        meta?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<SharedViewType, any>({
        path: `/api/v1/db/meta/views/${viewId}/share`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view share
     * @name Delete
     * @request DELETE:/api/v1/db/meta/views/{viewId}/share
     * @response `200` `void` OK
     */
    delete: (viewId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/share`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbViewColumn = {
    /**
     * No description
     *
     * @tags DB view column
     * @name List
     * @request GET:/api/v1/db/meta/views/{viewId}/columns
     */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/views/${viewId}/columns`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view column
     * @name Create
     * @request POST:/api/v1/db/meta/views/{viewId}/columns
     * @response `200` `void` OK
     */
    create: (viewId: string, data: any, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view column
     * @name Update
     * @request PATCH:/api/v1/db/meta/views/{viewId}/columns/{columnId}
     * @response `200` `void` OK
     */
    update: (
      viewId: string,
      columnId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/columns/${columnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  dbTableSort = {
    /**
 * No description
 * 
 * @tags DB table sort
 * @name List
 * @request GET:/api/v1/db/meta/views/{viewId}/sorts
 * @response `200` `{
  sorts?: {
  list?: (SortType)[],

},

}` OK
 */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<
        {
          sorts?: {
            list?: SortType[];
          };
        },
        any
      >({
        path: `/api/v1/db/meta/views/${viewId}/sorts`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table sort
     * @name Create
     * @request POST:/api/v1/db/meta/views/{viewId}/sorts
     * @response `200` `void` OK
     */
    create: (
      viewId: string,
      data: SortType & {
        push_to_top?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}/sorts`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table sort
     * @name Get
     * @request GET:/api/v1/db/meta/sorts/{sortId}
     * @response `200` `SortType` OK
     */
    get: (sortId: string, params: RequestParams = {}) =>
      this.request<SortType, any>({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table sort
     * @name Update
     * @request PATCH:/api/v1/db/meta/sorts/{sortId}
     * @response `200` `void` OK
     */
    update: (sortId: string, data: SortType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table sort
     * @name Delete
     * @request DELETE:/api/v1/db/meta/sorts/{sortId}
     * @response `200` `void` OK
     */
    delete: (sortId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbTableFilter = {
    /**
     * No description
     *
     * @tags DB table filter
     * @name Read
     * @request GET:/api/v1/db/meta/views/{viewId}/filters
     * @response `200` `(FilterType)[]` OK
     */
    read: (viewId: string, params: RequestParams = {}) =>
      this.request<FilterType[], any>({
        path: `/api/v1/db/meta/views/${viewId}/filters`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table filter
     * @name Create
     * @request POST:/api/v1/db/meta/views/{viewId}/filters
     * @response `200` `FilterType` OK
     */
    create: (viewId: string, data: FilterType, params: RequestParams = {}) =>
      this.request<FilterType, any>({
        path: `/api/v1/db/meta/views/${viewId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table filter
     * @name Get
     * @request GET:/api/v1/db/meta/filters/{filterId}
     * @response `200` `FilterType` OK
     */
    get: (filterId: string, params: RequestParams = {}) =>
      this.request<FilterType, any>({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table filter
     * @name Update
     * @request PATCH:/api/v1/db/meta/filters/{filterId}
     * @response `200` `void` OK
     */
    update: (filterId: string, data: FilterType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table filter
     * @name Delete
     * @request DELETE:/api/v1/db/meta/filters/{filterId}
     * @response `200` `void` OK
     */
    delete: (filterId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table filter
     * @name ChildrenRead
     * @request GET:/api/v1/db/meta/filters/{filterGroupId}/children
     * @response `200` `(FilterType)[]` OK
     */
    childrenRead: (filterGroupId: string, params: RequestParams = {}) =>
      this.request<FilterType[], any>({
        path: `/api/v1/db/meta/filters/${filterGroupId}/children`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTableWebhookFilter = {
    /**
     * No description
     *
     * @tags DB table webhook filter
     * @name Read
     * @request GET:/api/v1/db/meta/hooks/{hookId}/filters
     * @response `200` `FilterListType`
     */
    read: (hookId: string, params: RequestParams = {}) =>
      this.request<FilterListType, any>({
        path: `/api/v1/db/meta/hooks/${hookId}/filters`,
        method: 'GET',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table webhook filter
     * @name Create
     * @request POST:/api/v1/db/meta/hooks/{hookId}/filters
     * @response `200` `void` OK
     */
    create: (hookId: string, data: FilterType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/hooks/${hookId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  dbTableRow = {
    /**
     * No description
     *
     * @tags DB table row
     * @name List
     * @summary Table row list
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    list: (
      orgs: string,
      projectName: string,
      tableName: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        offset?: string;
        limit?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name Create
     * @summary Table row create
     * @request POST:/api/v1/db/data/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    create: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name FindOne
     * @summary Table row FindOne
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/find-one
     * @response `200` `any` OK
     */
    findOne: (
      orgs: string,
      projectName: string,
      tableName: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/find-one`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name GroupBy
     * @summary Table row Group by
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/groupby
     * @response `200` `any` OK
     */
    groupBy: (
      orgs: string,
      projectName: string,
      tableName: string,
      query?: {
        /** Column name of the column you want to group by, eg. `column_name=column1` */
        column_name?: string;
        sort?: any[];
        where?: string;
        limit?: number;
        offset?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/groupby`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name GroupedDataList
     * @summary Table Group by Column
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      orgs: string,
      projectName: string,
      tableName: string,
      columnId: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        /** Query params for nested data */
        nested?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/group/${columnId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name Read
     * @summary Table row read
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name Update
     * @summary Table row update
     * @request PATCH:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name Delete
     * @summary Table row delete
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `200` `any` OK
     */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
     * @description check row with provided primary key exists or not
     *
     * @tags DB table row
     * @name Exist
     * @summary Table row exist
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/exist
     * @response `201` `any` Created
     */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/exist`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name BulkCreate
     * @summary Bulk insert table rows
     * @request POST:/api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    bulkCreate: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/bulk/${orgs}/${projectName}/${tableName}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name BulkUpdate
     * @summary Bulk update all table rows by IDs
     * @request PATCH:/api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    bulkUpdate: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/bulk/${orgs}/${projectName}/${tableName}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name BulkDelete
     * @summary Bulk delete all table rows by IDs
     * @request DELETE:/api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    bulkDelete: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/bulk/${orgs}/${projectName}/${tableName}`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name BulkUpdateAll
     * @summary Bulk update all table rows with conditions
     * @request PATCH:/api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all
     * @response `200` `any` OK
     */
    bulkUpdateAll: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      query?: {
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/bulk/${orgs}/${projectName}/${tableName}/all`,
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
     * @tags DB table row
     * @name BulkDeleteAll
     * @summary Bulk delete all table rows with conditions
     * @request DELETE:/api/v1/db/data/bulk/{orgs}/{projectName}/{tableName}/all
     * @response `200` `any` OK
     */
    bulkDeleteAll: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: any,
      query?: {
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/bulk/${orgs}/${projectName}/${tableName}/all`,
        method: 'DELETE',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description CSV or Excel export
     *
     * @tags DB table row
     * @name CsvExport
     * @summary Tablerows export
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/export/{type}
     * @response `200` `any` OK
     */
    csvExport: (
      orgs: string,
      projectName: string,
      tableName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/export/${type}`,
        method: 'GET',
        wrapped: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name NestedList
     * @summary Nested relations row list
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}
     * @response `200` `any` OK
     */
    nestedList: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        limit?: string | number;
        offset?: string | number;
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/${relationType}/${columnName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name NestedAdd
     * @summary Nested relations row add
     * @request POST:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
     * @response `200` `any` OK
     */
    nestedAdd: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      refRowId: string,
      query?: {
        limit?: string;
        offset?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/${relationType}/${columnName}/${refRowId}`,
        method: 'POST',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name NestedRemove
     * @summary Nested relations row remove
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
     * @response `200` `any` OK
     */
    nestedRemove: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      refRowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/${relationType}/${columnName}/${refRowId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table row
     * @name NestedChildrenExcludedList
     * @summary Referenced tables rows excluding current records children/parent
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude
     * @response `200` `any` OK
     */
    nestedChildrenExcludedList: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: string,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        limit?: string | number;
        offset?: string | number;
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/${relationType}/${columnName}/exclude`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  dbViewRow = {
    /**
     * No description
     *
     * @tags DB view row
     * @name GroupedDataList
     * @summary Table Group by Column
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      columnId: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        /** Query params for nested data */
        nested?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/group/${columnId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name List
     * @summary Table view row list
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}
     * @response `200` `any` OK
     */
    list: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        /** Query params for nested data */
        nested?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name Create
     * @summary Table view row create
     * @request POST:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}
     * @response `200` `any` OK
     */
    create: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name FindOne
     * @summary Table view row FindOne
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/find-one
     * @response `200` `any` OK
     */
    findOne: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        /** Query params for nested data */
        nested?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/find-one`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name GroupBy
     * @summary Table view row Group by
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/groupby
     * @response `200` `any` OK
     */
    groupBy: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      query?: {
        /** Column name of the column you want to group by, eg. `column_name=column1` */
        column_name?: string;
        sort?: any[];
        where?: string;
        limit?: number;
        offset?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/groupby`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name Count
     * @summary Table view rows count
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/count
     * @response `200` `any` OK
     */
    count: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      query?: {
        where?: string;
        /** Query params for nested data */
        nested?: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name Read
     * @summary Table view row read
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name Update
     * @summary Table view row update
     * @request PATCH:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: string,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB view row
     * @name Delete
     * @summary Table view row delete
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `200` `void` OK
     */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description check row with provided primary key exists or not
     *
     * @tags DB view row
     * @name Exist
     * @summary Table view row exist
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}/exist
     * @response `201` `any` Created
     */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}/exist`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description CSV or Excel export
     *
     * @tags DB view row
     * @name Export
     * @summary Table view rows export
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/export/{type}
     * @response `200` `any` OK
     */
    export: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/export/${type}`,
        method: 'GET',
        wrapped: true,
        ...params,
      }),
  };
  public = {
    /**
     * No description
     *
     * @tags Public
     * @name GroupedDataList
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      sharedViewUuid: string,
      columnId: string,
      query?: {
        limit?: string;
        offset?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/group/${columnId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataList
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/rows
     * @response `200` `any` OK
     */
    dataList: (
      sharedViewUuid: string,
      query?: {
        limit?: string;
        offset?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows`,
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
     * @request POST:/api/v1/db/public/shared-view/{sharedViewUuid}/rows
     * @response `200` `any` OK
     */
    dataCreate: (
      sharedViewUuid: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows`,
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
     * @name DataNestedList
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName}
     * @response `200` `any` OK
     */
    dataNestedList: (
      sharedViewUuid: string,
      rowId: string,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        limit?: string;
        offset?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows/${rowId}/${relationType}/${columnName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name CsvExport
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/rows/export/{type}
     * @response `200` `any` OK
     */
    csvExport: (
      sharedViewUuid: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows/export/${type}`,
        method: 'GET',
        wrapped: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Public
     * @name DataRelationList
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName}
     * @response `200` `any` OK
     */
    dataRelationList: (
      sharedViewUuid: string,
      columnName: string,
      query?: {
        limit?: string;
        offset?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/nested/${columnName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Read project details
 * 
 * @tags Public
 * @name SharedBaseGet
 * @request GET:/api/v1/db/public/shared-base/{sharedBaseUuid}/meta
 * @response `200` `{
  project_id?: string,

}` OK
 */
    sharedBaseGet: (sharedBaseUuid: string, params: RequestParams = {}) =>
      this.request<
        {
          project_id?: string;
        },
        any
      >({
        path: `/api/v1/db/public/shared-base/${sharedBaseUuid}/meta`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Public
 * @name SharedViewMetaGet
 * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/meta
 * @response `200` `(ViewType & {
  relatedMetas?: any,
  client?: string,
  columns?: ((GridColumnType | FormColumnType | GalleryColumnType) & ColumnType),
  model?: TableType,

} & {
  view?: (FormType | GridType | GalleryType),

})` OK
 */
    sharedViewMetaGet: (sharedViewUuid: string, params: RequestParams = {}) =>
      this.request<
        ViewType & {
          relatedMetas?: any;
          client?: string;
          columns?: (GridColumnType | FormColumnType | GalleryColumnType) &
            ColumnType;
          model?: TableType;
        } & {
          view?: FormType | GridType | GalleryType;
        },
        any
      >({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/meta`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  utils = {
    /**
     * No description
     *
     * @tags Utils
     * @name CommentList
     * @request GET:/api/v1/db/meta/audits/comments
     * @response `201` `any` Created
     */
    commentList: (
      query: {
        row_id: string;
        fk_model_id: string;
        comments_only?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/audits/comments`,
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
     * @request POST:/api/v1/db/meta/audits/comments
     * @response `200` `void` OK
     */
    commentRow: (
      data: {
        row_id: string;
        fk_model_id: string;
        description?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/audits/comments`,
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
     * @request GET:/api/v1/db/meta/audits/comments/count
     * @response `201` `any` Created
     */
    commentCount: (
      query: {
        ids: any;
        fk_model_id: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/audits/comments/count`,
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
     * @request POST:/api/v1/db/meta/audits/rows/{rowId}/update
     * @response `200` `void` OK
     */
    auditRowUpdate: (
      rowId: string,
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
        path: `/api/v1/db/meta/audits/rows/${rowId}/update`,
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
 * @request POST:/api/v1/db/meta/connection/test
 * @response `200` `{
  code?: number,
  message?: string,

}` OK
 */
    testConnection: (data: any, params: RequestParams = {}) =>
      this.request<
        {
          code?: number;
          message?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/connection/test`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get select options using NocoAI
     *
     * @tags Utils
     * @name SelectMagic
     * @summary Get select options using NocoAI
     * @request POST:/api/v1/db/meta/select/magic
     * @response `200` `(string)[]` OK
     */
    selectMagic: (
      data: {
        title: string;
        table: string;
        schema?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<string[], any>({
        path: `/api/v1/db/meta/select/magic`,
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
     * @name UrlToConfig
     * @request POST:/api/v1/url_to_config
     */
    urlToConfig: (data: any, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/url_to_config`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name AppInfo
     * @request GET:/api/v1/db/meta/nocodb/info
     * @response `200` `any` OK
     */
    appInfo: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/nocodb/info`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Generic Axios Call
     *
     * @tags Utils
     * @name AxiosRequestMake
     * @request POST:/api/v1/db/meta/axiosRequestMake
     * @response `200` `object` OK
     */
    axiosRequestMake: (data: object, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/axiosRequestMake`,
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
     * @name AppVersion
     * @request GET:/api/v1/version
     * @response `200` `any` OK
     */
    appVersion: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/version`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Utils
     * @name AppHealth
     * @request GET:/api/v1/health
     * @response `200` `any` OK
     */
    appHealth: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/health`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags Utils
 * @name AggregatedMetaInfo
 * @request GET:/api/v1/aggregated-meta-info
 * @response `200` `{
  projectCount?: number,
  projects?: ({
  tableCount?: {
  table?: number,
  view?: number,

},
  external?: boolean,
  viewCount?: {
  formCount?: number,
  gridCount?: number,
  galleryCount?: number,
  kanbanCount?: number,
  total?: number,
  sharedFormCount?: number,
  sharedGridCount?: number,
  sharedGalleryCount?: number,
  sharedKanbanCount?: number,
  sharedTotal?: number,
  sharedLockedCount?: number,

},
  webhookCount?: number,
  filterCount?: number,
  sortCount?: number,
  rowCount?: ({
  TotalRecords?: string,

})[],
  userCount?: number,

})[],
  userCount?: number,
  sharedBaseCount?: number,

}` OK
 */
    aggregatedMetaInfo: (params: RequestParams = {}) =>
      this.request<
        {
          projectCount?: number;
          projects?: {
            tableCount?: {
              table?: number;
              view?: number;
            };
            external?: boolean;
            viewCount?: {
              formCount?: number;
              gridCount?: number;
              galleryCount?: number;
              kanbanCount?: number;
              total?: number;
              sharedFormCount?: number;
              sharedGridCount?: number;
              sharedGalleryCount?: number;
              sharedKanbanCount?: number;
              sharedTotal?: number;
              sharedLockedCount?: number;
            };
            webhookCount?: number;
            filterCount?: number;
            sortCount?: number;
            rowCount?: {
              TotalRecords?: string;
            }[];
            userCount?: number;
          }[];
          userCount?: number;
          sharedBaseCount?: number;
        },
        any
      >({
        path: `/api/v1/aggregated-meta-info`,
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
     * @request GET:/api/v1/db/meta/cache
     */
    cacheGet: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/cache`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Delete All K/V pairs in NocoCache
     *
     * @tags Utils
     * @name CacheDelete
     * @request DELETE:/api/v1/db/meta/cache
     * @response `200` `void` OK
     */
    cacheDelete: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/cache`,
        method: 'DELETE',
        ...params,
      }),
  };
  dbTableWebhook = {
    /**
 * No description
 * 
 * @tags DB table webhook
 * @name List
 * @request GET:/api/v1/db/meta/tables/{tableId}/hooks
 * @response `200` `{
  list: (HookType)[],
  pageInfo: PaginatedType,

}` OK
 */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<
        {
          list: HookType[];
          pageInfo: PaginatedType;
        },
        any
      >({
        path: `/api/v1/db/meta/tables/${tableId}/hooks`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table webhook
     * @name Create
     * @request POST:/api/v1/db/meta/tables/{tableId}/hooks
     * @response `200` `AuditType` OK
     */
    create: (tableId: string, data: AuditType, params: RequestParams = {}) =>
      this.request<AuditType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/hooks`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table webhook
     * @name Test
     * @request POST:/api/v1/db/meta/tables/{tableId}/hooks/test
     * @response `200` `any` OK
     */
    test: (
      tableId: string,
      data: {
        payload?: {
          data?: any;
          user?: any;
        };
        hook?: HookType;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/tables/${tableId}/hooks/test`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * No description
 * 
 * @tags DB table webhook
 * @name SamplePayloadGet
 * @request GET:/api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{operation}
 * @response `200` `{
  plugins?: {
  list: (PluginType)[],
  pageInfo: PaginatedType,

},

}` OK
 */
    samplePayloadGet: (
      tableId: string,
      operation: 'update' | 'delete' | 'insert',
      params: RequestParams = {}
    ) =>
      this.request<
        {
          plugins?: {
            list: PluginType[];
            pageInfo: PaginatedType;
          };
        },
        any
      >({
        path: `/api/v1/db/meta/tables/${tableId}/hooks/samplePayload/${operation}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table webhook
     * @name Update
     * @request PATCH:/api/v1/db/meta/hooks/{hookId}
     * @response `200` `HookType` OK
     */
    update: (hookId: string, data: HookType, params: RequestParams = {}) =>
      this.request<HookType, any>({
        path: `/api/v1/db/meta/hooks/${hookId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags DB table webhook
     * @name Delete
     * @request DELETE:/api/v1/db/meta/hooks/{hookId}
     * @response `200` `void` OK
     */
    delete: (hookId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/hooks/${hookId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  cowriterTable = {
    /**
     * No description
     *
     * @tags Cowriter Table
     * @name Create
     * @summary Cowriter Create
     * @request POST:/api/v1/cowriter/meta/tables/{tableId}
     * @response `200` `CowriterType` OK
     */
    create: (tableId: string, data: object, params: RequestParams = {}) =>
      this.request<CowriterType, any>({
        path: `/api/v1/cowriter/meta/tables/${tableId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cowriter Table
     * @name List
     * @summary Cowriter List
     * @request GET:/api/v1/cowriter/meta/tables/{tableId}
     * @response `200` `CowriterListType` OK
     */
    list: (tableId: string, params: RequestParams = {}) =>
      this.request<CowriterListType, any>({
        path: `/api/v1/cowriter/meta/tables/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cowriter Table
     * @name Get
     * @summary Cowriter Get
     * @request GET:/api/v1/cowriter/meta/tables/{tableId}/{cowriterId}
     * @response `200` `CowriterListType` OK
     * @response `0` `CowriterType`
     */
    get: (tableId: string, cowriterId: string, params: RequestParams = {}) =>
      this.request<CowriterListType, CowriterType>({
        path: `/api/v1/cowriter/meta/tables/${tableId}/${cowriterId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cowriter Table
     * @name Patch
     * @summary Cowriter Patch
     * @request PATCH:/api/v1/cowriter/meta/tables/{tableId}/{cowriterId}
     * @response `200` `void` OK
     */
    patch: (
      tableId: string,
      cowriterId: string,
      data: CowriterType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/cowriter/meta/tables/${tableId}/${cowriterId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Generate Columns using AI
     *
     * @tags Cowriter Table
     * @name GenerateColumns
     * @summary Cowriter Generate Columns
     * @request POST:/api/v1/cowriter/meta/tables/{tableId}/generate-columns
     * @response `200` `void` OK
     */
    generateColumns: (
      tableId: string,
      data: {
        title?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/cowriter/meta/tables/${tableId}/generate-columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Cowriter Table
     * @name CreateBulk
     * @summary Cowriter Create Bulk
     * @request POST:/api/v1/cowriter/meta/tables/{tableId}/bulk
     * @response `200` `void` OK
     */
    createBulk: (
      tableId: string,
      data: CowriterType[],
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/cowriter/meta/tables/${tableId}/bulk`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  plugin = {
    /**
 * No description
 * 
 * @tags Plugin
 * @name List
 * @request GET:/api/v1/db/meta/plugins
 * @response `200` `{
  list?: (PluginType)[],
  pageInfo?: PaginatedType,

}` OK
 */
    list: (params: RequestParams = {}) =>
      this.request<
        {
          list?: PluginType[];
          pageInfo?: PaginatedType;
        },
        any
      >({
        path: `/api/v1/db/meta/plugins`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Check plugin is active or not
     *
     * @tags Plugin
     * @name Status
     * @request GET:/api/v1/db/meta/plugins/{pluginTitle}/status
     * @response `200` `boolean` OK
     */
    status: (pluginTitle: string, params: RequestParams = {}) =>
      this.request<boolean, any>({
        path: `/api/v1/db/meta/plugins/${pluginTitle}/status`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Plugin
     * @name Test
     * @request POST:/api/v1/db/meta/plugins/test
     * @response `200` `any` OK
     * @response `400` `void` Bad Request
     * @response `401` `void` Unauthorized
     */
    test: (
      data: {
        id?: string;
        title?: string;
        input?: any;
        category?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, void>({
        path: `/api/v1/db/meta/plugins/test`,
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
     * @request PATCH:/api/v1/db/meta/plugins/{pluginId}
     * @response `200` `PluginType` OK
     */
    update: (pluginId: string, data: PluginType, params: RequestParams = {}) =>
      this.request<PluginType, any>({
        path: `/api/v1/db/meta/plugins/${pluginId}`,
        method: 'PATCH',
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
     * @request GET:/api/v1/db/meta/plugins/{pluginId}
     * @response `200` `PluginType` OK
     */
    read: (pluginId: string, params: RequestParams = {}) =>
      this.request<PluginType, any>({
        path: `/api/v1/db/meta/plugins/${pluginId}`,
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
     * @request GET:/api/v1/db/meta/projects/{projectId}/api-tokens
     * @response `200` `(ApiTokenType)[]` OK
     */
    list: (projectId: string, params: RequestParams = {}) =>
      this.request<ApiTokenType[], any>({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Api token
     * @name Create
     * @request POST:/api/v1/db/meta/projects/{projectId}/api-tokens
     * @response `200` `void` OK
     * @response `201` `ApiTokenType` Created
     */
    create: (
      projectId: string,
      data: {
        description?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens`,
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
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/api-tokens/{token}
     * @response `200` `void` OK
     */
    delete: (projectId: string, token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens/${token}`,
        method: 'DELETE',
        ...params,
      }),
  };
  storage = {
    /**
     * No description
     *
     * @tags Storage
     * @name Upload
     * @summary Attachment
     * @request POST:/api/v1/db/storage/upload
     */
    upload: (
      query: {
        path: string;
      },
      data: {
        files?: any;
        json?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/storage/upload`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Storage
     * @name UploadByUrl
     * @summary Attachment
     * @request POST:/api/v1/db/storage/upload-by-url
     */
    uploadByUrl: (
      query: {
        path: string;
      },
      data: {
        url?: string;
        fileName?: string;
        mimetype?: string;
        size?: string;
      }[],
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/storage/upload-by-url`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  workspace = {
    /**
     * @description List workspaces
     *
     * @tags Workspace
     * @name List
     * @summary List workspaces
     * @request GET:/api/v1/workspaces
     * @response `200` `WorkspaceListType` OK
     */
    list: (params: RequestParams = {}) =>
      this.request<WorkspaceListType, any>({
        path: `/api/v1/workspaces`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description List workspaces
     *
     * @tags Workspace
     * @name Create
     * @summary List workspaces
     * @request POST:/api/v1/workspaces
     * @response `200` `WorkspaceType` OK
     */
    create: (data: WorkspaceType, params: RequestParams = {}) =>
      this.request<WorkspaceType, any>({
        path: `/api/v1/workspaces`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Read workspace
     *
     * @tags Workspace
     * @name Read
     * @summary Read workspace
     * @request GET:/api/v1/workspaces/{workspaceId}
     * @response `200` `WorkspaceType` OK
     */
    read: (workspaceId: string, params: RequestParams = {}) =>
      this.request<WorkspaceType, any>({
        path: `/api/v1/workspaces/${workspaceId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update workspace
     *
     * @tags Workspace
     * @name Update
     * @summary Update workspace
     * @request PATCH:/api/v1/workspaces/{workspaceId}
     * @response `200` `void` OK
     */
    update: (
      workspaceId: string,
      data: WorkspaceType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/workspaces/${workspaceId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete workspace
     *
     * @tags Workspace
     * @name Delete
     * @summary Delete workspace
     * @request DELETE:/api/v1/workspaces/{workspaceId}
     * @response `200` `void` OK
     */
    delete: (workspaceId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/workspaces/${workspaceId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  workspaceUser = {
    /**
     * @description Workspace users list
     *
     * @tags Workspace user
     * @name List
     * @summary Workspace users list
     * @request GET:/api/v1/workspaces/{workspaceId}/users
     * @response `200` `WorkspaceUserListType` OK
     */
    list: (workspaceId: string, params: RequestParams = {}) =>
      this.request<WorkspaceUserListType, any>({
        path: `/api/v1/workspaces/${workspaceId}/users`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Workspace user invite
     *
     * @tags Workspace user
     * @name Invite
     * @summary Workspace user invite
     * @request POST:/api/v1/workspaces/{workspaceId}/invitations
     * @response `200` `any` OK
     */
    invite: (
      workspaceId: string,
      data: WorkspaceUserInviteType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/workspaces/${workspaceId}/invitations`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Workspace user read
     *
     * @tags Workspace user
     * @name Read
     * @summary Workspace user read
     * @request GET:/api/v1/workspaces/{workspaceId}/users/{userId}
     * @response `200` `WorkspaceUserType` OK
     */
    read: (workspaceId: string, userId: string, params: RequestParams = {}) =>
      this.request<WorkspaceUserType, any>({
        path: `/api/v1/workspaces/${workspaceId}/users/${userId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update workspace user
     *
     * @tags Workspace user
     * @name Update
     * @summary Update workspace user
     * @request PATCH:/api/v1/workspaces/{workspaceId}/users/{userId}
     * @response `200` `void` OK
     */
    update: (
      workspaceId: string,
      userId: string,
      data: {
        roles?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/workspaces/${workspaceId}/users/${userId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete workspace user
     *
     * @tags Workspace User
     * @name Delete
     * @summary Delete workspace user
     * @request DELETE:/api/v1/workspaces/{workspaceId}/users/{userId}
     * @response `200` `void` OK
     */
    delete: (workspaceId: string, userId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/workspaces/${workspaceId}/users/${userId}`,
        method: 'DELETE',
        ...params,
      }),
  };
  workspaceProject = {
    /**
     * @description Workspace projects list
     *
     * @tags Workspace project
     * @name List
     * @summary Workspace projects list
     * @request GET:/api/v1/workspaces/{workspaceId}/projects
     * @response `200` `ProjectListType` OK
     */
    list: (workspaceId: string, params: RequestParams = {}) =>
      this.request<ProjectListType, any>({
        path: `/api/v1/workspaces/${workspaceId}/projects`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
}
