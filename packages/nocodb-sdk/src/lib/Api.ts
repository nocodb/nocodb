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

/**
 * Model for User
 */
export interface UserType {
  /**
   * Unique identifier for the given user.
   * @example us_8kugj628ebjngs
   */
  id: string;
  /**
   * The first name of the user
   * @example Alice
   */
  firstname: string;
  /**
   * The last name of the user
   * @example Smith
   */
  lastname: string;
  /**
   * The email of the user
   * @format email
   * @example alice.smith@nocodb.com
   */
  email: string;
  /**
   * The roles of the user
   * @example org-level-viewer
   */
  roles?: string;
  /** Set to true if the user's email has been verified. */
  email_verified: boolean;
  /**
   * The date that the user was created.
   * @format date-time
   * @example 2023-03-01 11:36:49
   */
  created_at?: string;
  /**
   * The date that the user was created.
   * @format date-time
   * @example 2023-03-01 11:36:49
   */
  updated_at?: string;
}

/**
 * Model for User List
 */
export interface UserListType {
  /** users includes `list` and `pageInfo` */
  users: {
    /** List of User objects */
    list: UserType;
    /** Pagination info */
    pageInfo: PaginatedType;
  };
}

/**
 * Model for Project Request
 */
export interface ProjectReqType {
  /**
   * Project Title
   * @example My Project
   */
  title: string;
  /**
   * Project Description
   * @example This is my project description
   */
  description?: string;
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Array of Bases */
  bases?: BaseReqType[];
}

/**
 * Model for Project
 */
export interface ProjectType {
  /**
   * Unique Project ID
   * @example p_124hhlkbeasewh
   */
  id?: string;
  /**
   * Project Title
   * @example my-project
   */
  title?: string;
  status?: string;
  /**
   * Project Description
   * @example This is my project description
   */
  description?: string;
  /** Meta Info such as theme colors */
  meta?: MetaType;
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Is the project deleted */
  deleted?: BoolType;
  /** The order in project list */
  order?: number;
  /** List of base models */
  bases?: BaseType[];
  /** Model for Bool */
  is_meta?: BoolType;
  /**
   * Project prefix. Used in XCDB only.
   * @example nc_vm5q__
   */
  prefix?: string;
  /**
   * The created time of the record
   * @format date-time
   * @example 2023-03-01 14:27:36
   */
  created_at?: string;
  /**
   * The updated time of the record
   * @format date-time
   * @example 2023-03-01 14:27:36
   */
  updated_at?: string;
}

/**
 * Model for Project List
 */
export interface ProjectListType {
  /** List of Project Models */
  list?: ProjectType[];
  /** Pagination Info */
  pageInfo?: PaginatedType;
}

/**
 * Model for Base
 */
export interface BaseType {
  /** Unique Base ID */
  id?: string;
  /** The project ID that this base belongs to */
  project_id?: string;
  /**
   * Base Name - Default BASE will be null by default
   * @example My Base
   */
  alias?: string;
  /**
   * DB Type
   * @example mysql2
   */
  type?:
    | 'mysql2'
    | 'sqlite'
    | 'mysql'
    | 'mssql'
    | 'snowflake'
    | 'oracledb'
    | 'pg';
  /** Is the data source connected externally */
  is_meta?: BoolType;
  /** Base Configuration */
  config?: any;
  /**
   * The datatime this base is created at
   * @format date-time
   * @example 2023-03-01 14:27:36
   */
  created_at?: string;
  /**
   * The datatime this base is updated at
   * @format date-time
   * @example 2023-03-01 14:27:36
   */
  updated_at?: string;
  /**
   * Inflection for columns
   * @example camelize
   */
  inflection_column?: string;
  /**
   * Inflection for tables
   * @example camelize
   */
  inflection_table?: string;
  /**
   * The order of the list of bases
   * @example 1
   */
  order?: number;
  /** Is this base enabled */
  enabled?: BoolType;
}

/**
 * Model for Base Request
 */
export interface BaseReqType {
  /**
   * Base Name - Default BASE will be null by default
   * @example My Base
   */
  alias?: string;
  /** DB Type */
  type?:
    | 'mysql'
    | 'mysql2'
    | 'pg'
    | 'sqlite3'
    | 'mssql'
    | 'oracledb'
    | 'snowflake';
  /** Is the data source connected externally */
  is_meta?: boolean;
  /** Base Configuration */
  config?: any;
  /**
   * Inflection for columns
   * @example camelize
   */
  inflection_column?: string;
  /**
   * Inflection for tables
   * @example camelize
   */
  inflection_table?: string;
}

/**
 * Model for Base List
 */
export interface BaseListType {
  bases: {
    list: BaseType[];
    /** Model for Paginated */
    pageInfo: PaginatedType;
  };
}

/**
 * Model for Table
 */
export interface TableType {
  id?: string;
  project_id?: string;
  base_id?: string;
  table_name: string;
  title: string;
  type?: string;
  /** Model for Bool */
  enabled?: BoolType;
  parent_id?: string;
  show_as?: string;
  tags?: string;
  /** Model for Bool */
  pinned?: BoolType;
  /** Model for Bool */
  deleted?: BoolType;
  order?: number;
  columns?: ColumnType[];
  columnsById?: object;
  slug?: string;
  /** Model for Bool */
  mm?: BoolType;
  /** Model for Meta */
  meta?: MetaType;
}

/**
 * Model for View
 */
export interface ViewType {
  id?: string;
  title: string;
  /** Model for Bool */
  deleted?: BoolType;
  order?: number;
  /** Model for ID */
  fk_model_id?: IdType;
  slug?: string;
  uuid?: string;
  /** Model for Meta */
  meta?: MetaType;
  /** Model for Bool */
  show_system_fields?: BoolType;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  type?: number;
  view?:
    | FormType
    | GridType
    | GalleryType
    | KanbanType
    | MapType
    | (FormType & GridType & GalleryType & KanbanType & MapType);
}

/**
 * Model for Table Info
 */
export interface TableInfoType {
  id?: string;
  /** Model for ID */
  fk_project_id?: IdType;
  /** Model for ID */
  fk_base_id?: IdType;
  title: string;
  table_name: string;
  type?: string;
  enabled?: string;
  parent_id?: string;
  show_as?: string;
  tags?: string;
  /** Model for Bool */
  pinned?: BoolType;
  /** Model for Bool */
  deleted?: BoolType;
  order?: number;
  column?: ColumnType[];
  filters?: FilterType[];
  sort?: SortType[];
}

/**
 * Model for Table Request
 */
export interface TableReqType {
  /**
   * Table name
   * @example my_table
   */
  table_name: string;
  /**
   * Table title
   * @example My Table
   */
  title: string;
  /**
   * The order of table list
   * @example 1
   */
  order?: number;
  /** The column models in this table */
  columns: NormalColumnRequestType[];
  /** the meta data for this table */
  meta?: MetaType;
}

/**
 * Model for Table List
 */
export interface TableListType {
  list?: TableType[];
  /** Model for Paginated */
  pageInfo?: PaginatedType;
}

/**
 * Model for Filter
 */
export interface FilterType {
  id?: string;
  /** Model for ID */
  fk_model_id?: IdType;
  /** Model for ID */
  fk_column_id?: IdType;
  logical_op?: string;
  comparison_op?: string;
  /** Model for StringOrNull */
  comparison_sub_op?: StringOrNullType;
  value?: any;
  is_group?: boolean | number | null;
  children?: FilterType[];
  project_id?: string;
  base_id?: string;
  /** Model for ID */
  fk_parent_id?: IdType;
  /** Model for StringOrNull */
  fk_view_id?: StringOrNullType;
  /** Model for StringOrNull */
  fk_hook_id?: StringOrNullType;
}

/**
 * Model for Filter Request
 */
export interface FilterReqType {
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Logical Operator */
  logical_op?: 'and' | 'or' | 'not';
  /** Comparison Operator */
  comparison_op?:
    | 'eq'
    | 'neq'
    | 'not'
    | 'like'
    | 'nlike'
    | 'empty'
    | 'notempty'
    | 'null'
    | 'notnull'
    | 'checked'
    | 'notchecked'
    | 'blank'
    | 'notblank'
    | 'allof'
    | 'anyof'
    | 'nallof'
    | 'nanyof'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'ge'
    | 'le'
    | 'in'
    | 'isnot'
    | 'is'
    | 'isWithin'
    | 'btw'
    | 'nbtw';
  /** Comparison Sub-Operator */
  comparison_sub_op?:
    | 'pastWeek'
    | 'pastMonth'
    | 'pastYear'
    | 'nextWeek'
    | 'nextYear'
    | 'pastNumberOfDays'
    | 'nextNumberOfDays'
    | 'today'
    | 'tomorrow'
    | 'yesterday'
    | 'oneWeekAgo'
    | 'oneWeekFromNow'
    | 'oneMonthAgo'
    | 'oneMonthFromNow'
    | 'daysAgo'
    | 'daysFromNow'
    | 'exactDate'
    | null
    | (
        | 'pastWeek'
        | 'pastMonth'
        | 'pastYear'
        | 'nextWeek'
        | 'nextYear'
        | 'pastNumberOfDays'
        | 'nextNumberOfDays'
        | 'today'
        | 'tomorrow'
        | 'yesterday'
        | 'oneWeekAgo'
        | 'oneWeekFromNow'
        | 'oneMonthAgo'
        | 'oneMonthFromNow'
        | 'daysAgo'
        | 'daysFromNow'
        | ('exactDate' & null)
      );
  /** The filter value. Can be NULL for some operators. */
  value?: any;
  /** Is this filter grouped? */
  is_group?: BoolType;
  /** Belong to which filter ID */
  fk_parent_id?: IdType;
}

/**
 * Model for Filter List
 */
export interface FilterListType {
  filters: {
    list: FilterType[];
  };
}

/**
 * Model for Sort
 */
export interface SortType {
  id?: string;
  /** Model for ID */
  fk_model_id?: IdType;
  /** Model for ID */
  fk_column_id?: IdType;
  direction?: string;
  order?: number;
  project_id?: string;
  base_id?: string;
}

/**
 * Model for Sort Request
 */
export interface SortReqType {
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Sort direction */
  direction?: 'asc' | 'desc';
}

/**
 * Model for Sort List
 */
export interface SortListType {
  sorts: {
    list: SharedViewType[];
  };
}

/**
 * Model for Column
 */
export interface ColumnType {
  id?: string;
  base_id?: string;
  fk_model_id?: string;
  title?: string;
  uidt?: string;
  dt?: string;
  np?: string | number | null;
  ns?: string | number | null;
  clen?: string | number | null;
  cop?: string;
  /** Model for Bool */
  pk?: BoolType;
  /** Model for Bool */
  pv?: BoolType;
  /** Model for Bool */
  rqd?: BoolType;
  column_name?: string;
  /** Model for Bool */
  un?: BoolType;
  ct?: string;
  /** Model for Bool */
  ai?: BoolType;
  /** Model for Bool */
  unique?: BoolType;
  cdf?: string;
  cc?: string;
  csn?: string;
  dtx?: string;
  dtxp?: string | number | null;
  dtxs?: string | number | null;
  /** Model for Bool */
  au?: BoolType;
  /** Model for Bool */
  deleted?: BoolType;
  /** Model for Bool */
  visible?: BoolType;
  order?: number;
  /** Model for Bool */
  system?: BoolType;
  /** Model for Meta */
  meta?: MetaType;
  colOptions?:
    | LinkToAnotherRecordType
    | FormulaType
    | RollupType
    | LookupType
    | SelectOptionsType
    | object
    | (LinkToAnotherRecordType &
        FormulaType &
        RollupType &
        LookupType &
        SelectOptionsType &
        object);
}

/**
 * Model for Column List
 */
export interface ColumnListType {
  columns: {
    list: ColumnType[];
  };
}

/**
 * Model for LinkToAnotherRecord
 */
export interface LinkToAnotherRecordType {
  id?: string;
  type?: string;
  /** Model for Bool */
  virtual?: BoolType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
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

/**
 * Model for Lookup
 */
export interface LookupType {
  id?: string;
  type?: string;
  /** Model for Bool */
  virtual?: BoolType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  fk_relation_column_id?: string;
  fk_lookup_column_id?: string;
  deleted?: string;
  order?: string;
}

/**
 * Model for Rollup
 */
export interface RollupType {
  id?: string;
  type?: string;
  /** Model for Bool */
  virtual?: BoolType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  fk_relation_column_id?: string;
  fk_rollup_column_id?: string;
  rollup_function?: string;
  deleted?: string;
  order?: string;
}

/**
 * Model for Formula
 */
export interface FormulaType {
  id?: string;
  type?: string;
  /** Model for Bool */
  virtual?: BoolType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  formula?: string;
  formula_raw?: string;
  deleted?: string;
  order?: string;
}

/**
 * Model for SelectOptions
 */
export interface SelectOptionsType {
  options: SelectOptionType[];
}

/**
 * Model for SelectOption
 */
export interface SelectOptionType {
  id?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  title?: string;
  color?: string;
  order?: number;
}

/**
 * Model for Grid
 */
export interface GridType {
  id?: string;
  title?: string;
  alias?: string;
  /** Model for Bool */
  deleted?: BoolType;
  order?: number;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  row_height?: number;
}

/**
 * Model for Grid Request
 */
export interface GridReqType {
  /**
   * The title of the grid
   * @example My Grid
   */
  title: string;
  /**
   * The order of the grid
   * @example 1
   */
  order?: number;
  /** The lock type of the grid */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /**
   * The height of the grid rows
   * @min 1
   * @example 1
   */
  row_height?: number;
}

/**
 * Model for Gallery
 */
export interface GalleryType {
  fk_view_id?: string;
  title?: string;
  alias?: string;
  /** Model for Bool */
  deleted?: BoolType;
  order?: number;
  /** Model for Bool */
  next_enabled?: BoolType;
  /** Model for Bool */
  prev_enabled?: BoolType;
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

/**
 * Model for Gallery Request
 */
export interface GalleryReqType {
  /**
   * The title of the gallery
   * @example My Gallery
   */
  title: string;
  /** Model for Bool */
  next_enabled?: BoolType;
  /** Model for Bool */
  prev_enabled?: BoolType;
  /** @min 0 */
  cover_image_idx?: number;
  cover_image?: string;
  restrict_types?: string;
  restrict_size?: string;
  restrict_number?: string;
  /** The id of the column that contains the cover image */
  fk_cover_image_col_id?: string;
  /** The lock type of gallery */
  lock_type?: 'collaborative' | 'locked' | 'personal';
}

/**
 * Model for Gallery Column
 */
export interface GalleryColumnType {
  id?: string;
  label?: string;
  help?: string;
  fk_col_id?: string;
  fk_gallery_id?: string;
}

/**
 * Model for Grid Column Request
 */
export interface GridColumnReqType {
  /**
   * The label of the column
   * @example My Column
   */
  label?: string;
  help?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /**
   * The width of the column
   * @pattern ^[0-9]+(px|%)$
   * @example 200px
   */
  width?: string;
}

/**
 * Model for Grid Column
 */
export interface GridColumnType {
  /** Unique ID of Grid Column */
  id?: string;
  label?: string;
  help?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  width?: string;
}

/**
 * Model for Kanban Column
 */
export interface KanbanColumnType {
  id?: string;
  label?: string;
  help?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  fk_kanban_id?: string;
}

/**
 * Model for Kanban
 */
export interface KanbanType {
  id?: string;
  title?: string;
  alias?: string;
  columns?: KanbanColumnType[];
  fk_model_id?: string;
  /** Model for StringOrNull */
  fk_grp_col_id?: StringOrNullType;
  fk_cover_image_col_id?: string;
  /** Model for Meta */
  meta?: MetaType;
}

/**
 * Model for Geo Location
 */
export interface GeoLocationType {
  /**
   * The latitude of the location
   * @format double
   * @example 18.52139
   */
  latitude?: number;
  /**
   * The longitude of the location
   * @format double
   * @example 179.87295
   */
  longitude?: number;
}

/**
 * Model for Map
 */
export interface MapType {
  /**
   * Unique ID for Map
   * @example vw_qjt7klod1p9kyv
   */
  fk_view_id?: string;
  /**
   * Title of Map View
   * @example My Map
   */
  title?: string;
  /**
   * The ID of the project that this view belongs to
   * @example p_xm3thidrblw4n7
   */
  project_id?: string;
  /**
   * The ID of the base that this view belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  base_id?: string;
  /**
   * Foreign Key to GeoData Column
   * @example cl_8iw2o4ejzvdyna
   */
  fk_geo_data_col_id?: string;
  /** Columns in this view */
  columns?: MapColumnType[];
  /** Meta data for this view */
  meta?: MetaType;
  /** To show this Map or not */
  show?: boolean;
  /** The order of the map list */
  order?: number;
}

/**
 * Model for Map Column
 */
export interface MapColumnType {
  /**
   * Unique ID of Map Column
   * @example nc_46xcacqn4rc9xf
   */
  id?: string;
  /**
   * Whether to show this column or not
   * @example 1
   */
  show?: number;
  /**
   * the order in the list of map columns
   * @example 1
   */
  order?: number;
  /**
   * Foreign Key to View
   * @example vw_qjt7klod1p9kyv
   */
  fk_view_id?: string;
  /**
   * Foreign Key to Column
   * @example cl_8iw2o4ejzvdyna
   */
  fk_column_id?: string;
  /**
   * The ID of the project that this map column belongs to
   * @example p_xm3thidrblw4n7
   */
  project_id?: string;
  /**
   * The ID of the base that this map column belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  base_id?: string;
}

/**
 * Model for Kanban Request
 */
export interface LicenseReqType {
  /**
   * The license key
   * @example 1234567890
   */
  key?: string;
}

/**
 * Model for Kanban Request
 */
export interface KanbanReqType {
  /**
   * The title of the kanban
   * @example My Kanban
   */
  title: string;
  /** Model for StringOrNull */
  fk_grp_col_id?: StringOrNullType;
}

/**
 * Model for Kanban Update Request
 */
export interface KanbanUpdateReqType {
  /** Model for StringOrNull */
  fk_grp_col_id?: StringOrNullType;
}

/**
 * Model for Form
 */
export interface FormType {
  id?: string;
  title?: string;
  heading?: string;
  subheading?: string;
  success_msg?: string;
  /** Model for StringOrNull */
  redirect_url?: StringOrNullType;
  /** Model for StringOrNull */
  redirect_after_secs?: StringOrNullType;
  /** Model for StringOrNull */
  email?: StringOrNullType;
  /** Model for StringOrNull */
  banner_image_url?: StringOrNullType;
  /** Model for StringOrNull */
  logo_url?: StringOrNullType;
  /** Model for Bool */
  submit_another_form?: BoolType;
  /** Model for Bool */
  show_blank_form?: BoolType;
  columns?: FormColumnType[];
  fk_model_id?: string;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Model for Meta */
  meta?: MetaType;
}

/**
 * Model for Form Request
 */
export interface FormReqType {
  /**
   * The title of the form
   * @example My Form
   */
  title?: string;
  /**
   * The heading of the form
   * @example My Form
   */
  heading?: string;
  /**
   * The subheading of the form
   * @example My Form Subheading
   */
  subheading?: string;
  /** Custom message after the form is successfully submitted */
  success_msg?: StringOrNullType;
  /** URL to redirect after submission */
  redirect_url?: StringOrNullType;
  /** The numbers of seconds to redirect after form submission */
  redirect_after_secs?: StringOrNullType;
  /** Model for StringOrNull */
  email?: StringOrNullType;
  /** Banner Image URL. Not in use currently. */
  banner_image_url?: StringOrNullType;
  /** Logo URL. Not in use currently. */
  logo_url?: StringOrNullType;
  /** Show `Submit Another Form` button */
  submit_another_form?: BoolType;
  /** Show `Blank Form` after 5 seconds */
  show_blank_form?: BoolType;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Meta Info for this view */
  meta?: MetaType;
}

/**
 * Model for Form Create
 */
export type FormCreateReqType = FormReqType;

/**
 * Model for Form Column
 */
export interface FormColumnType {
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  id?: string;
  fk_view_id?: string;
  uuid?: any;
  label?: string;
  help?: any;
  /** Model for Bool */
  required?: BoolType;
  /** Model for Bool */
  show?: BoolType;
  order?: number;
  created_at?: string;
  updated_at?: string;
  description?: string;
  /** Model for Meta */
  meta?: MetaType;
}

/**
 * Model for Form Column Request
 */
export interface FormColumnReqType {
  label?: string;
  help?: any;
  /** Model for Bool */
  required?: BoolType;
  /** Model for Bool */
  show?: BoolType;
  order?: number;
  description?: string;
  /** Model for Meta */
  meta?: MetaType;
}

/**
 * Model for Paginated
 */
export interface PaginatedType {
  pageSize?: number;
  totalRows?: number;
  sort?: string | SortType[];
  isFirstPage?: boolean;
  isLastPage?: boolean;
  page?: number;
}

/**
 * Model for Hook List
 */
export interface HookListType {
  list?: object[];
  /** Model for Paginated */
  pageInfo?: PaginatedType;
}

/**
 * Model for Shared View
 */
export interface SharedViewType {
  id?: string;
  fk_view_id?: string;
  password?: string;
  deleted?: string;
}

/**
 * Model for Shared View List
 */
export interface SharedViewListType {
  list?: SharedViewType[];
  /** Model for Paginated */
  pageInfo?: PaginatedType;
}

/**
 * Model for View List
 */
export interface ViewListType {
  list?: ViewType[];
  /** Model for Paginated */
  pageInfo?: PaginatedType;
}

/**
 * Model for Attachment
 */
export interface AttachmentType {
  url?: string;
  title?: string;
  mimetype?: string;
  size?: string;
  icon?: string;
  path?: string;
  data?: any;
}

/**
 * Model for Webhook
 */
export interface WebhookType {
  id?: string;
  title?: string;
  type?: string;
}

/**
 * Model for Audit
 */
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

/**
 * Model for Hook
 */
export interface HookType {
  id?: string;
  fk_model_id?: string;
  title?: string;
  description?: string;
  env?: string;
  type?: string;
  event?: 'after' | 'before';
  operation?: 'insert' | 'delete' | 'update';
  /** Model for Bool */
  async?: BoolType;
  notification?: string;
  retries?: number;
  retry_interval?: number;
  timeout?: number;
  /** Model for Bool */
  active?: BoolType;
}

/**
 * Model for Hook Request
 */
export interface HookReqType {
  fk_model_id?: string;
  title: string;
  /** Model for StringOrNull */
  description?: StringOrNullType;
  env?: string;
  event: 'after' | 'before';
  operation: 'insert' | 'delete' | 'update';
  /** Model for Bool */
  async?: BoolType;
  notification: any;
  retries?: number | null;
  retry_interval?: number | null;
  timeout?: number | null;
  /** Model for Bool */
  active?: BoolType;
}

/**
 * Model for Hook Test Request
 */
export interface HookTestReqType {
  payload: any;
  /** Model for Hook Request */
  hook: HookReqType;
}

/**
 * Model for Signup Request
 */
export interface SignUpReqType {
  /**
   * Email address of the user
   * @format email
   * @example user@example.com
   */
  email: string;
  /**
   * Password of the user
   * @example password123456789
   */
  password: string;
}

/**
 * Model for Signin Request
 */
export interface SignInReqType {
  /**
   * Email address of the user
   * @format email
   */
  email: string;
  /** Password of the user */
  password: string;
}

/**
 * Model for Password Forgot Request
 */
export interface PasswordForgotReqType {
  /**
   * Email address of the user
   * @format email
   */
  email: string;
}

/**
 * Model for Password Reset Request
 */
export interface PasswordResetReqType {
  /**
   * New password
   * @example newpassword
   */
  password: string;
}

/**
 * Model for Password Change Request
 */
export interface PasswordChangeReqType {
  currentPassword: string;
  newPassword: string;
}

/**
 * Model for API Token Request
 */
export interface ApiTokenReqType {
  /** Description of the API token */
  description?: string;
}

/**
 * Model for Plugin
 */
export interface PluginType {
  id?: string;
  title?: string;
  description?: string;
  /** Model for Bool */
  active?: BoolType;
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
  input?: number | StringOrNullType;
  creator?: string;
  creator_website?: string;
  price?: string;
}

/**
 * Model for ModelRoleVisibility
 */
export interface ModelRoleVisibilityType {
  id?: string;
  project_id?: string;
  base_id?: string;
  fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  /** Model for Bool */
  disabled?: BoolType;
}

/**
 * Model for API Token
 */
export interface ApiTokenType {
  id?: string;
  token?: string;
  description?: string;
  fk_user_id?: string;
  created_at?: any;
  updated_at?: any;
}

/**
 * Model for Hook Log
 */
export interface HookLogType {
  id?: string;
  base_id?: string;
  project_id?: string;
  /** Model for StringOrNull */
  fk_hook_id?: StringOrNullType;
  type?: string;
  event?: string;
  operation?: string;
  /** Model for Bool */
  test_call?: BoolType;
  payload?: any;
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

/**
 * Model for Normal Column Request
 */
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
    | 'GeoData'
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
  title?: string;
  dt?: string;
  np?: number | StringOrNullType;
  ns?: number | StringOrNullType;
  /** Model for Bool */
  pk?: BoolType;
  /** Model for Bool */
  pv?: BoolType;
  /** Model for Bool */
  rqd?: BoolType;
  column_name?: string;
  /** Model for Bool */
  un?: BoolType;
  /** Model for Bool */
  ai?: BoolType;
  /** Model for Bool */
  unique?: BoolType;
  /** Model for StringOrNull */
  cdf?: StringOrNullType;
  /** Model for StringOrNull */
  cc?: StringOrNullType;
  /** Model for StringOrNull */
  csn?: StringOrNullType;
  /** Model for StringOrNull */
  dtx?: StringOrNullType;
  dtxp?: number | StringOrNullType;
  dtxs?: number | StringOrNullType;
  /** Model for Bool */
  au?: BoolType;
}

/**
 * Model for LinkToAnotherColumn Request
 */
export interface LinkToAnotherColumnReqType {
  uidt: 'LinkToAnotherRecord';
  title: string;
  /** Model for Bool */
  virtual?: BoolType;
  /** Model for ID */
  parentId: IdType;
  /** Model for ID */
  childId: IdType;
  type: 'hm' | 'bt' | 'mm';
}

/**
 * Model for Rollup Column Request
 */
export interface RollupColumnReqType {
  uidt: 'Rollup';
  title: string;
  /** Model for ID */
  fk_relation_column_id: IdType;
  /** Model for ID */
  fk_rollup_column_id: IdType;
  rollup_function:
    | 'count'
    | 'min'
    | 'max'
    | 'avg'
    | 'sum'
    | 'countDistinct'
    | 'sumDistinct'
    | 'avgDistinct';
}

/**
 * Model for Lookup Column Request
 */
export interface LookupColumnReqType {
  uidt: 'Lookup';
  title: string;
  /** Model for ID */
  fk_relation_column_id: IdType;
  /** Model for ID */
  fk_lookup_column_id: IdType;
}

/**
 * Model for Formula Column Request
 */
export interface FormulaColumnReqType {
  uidt?: 'Formula';
  formula_raw?: string;
  formula?: string;
  title?: string;
}

/**
 * Model for Column Request
 */
export type ColumnReqType = (
  | LinkToAnotherColumnReqType
  | RollupColumnReqType
  | FormulaColumnReqType
  | LookupColumnReqType
  | NormalColumnRequestType
  | (LinkToAnotherColumnReqType &
      RollupColumnReqType &
      FormulaColumnReqType &
      LookupColumnReqType &
      NormalColumnRequestType)
) & {
  column_name: string;
  title: string;
  /** Column order in a specific view */
  column_order?: {
    view_id?: string;
    order?: number;
  };
};

/**
 * Model for User Info
 */
export interface UserInfoType {
  /** User ID */
  id?: string;
  /**
   * User Email
   * @format email
   */
  email?: string;
  /** Set to true if the user's email has been verified. */
  email_verified?: boolean;
  /** The firstname of the user */
  firstname?: string;
  /** The lastname of the user */
  lastname?: string;
  /** The roles of the user */
  roles?: any;
}

/**
 * Model for Visibility Rule Request
 */
export type VisibilityRuleReqType = {
  disabled?: {
    /** Model for Bool */
    commenter?: BoolType;
    /** Model for Bool */
    creator?: BoolType;
    /** Model for Bool */
    editor?: BoolType;
    /** Model for Bool */
    guest?: BoolType;
    /** Model for Bool */
    owner?: BoolType;
    /** Model for Bool */
    viewer?: BoolType;
  };
}[];

/**
 * Model for Bool
 */
export type BoolType = boolean | number | null;

/**
 * Model for ID
 */
export type IdType = string;

/**
 * Model for Password
 * @example password123456789
 */
export type PasswordType = string;

/**
 * Model for StringOrNull
 */
export type StringOrNullType = string | null;

/**
 * Model for Meta
 */
export type MetaType = object | string | null;

/**
 * Model for Comment Request
 */
export interface CommentReqType {
  row_id: string;
  fk_model_id: string;
  description?: string;
}

/**
 * Model for Audit Row Update Request
 */
export interface AuditRowUpdateReqType {
  fk_model_id?: string;
  column_name?: string;
  row_id?: string;
  value?: any;
  prev_value?: any;
}

/**
 * Model for Organisation User Update Request
 */
export interface OrgUserReqType {
  /** @format email */
  email?: string;
  roles?: 'org-level-creator' | 'org-level-viewer';
}

/**
 * Model for Project User Request
 */
export interface ProjectUserReqType {
  /** @format email */
  email: string;
  roles: 'owner' | 'editor' | 'viewer' | 'commenter' | 'guest';
}

/**
 * Model for Shared Base Request
 */
export interface SharedBaseReqType {
  roles?: 'editor' | 'viewer' | 'commenter';
  password?: string;
}

/**
 * Model for Plugin Test Request
 */
export interface PluginTestReqType {
  title: string;
  input: any;
}

/**
 * Model for Plugin Request
 */
export interface PluginReqType {
  /** Model for Bool */
  active?: BoolType;
  input?: any;
}

/**
 * Model for View Request
 */
export interface ViewReqType {
  /** @min 0 */
  order?: number;
  /** Model for Meta */
  meta?: MetaType;
  title?: string;
  /** Model for Bool */
  show_system_fields?: BoolType;
  lock_type?: 'collaborative' | 'locked' | 'personal';
}

/**
 * Model for Shared View Request
 */
export interface SharedViewReqType {
  /**
   * Password to restrict access
   * @example 123456789
   */
  password?: string;
  /** Meta data passing to Shared View such as if download is allowed or not. */
  meta?: MetaType;
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
 *
 * NocoDB API Documentation
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
 * @request POST:/api/v1/auth/user/signup
 * @response `200` `{
  \** The signed JWT token for information exchange *\
  token?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad Request
 */
    signup: (data: SignUpReqType, params: RequestParams = {}) =>
      this.request<
        {
          /** The signed JWT token for information exchange */
          token?: string;
        },
        {
          msg?: string;
        }
      >({
        path: `/api/v1/auth/user/signup`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Clear refresh token from the database and cookie.
 * 
 * @tags Auth
 * @name Signout
 * @summary Signout
 * @request POST:/api/v1/auth/user/signout
 * @response `200` `{
  \** Success Message *\
  msg?: string,

}` OK
 */
    signout: (params: RequestParams = {}) =>
      this.request<
        {
          /** Success Message */
          msg?: string;
        },
        any
      >({
        path: `/api/v1/auth/user/signout`,
        method: 'POST',
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
  \** The signed JWT token for information exchange *\
  token?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad Request
 */
    signin: (data: SignInReqType, params: RequestParams = {}) =>
      this.request<
        {
          /** The signed JWT token for information exchange */
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
     * @summary Get User Info
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
     * @summary Forget Password
     * @request POST:/api/v1/auth/password/forgot
     * @response `200` `void` OK
     * @response `401` `void` Unauthorized
     */
    passwordForgot: (data: PasswordForgotReqType, params: RequestParams = {}) =>
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
 * @summary Change Password
 * @request POST:/api/v1/auth/password/change
 * @response `200` `{
  msg?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad request
 */
    passwordChange: (data: PasswordChangeReqType, params: RequestParams = {}) =>
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
     * @description Validate password reset url token.
     *
     * @tags Auth
     * @name PasswordResetTokenValidate
     * @summary Verify Reset Token
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
     * @summary Verify Email
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
     * @summary Reset Password
     * @request POST:/api/v1/auth/password/reset/{token}
     * @response `200` `void` OK
     */
    passwordReset: (
      token: string,
      data: PasswordResetReqType,
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
 * @description Regenerate user refresh token
 * 
 * @tags Auth
 * @name TokenRefresh
 * @summary Refresh Token
 * @request POST:/api/v1/auth/token/refresh
 * @response `200` `{
  token?: string,

}` OK
 */
    tokenRefresh: (params: RequestParams = {}) =>
      this.request<
        {
          token?: string;
        },
        any
      >({
        path: `/api/v1/auth/token/refresh`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description List all users in the given project.
 * 
 * @tags Auth
 * @name ProjectUserList
 * @summary List Project Users
 * @request GET:/api/v1/db/meta/projects/{projectId}/users
 * @response `200` `{
  users?: {
  list: (UserType)[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

},

}` OK
 */
    projectUserList: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: UserType[];
            /** Model for Paginated */
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
     * @description Create a user and add it to the given project
     *
     * @tags Auth
     * @name ProjectUserAdd
     * @summary Create Project User
     * @request POST:/api/v1/db/meta/projects/{projectId}/users
     * @response `200` `any` OK
     */
    projectUserAdd: (
      projectId: IdType,
      data: ProjectUserReqType,
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
     * @description Update a given user in a given project. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Auth
     * @name ProjectUserUpdate
     * @summary Update Project User
     * @request PATCH:/api/v1/db/meta/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserUpdate: (
      projectId: IdType,
      userId: IdType,
      data: ProjectUserReqType,
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
     * @description Delete a given user in a given project. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Auth
     * @name ProjectUserRemove
     * @summary Delete Project User
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/users/{userId}
     * @response `200` `any` OK
     */
    projectUserRemove: (
      projectId: IdType,
      userId: IdType,
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
     * @summary Resend User Invitation
     * @request POST:/api/v1/db/meta/projects/{projectId}/users/{userId}/resend-invite
     * @response `200` `any` OK
     */
    projectUserResendInvite: (
      projectId: IdType,
      userId: IdType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/users/${userId}/resend-invite`,
        method: 'POST',
        format: 'json',
        ...params,
      }),
  };
  organisationTokens = {
    /**
 * @description List all organisation API tokens.  Access with API tokens will be blocked.
 * 
 * @tags Organisation Tokens
 * @name OrgTokensList
 * @summary List Organisation API Tokens
 * @request GET:/api/v1/tokens
 * @response `200` `{
  users?: {
  list: ((ApiTokenType & {
  created_by?: string,

}))[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

},

}` OK
 */
    orgTokensList: (params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: (ApiTokenType & {
              created_by?: string;
            })[];
            /** Model for Paginated */
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
     * @description Creat an organisation API token. Access with API tokens will be blocked.
     *
     * @tags Organisation Tokens
     * @name OrgTokensCreate
     * @summary Create Organisation API Token
     * @request POST:/api/v1/tokens
     * @response `200` `void` OK
     */
    orgTokensCreate: (data: ApiTokenReqType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/tokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete an organisation API token. Access with API tokens will be blocked.
     *
     * @tags Organisation Tokens
     * @name OrgTokensDelete
     * @summary Delete Organisation API Tokens
     * @request DELETE:/api/v1/tokens/{token}
     * @response `200` `void` OK
     */
    orgTokensDelete: (token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/tokens/${token}`,
        method: 'DELETE',
        ...params,
      }),
  };
  organisationLicense = {
    /**
 * @description Get the application license key. Exclusive for super admin.
 * 
 * @tags Organisation License
 * @name OrgLicenseGet
 * @summary Get App License
 * @request GET:/api/v1/license
 * @response `200` `{
  key?: string,

}` OK
 */
    orgLicenseGet: (params: RequestParams = {}) =>
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
     * @description Set the application license key. Exclusive for super admin.
     *
     * @tags Organisation License
     * @name OrgLicenseSet
     * @summary Create App License
     * @request POST:/api/v1/license
     * @response `200` `void` OK
     */
    orgLicenseSet: (data: LicenseReqType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/license`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  organisationAppSettings = {
    /**
 * @description Get the application settings. Exclusive for super admin.
 * 
 * @tags Organisation App Settings
 * @name OrgAppSettingsGet
 * @summary Get App Settings
 * @request GET:/api/v1/app-settings
 * @response `200` `{
  invite_only_signup?: boolean,

}` OK
 */
    orgAppSettingsGet: (params: RequestParams = {}) =>
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
     * @description Update the application settings. Exclusive for super admin.
     *
     * @tags Organisation App Settings
     * @name OrgAppSettingsSet
     * @summary Create App Settings
     * @request POST:/api/v1/app-settings
     * @response `200` `void` OK
     */
    orgAppSettingsSet: (
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
  organisationUsers = {
    /**
 * @description List all organisation users. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Organisation Users
 * @name OrgUsersList
 * @summary List Organisation Users
 * @request GET:/api/v1/users
 * @response `200` `{
  users?: {
  list: (UserType)[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

},

}` OK
 */
    orgUsersList: (params: RequestParams = {}) =>
      this.request<
        {
          users?: {
            list: UserType[];
            /** Model for Paginated */
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
     * @description Create an organisation user. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Organisation Users
     * @name OrgUsersAdd
     * @summary Create Organisation User
     * @request POST:/api/v1/users
     * @response `200` `any` OK
     */
    orgUsersAdd: (data: OrgUserReqType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/users`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update an organisation user by User ID. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Organisation Users
     * @name OrgUsersUpdate
     * @summary Update Organisation User
     * @request PATCH:/api/v1/users/{userId}
     * @response `200` `void` OK
     */
    orgUsersUpdate: (
      userId: IdType,
      data: OrgUserReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete an organisation user by User ID. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Organisation Users
     * @name OrgUsersDelete
     * @summary Delete Organisation User
     * @request DELETE:/api/v1/users/{userId}
     * @response `200` `void` OK
     */
    orgUsersDelete: (userId: IdType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Resend Invitation to a specific user. Exclusive for Super Admin. Access with API Tokens will be blocked.
     *
     * @tags Organisation Users
     * @name OrgUsersResendInvite
     * @summary Invite Organisation User
     * @request POST:/api/v1/users/{userId}/resend-invite
     * @response `200` `void` OK
     */
    orgUsersResendInvite: (userId: IdType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/users/${userId}/resend-invite`,
        method: 'POST',
        ...params,
      }),

    /**
 * @description Generate Password Reset Token for Organisation User. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Organisation Users
 * @name OrgUsersGeneratePasswordResetToken
 * @summary Generate Organisation User Password Reset Token
 * @request POST:/api/v1/users/{userId}/generate-reset-url
 * @response `200` `{
  reset_password_token?: string,
  reset_password_url?: string,

}` OK
 */
    orgUsersGeneratePasswordResetToken: (
      userId: IdType,
      params: RequestParams = {}
    ) =>
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
 * @description Get info such as node version, arch, platform, is docker, rootdb and package version of a given project
 * 
 * @tags Project
 * @name MetaGet
 * @summary Get Project info
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
    metaGet: (projectId: IdType, params: RequestParams = {}) =>
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
        format: 'json',
        ...params,
      }),

    /**
     * @description Hide / show views based on user role
     *
     * @tags Project
     * @name ModelVisibilityList
     * @summary Get UI ACL
     * @request GET:/api/v1/db/meta/projects/{projectId}/visibility-rules
     * @response `200` `(any)[]` OK
     */
    modelVisibilityList: (
      projectId: IdType,
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
     * @description Hide / show views based on user role
     *
     * @tags Project
     * @name ModelVisibilitySet
     * @summary Create UI ACL
     * @request POST:/api/v1/db/meta/projects/{projectId}/visibility-rules
     * @response `200` `VisibilityRuleReqType` OK
     */
    modelVisibilitySet: (
      projectId: IdType,
      data: any,
      params: RequestParams = {}
    ) =>
      this.request<VisibilityRuleReqType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/visibility-rules`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description List all project meta data
     *
     * @tags Project
     * @name List
     * @summary List Projects
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
     * @description Create a new project
     *
     * @tags Project
     * @name Create
     * @summary Create Project
     * @request POST:/api/v1/db/meta/projects/
     * @response `200` `ProjectReqType` OK
     */
    create: (
      data: ProjectType & {
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<ProjectReqType, any>({
        path: `/api/v1/db/meta/projects/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get the info of a given projecct
     *
     * @tags Project
     * @name Read
     * @summary Get Project
     * @request GET:/api/v1/db/meta/projects/{projectId}
     * @response `200` `object` OK
     */
    read: (projectId: IdType, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete the given project
     *
     * @tags Project
     * @name Delete
     * @summary Delete Project
     * @request DELETE:/api/v1/db/meta/projects/{projectId}
     * @response `200` `void` OK
     */
    delete: (projectId: IdType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Update the given project
     *
     * @tags Project
     * @name Update
     * @summary Update Project
     * @request PATCH:/api/v1/db/meta/projects/{projectId}
     * @response `200` `void` OK
     */
    update: (projectId: IdType, data: any, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
 * @description Get Project Shared Base
 * 
 * @tags Project
 * @name SharedBaseGet
 * @summary Get Project Shared Base
 * @request GET:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  uuid?: string,
  url?: string,
  roles?: string,

}` OK
 */
    sharedBaseGet: (projectId: IdType, params: RequestParams = {}) =>
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
     * @description Delete Project Shared Base
     *
     * @tags Project
     * @name SharedBaseDisable
     * @summary Delete Project Shared Base
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/shared
     * @response `200` `void` OK
     */
    sharedBaseDisable: (projectId: IdType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
        method: 'DELETE',
        ...params,
      }),

    /**
 * @description Create Project Shared Base
 * 
 * @tags Project
 * @name SharedBaseCreate
 * @summary Create Project Shared Base
 * @request POST:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  \** Model for StringOrNull *\
  uuid?: StringOrNullType,
  \** Model for StringOrNull *\
  roles?: StringOrNullType,

}` OK
 */
    sharedBaseCreate: (
      projectId: IdType,
      data: SharedBaseReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** Model for StringOrNull */
          uuid?: StringOrNullType;
          /** Model for StringOrNull */
          roles?: StringOrNullType;
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
 * @description Update Project Shared Base
 * 
 * @tags Project
 * @name SharedBaseUpdate
 * @summary Update Project Shared Base
 * @request PATCH:/api/v1/db/meta/projects/{projectId}/shared
 * @response `200` `{
  uuid?: string,
  url?: string,
  roles?: string,

}` OK
 */
    sharedBaseUpdate: (
      projectId: IdType,
      data: SharedBaseReqType,
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
     * @description Calculate the Project Cost
     *
     * @tags Project
     * @name Cost
     * @summary Project Cost
     * @request GET:/api/v1/db/meta/projects/{projectId}/cost
     * @response `200` `object` OK
     */
    cost: (projectId: IdType, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}/cost`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Synchronise the meta data difference between NC_DB and external data sources
     *
     * @tags Project
     * @name MetaDiffSync
     * @summary Sync Meta
     * @request POST:/api/v1/db/meta/projects/{projectId}/meta-diff
     * @response `200` `any` OK
     */
    metaDiffSync: (projectId: IdType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * @description Get the meta data difference between NC_DB and external data sources
     *
     * @tags Project
     * @name MetaDiffGet
     * @summary Meta Diff
     * @request GET:/api/v1/db/meta/projects/{projectId}/meta-diff
     * @response `200` `any` OK
     */
    metaDiffGet: (projectId: IdType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/meta-diff`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Check if a project contains empty and null filters. Used in `Show NULL and EMPTY in Filter` in Project Setting.
     *
     * @tags Project
     * @name HasEmptyOrNullFilters
     * @summary List Empty & Null Filter
     * @request GET:/api/v1/db/meta/projects/{projectId}/has-empty-or-null-filters
     * @response `200` `any` OK
     */
    hasEmptyOrNullFilters: (projectId: IdType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/projects/${projectId}/has-empty-or-null-filters`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description List all audit data in the given project
 * 
 * @tags Project
 * @name AuditList
 * @summary List Audits in Project
 * @request GET:/api/v1/db/meta/projects/{projectId}/audits
 * @response `200` `{
  list: (AuditType)[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

}` OK
 */
    auditList: (
      projectId: IdType,
      query?: {
        /** @min 0 */
        offset?: number;
        /** @max 1 */
        limit?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          list: AuditType[];
          /** Model for Paginated */
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
     * @description Get the base details of a given project
     *
     * @tags Base
     * @name Read
     * @summary Get Base
     * @request GET:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `object` OK
     */
    read: (projectId: IdType, baseId: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete the base details of a given project
     *
     * @tags Base
     * @name Delete
     * @summary Delete Base
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `void` OK
     */
    delete: (projectId: IdType, baseId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Update the base details of a given project
     *
     * @tags Base
     * @name Update
     * @summary Update Base
     * @request PATCH:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
     * @response `200` `void` OK
     */
    update: (
      projectId: IdType,
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
     * @summary List Bases
     * @request GET:/api/v1/db/meta/projects/{projectId}/bases/
     * @response `200` `BaseListType` OK
     */
    list: (projectId: IdType, params: RequestParams = {}) =>
      this.request<BaseListType, any>({
        path: `/api/v1/db/meta/projects/${projectId}/bases/`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new base on a given project
     *
     * @tags Base
     * @name Create
     * @summary Create Base
     * @request POST:/api/v1/db/meta/projects/{projectId}/bases/
     * @response `200` `BaseType` OK
     */
    create: (
      projectId: IdType,
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
     * @description List all tables in a given Project and Base
     *
     * @tags Base
     * @name TableList
     * @summary List Tables
     * @request GET:/api/v1/db/meta/projects/{projectId}/{baseId}/tables
     * @response `200` `TableListType`
     */
    tableList: (
      projectId: IdType,
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
     * @description Create a new table in a given Project and Base
     *
     * @tags Base
     * @name TableCreate
     * @summary Create Table
     * @request POST:/api/v1/db/meta/projects/{projectId}/{baseId}/tables
     * @response `200` `TableType` OK
     */
    tableCreate: (
      projectId: IdType,
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
     * @description Synchronise the meta data difference between NC_DB and external data sources in a given Base
     *
     * @tags Base
     * @name MetaDiffSync
     * @summary Synchronise Base Meta
     * @request POST:/api/v1/db/meta/projects/{projectId}/meta-diff/{baseId}
     * @response `200` `any` OK
     */
    metaDiffSync: (
      projectId: IdType,
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
     * @description Get the meta data difference between NC_DB and external data sources in a given Base
     *
     * @tags Base
     * @name MetaDiffGet
     * @summary Base Meta Diff
     * @request GET:/api/v1/db/meta/projects/{projectId}/meta-diff/{baseId}
     * @response `200` `any` OK
     */
    metaDiffGet: (
      projectId: IdType,
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
     * @description Create a new table in a given project
     *
     * @tags DB Table
     * @name Create
     * @summary Create Table
     * @request POST:/api/v1/db/meta/projects/{projectId}/tables
     * @response `200` `TableType` OK
     */
    create: (
      projectId: IdType,
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
     * @description List all tables in a given project
     *
     * @tags DB Table
     * @name List
     * @summary List Tables
     * @request GET:/api/v1/db/meta/projects/{projectId}/tables
     * @response `200` `TableListType`
     */
    list: (
      projectId: IdType,
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
     * @description Read the table meta data by the given table ID
     *
     * @tags DB Table
     * @name Read
     * @summary Read Table
     * @request GET:/api/v1/db/meta/tables/{tableId}
     * @response `200` `TableInfoType` OK
     */
    read: (tableId: IdType, params: RequestParams = {}) =>
      this.request<TableInfoType, any>({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the table meta data by the given table ID
     *
     * @tags DB Table
     * @name Update
     * @summary Update Table
     * @request PATCH:/api/v1/db/meta/tables/{tableId}
     * @response `200` `any` OK
     */
    update: (
      tableId: IdType,
      data: {
        table_name?: string;
        title?: string;
        project_id?: string;
        /** Model for Meta */
        meta?: MetaType;
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
     * @tags DB Table
     * @name Delete
     * @summary Delete Table
     * @request DELETE:/api/v1/db/meta/tables/{tableId}
     * @response `200` `void` OK
     */
    delete: (tableId: IdType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Update the order of the given Table
     *
     * @tags DB Table
     * @name Reorder
     * @summary Reorder Table
     * @request POST:/api/v1/db/meta/tables/{tableId}/reorder
     * @response `200` `void` OK
     */
    reorder: (
      tableId: IdType,
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
     * @description Create a new column in a given Table
     *
     * @tags DB Table Column
     * @name Create
     * @summary Create Column
     * @request POST:/api/v1/db/meta/tables/{tableId}/columns
     * @response `200` `void` OK
     */
    create: (
      tableId: IdType,
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
     * @description Update the existing column by the given column ID
     *
     * @tags DB Table Column
     * @name Update
     * @summary Update Column
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
     * @description Delete the existing column by the given column ID
     *
     * @tags DB Table Column
     * @name Delete
     * @summary Delete Column
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
     * @description Get the existing column by the given column ID
     *
     * @tags DB Table Column
     * @name Get
     * @summary Get Column
     * @request GET:/api/v1/db/meta/columns/{columnId}
     * @response `200` `void` OK
     */
    get: (columnId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/columns/${columnId}`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Set a primary value on a given column
     *
     * @tags DB Table Column
     * @name PrimaryColumnSet
     * @summary Create Primary Value
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
     * @description List all views in a given Table.
     *
     * @tags DB View
     * @name List
     * @summary List views
     * @request GET:/api/v1/db/meta/tables/{tableId}/views
     * @response `200` `ViewListType`
     */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<ViewListType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/views`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Update the view with the given view Id.
     *
     * @tags DB View
     * @name Update
     * @summary Update View
     * @request PATCH:/api/v1/db/meta/views/{viewId}
     * @response `200` `void` OK
     */
    update: (viewId: string, data: ViewReqType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/views/${viewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete the view with the given view Id.
     *
     * @tags DB View
     * @name Delete
     * @summary Delete View
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
     * @description Show All Columns in a given View
     *
     * @tags DB View
     * @name ShowAllColumn
     * @summary Show All Columns In View
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
     * @description Hide All Columns in a given View
     *
     * @tags DB View
     * @name HideAllColumn
     * @summary Hide All Columns In View
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
     * @description Create a new grid view in a given Table
     *
     * @tags DB View
     * @name GridCreate
     * @summary Create Grid View
     * @request POST:/api/v1/db/meta/tables/{tableId}/grids
     * @response `200` `GridType` OK
     */
    gridCreate: (
      tableId: IdType,
      data: GridReqType,
      params: RequestParams = {}
    ) =>
      this.request<GridType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/grids`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new form view in a given Table
     *
     * @tags DB View
     * @name FormCreate
     * @summary Create Form View
     * @request POST:/api/v1/db/meta/tables/{tableId}/forms
     * @response `200` `FormType` OK
     */
    formCreate: (
      tableId: IdType,
      data: FormCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<FormType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/forms`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the form data by Form ID
     *
     * @tags DB View
     * @name FormUpdate
     * @summary Update Form
     * @request PATCH:/api/v1/db/meta/forms/{formViewId}
     * @response `200` `void` OK
     */
    formUpdate: (
      formViewId: string,
      data: FormReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/forms/${formViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get the form data by Form ID
     *
     * @tags DB View
     * @name FormRead
     * @summary Get Form
     * @request GET:/api/v1/db/meta/forms/{formViewId}
     * @response `200` `FormType` OK
     */
    formRead: (formViewId: string, params: RequestParams = {}) =>
      this.request<FormType, any>({
        path: `/api/v1/db/meta/forms/${formViewId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the form column(s) by Form View Column ID
     *
     * @tags DB View
     * @name FormColumnUpdate
     * @summary Update Form Column
     * @request PATCH:/api/v1/db/meta/form-columns/{formViewColumnId}
     * @response `200` `FormColumnReqType` OK
     */
    formColumnUpdate: (
      formViewColumnId: IdType,
      data: FormColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<FormColumnReqType, any>({
        path: `/api/v1/db/meta/form-columns/${formViewColumnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update Grid View
     *
     * @tags DB View
     * @name GridUpdate
     * @summary Update Grid View
     * @request PATCH:/api/v1/db/meta/grids/{viewId}
     * @response `200` `any` OK
     */
    gridUpdate: (viewId: string, data: GridType, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/grids/${viewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description List all columns in the given Grid
     *
     * @tags DB View
     * @name GridColumnsList
     * @summary List Grid Columns
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
     * @description Update grid column(s) in the given Grid
     *
     * @tags DB View
     * @name GridColumnUpdate
     * @summary Update Grid Column
     * @request PATCH:/api/v1/db/meta/grid-columns/{columnId}
     * @response `200` `any` OK
     */
    gridColumnUpdate: (
      columnId: IdType,
      data: GridColumnReqType,
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
     * @tags DB View
     * @name GalleryCreate
     * @summary Gallery View
     * @request POST:/api/v1/db/meta/tables/{tableId}/galleries
     * @response `200` `object` OK
     */
    galleryCreate: (
      tableId: IdType,
      data: GalleryReqType,
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
     * @description Update the Gallery View data with Gallery ID
     *
     * @tags DB View
     * @name GalleryUpdate
     * @summary Update Gallery View
     * @request PATCH:/api/v1/db/meta/galleries/{galleryId}
     * @response `200` `void` OK
     */
    galleryUpdate: (
      galleryId: string,
      data: GalleryReqType,
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
     * @description Get the Gallery View data with Gallery ID
     *
     * @tags DB View
     * @name GalleryRead
     * @summary Get Gallery View
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
     * @description Create a new Kanban View
     *
     * @tags DB View
     * @name KanbanCreate
     * @summary Create Kanban View
     * @request POST:/api/v1/db/meta/tables/{tableId}/kanbans
     * @response `200` `object` OK
     */
    kanbanCreate: (
      tableId: IdType,
      data: KanbanReqType,
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
     * @description Update the Kanban View data with Kanban ID
     *
     * @tags DB View
     * @name KanbanUpdate
     * @summary Update Kanban View
     * @request PATCH:/api/v1/db/meta/kanbans/{kanbanId}
     * @response `200` `void` OK
     */
    kanbanUpdate: (
      kanbanId: string,
      data: KanbanUpdateReqType,
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
     * @description Get the Kanban View data by Kanban ID
     *
     * @tags DB View
     * @name KanbanRead
     * @summary Get Kanban View
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

    /**
     * @description Create a new Map View
     *
     * @tags DB View
     * @name MapCreate
     * @summary Create Map View
     * @request POST:/api/v1/db/meta/tables/{tableId}/maps
     * @response `200` `object` OK
     */
    mapCreate: (tableId: IdType, data: MapType, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/db/meta/tables/${tableId}/maps`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the Map View data by Map ID
     *
     * @tags DB View
     * @name MapUpdate
     * @summary Update Map View
     * @request PATCH:/api/v1/db/meta/maps/{mapId}
     * @response `200` `void` OK
     */
    mapUpdate: (mapId: string, data: MapType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/maps/${mapId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get the Map View data by Map ID
     *
     * @tags DB View
     * @name MapRead
     * @summary Get Map View
     * @request GET:/api/v1/db/meta/maps/{mapId}
     * @response `200` `MapType` OK
     */
    mapRead: (mapId: string, params: RequestParams = {}) =>
      this.request<MapType, any>({
        path: `/api/v1/db/meta/maps/${mapId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbViewShare = {
    /**
     * @description List all shared views in a given Table
     *
     * @tags DB View Share
     * @name List
     * @summary List Shared Views
     * @request GET:/api/v1/db/meta/tables/{tableId}/share
     * @response `200` `(any)[]` OK
     */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<any[], any>({
        path: `/api/v1/db/meta/tables/${tableId}/share`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a shared view in a given View..
 * 
 * @tags DB View Share
 * @name Create
 * @summary Create Shared View
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
     * @description Update a shared view in a given View..
     *
     * @tags DB View Share
     * @name Update
     * @summary Update Shared View
     * @request PATCH:/api/v1/db/meta/views/{viewId}/share
     * @response `200` `SharedViewType` OK
     */
    update: (
      viewId: string,
      data: SharedViewReqType,
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
     * @description Delete a shared view in a given View.
     *
     * @tags DB View Share
     * @name Delete
     * @summary Delete Shared View
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
     * @description List all columns by ViewID
     *
     * @tags DB View Column
     * @name List
     * @summary List Columns In View
     * @request GET:/api/v1/db/meta/views/{viewId}/columns
     */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/views/${viewId}/columns`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Create a new column in a given View
     *
     * @tags DB View Column
     * @name Create
     * @summary Create Column in View
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
     * @description Update a column in a View
     *
     * @tags DB View Column
     * @name Update
     * @summary Update View Column
     * @request PATCH:/api/v1/db/meta/views/{viewId}/columns/{columnId}
     * @response `200` `void` OK
     */
    update: (
      viewId: IdType,
      columnId: IdType,
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
 * @description List all the sort data in a given View
 * 
 * @tags DB Table Sort
 * @name List
 * @summary List View Sorts
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
     * @description Update the sort data in a given View
     *
     * @tags DB Table Sort
     * @name Create
     * @summary Update View Sort
     * @request POST:/api/v1/db/meta/views/{viewId}/sorts
     * @response `200` `void` OK
     */
    create: (
      viewId: string,
      data: SortReqType & {
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
     * @description Get the sort data by Sort ID
     *
     * @tags DB Table Sort
     * @name Get
     * @summary Get Sort
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
     * @description Update the sort data by Sort ID
     *
     * @tags DB Table Sort
     * @name Update
     * @summary Update Sort
     * @request PATCH:/api/v1/db/meta/sorts/{sortId}
     * @response `200` `void` OK
     */
    update: (sortId: string, data: SortReqType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete the sort data by Sort ID
     *
     * @tags DB Table Sort
     * @name Delete
     * @summary Delete Sort
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
     * @description Get the filter data in a given View
     *
     * @tags DB Table Filter
     * @name Read
     * @summary Get View Filter
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
     * @description Update the filter data in a given View
     *
     * @tags DB Table Filter
     * @name Create
     * @summary Create View Filter
     * @request POST:/api/v1/db/meta/views/{viewId}/filters
     * @response `200` `FilterType` OK
     */
    create: (viewId: string, data: FilterReqType, params: RequestParams = {}) =>
      this.request<FilterType, any>({
        path: `/api/v1/db/meta/views/${viewId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get the filter data with a given Filter ID
     *
     * @tags DB Table Filter
     * @name Get
     * @summary Get Filter
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
     * @description Update the filter data with a given Filter ID
     *
     * @tags DB Table Filter
     * @name Update
     * @summary Update Filter
     * @request PATCH:/api/v1/db/meta/filters/{filterId}
     * @response `200` `void` OK
     */
    update: (
      filterId: string,
      data: FilterReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete the filter data with a given Filter ID
     *
     * @tags DB Table Filter
     * @name Delete
     * @summary Delete Filter
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
     * @description Get Filter Group Children of a given group ID
     *
     * @tags DB Table Filter
     * @name ChildrenRead
     * @summary Get Filter Group Children
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
  dbTableHookFilter = {
    /**
     * @description Get the filter data in a given Hook
     *
     * @tags DB Table Hook Filter
     * @name DbTableWebhookFilterRead
     * @summary Get Hook Filter
     * @request GET:/api/v1/db/meta/hooks/{hookId}/filters
     * @response `200` `FilterListType`
     */
    dbTableWebhookFilterRead: (hookId: string, params: RequestParams = {}) =>
      this.request<FilterListType, any>({
        path: `/api/v1/db/meta/hooks/${hookId}/filters`,
        method: 'GET',
        ...params,
      }),

    /**
     * @description Create filter(s) in a given Hook
     *
     * @tags DB Table Hook Filter
     * @name DbTableWebhookFilterCreate
     * @summary Create Hook Filter
     * @request POST:/api/v1/db/meta/hooks/{hookId}/filters
     * @response `200` `void` OK
     */
    dbTableWebhookFilterCreate: (
      hookId: string,
      data: FilterReqType,
      params: RequestParams = {}
    ) =>
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
     * @description List all table rows in a given table and project
     *
     * @tags DB Table Row
     * @name List
     * @summary List Table Rows
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}
     * @response `200` `any` OK
     */
    list: (
      orgs: string,
      projectName: string,
      tableName: string,
      query?: {
        fields?: any[];
        sort?: string[] | string;
        where?: string;
        /**
         * Offset in rows
         * @min 0
         */
        offset?: number;
        /**
         * Limit in rows
         * @min 1
         */
        limit?: number;
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
     * @description Create a new row in a given table and project.
     *
     * @tags DB Table Row
     * @name Create
     * @summary Create Table Row
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
     * @description Return the first result of the target Table Row
     *
     * @tags DB Table Row
     * @name FindOne
     * @summary Find One Table Row
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
     * @description Get the result grouped by the given query
     *
     * @tags DB Table Row
     * @name GroupBy
     * @summary Group By Table Row
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
        /** @min 1 */
        limit?: number;
        /** @min 0 */
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
     * @description Get the grouped data By Column ID. Used in Kanban View.
     *
     * @tags DB Table Row
     * @name GroupedDataList
     * @summary Table Group by Column
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      orgs: string,
      projectName: string,
      tableName: string,
      columnId: IdType,
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
     * @description Get the Table Row
     *
     * @tags DB Table Row
     * @name Read
     * @summary Get Table Row
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the Table Row
     *
     * @tags DB Table Row
     * @name Update
     * @summary Update Table Row
     * @request PATCH:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
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
     * @description Delete the Table Row
     *
     * @tags DB Table Row
     * @name Delete
     * @summary Delete Table Row
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
     * @response `200` `any` OK
     */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
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
     * @tags DB Table Row
     * @name Exist
     * @summary Does Table Row Exist
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/exist
     * @response `201` `any` Created
     */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/${rowId}/exist`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Bulk insert table rows in one go.
     *
     * @tags DB Table Row
     * @name BulkCreate
     * @summary Bulk Insert Table Rows
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
     * @description Bulk Update Table Rows by given IDs
     *
     * @tags DB Table Row
     * @name BulkUpdate
     * @summary Bulk Update Table Rows by IDs
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
     * @description Bulk Delete Table Rows by given IDs
     *
     * @tags DB Table Row
     * @name BulkDelete
     * @summary Bulk Delete Table Rows by IDs
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
     * @description Bulk Update all Table Rows if the condition is true
     *
     * @tags DB Table Row
     * @name BulkUpdateAll
     * @summary Bulk Update Table Rows with Conditions
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
     * @description Bulk Delete all Table Rows if the condition is true
     *
     * @tags DB Table Row
     * @name BulkDeleteAll
     * @summary Bulk Delete Table Rows with Conditions
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
     * @description Export Table View Rows by CSV or Excel
     *
     * @tags DB Table Row
     * @name CsvExport
     * @summary Export Table View Rows
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
        ...params,
      }),

    /**
     * @description List all nested relations rows
     *
     * @tags DB Table Row
     * @name NestedList
     * @summary List Nested Relations Rows
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}
     * @response `200` `any` OK
     */
    nestedList: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description Create a new nested relations row
     *
     * @tags DB Table Row
     * @name NestedAdd
     * @summary Create Nested Relations Row
     * @request POST:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
     * @response `200` `any` OK
     */
    nestedAdd: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      refRowId: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description Delete a new nested relations row
     *
     * @tags DB Table Row
     * @name NestedRemove
     * @summary Delete Nested Relations Row
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
     * @response `200` `any` OK
     */
    nestedRemove: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
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
     * @description Get the table rows but exculding the current record's children and parent
     *
     * @tags DB Table Row
     * @name NestedChildrenExcludedList
     * @summary Referenced Table Rows Excluding Current Record's Children / Parent
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude
     * @response `200` `any` OK
     */
    nestedChildrenExcludedList: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description Get the grouped data By Column ID. Used in Kanban View.
     *
     * @tags DB View Row
     * @name GroupedDataList
     * @summary Table Group by Column
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      orgs: IdType,
      projectName: string,
      tableName: string,
      viewName: string,
      columnId: IdType,
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
     * @description List all table view rows
     *
     * @tags DB View Row
     * @name List
     * @summary List Table View Rows
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
        offset?: number;
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
     * @description Create a new row in the given Table View
     *
     * @tags DB View Row
     * @name Create
     * @summary Create Table View Row
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
     * @description Return the first result of table view rows with the given query
     *
     * @tags DB View Row
     * @name FindOne
     * @summary Find One Table View Row
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
     * @description Get the table view rows groupe by the given query
     *
     * @tags DB View Row
     * @name GroupBy
     * @summary Group By Table View Row
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
        /** @min 1 */
        limit?: number;
        /** @min 0 */
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
     * @description Count how many rows in the given Table View
     *
     * @tags DB View Row
     * @name Count
     * @summary Count Table View Rows
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
     * @description Get the target Table View Row
     *
     * @tags DB View Row
     * @name Read
     * @summary Get Table View Row
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `201` `any` Created
     */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the target Table View Row
     *
     * @tags DB View Row
     * @name Update
     * @summary Update Table View Row
     * @request PATCH:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `200` `any` OK
     */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
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
     * @description Delete the target Table View Row
     *
     * @tags DB View Row
     * @name Delete
     * @summary Delete Table View Row
     * @request DELETE:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}
     * @response `200` `void` OK
     */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Check row with provided primary key exists or not
     *
     * @tags DB View Row
     * @name Exist
     * @summary Does Table View Row Exist
     * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}/exist
     * @response `201` `any` Created
     */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}/exist`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Export Table View Rows by CSV or Excel
     *
     * @tags DB View Row
     * @name Export
     * @summary Export Table View Rows
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
        ...params,
      }),
  };
  public = {
    /**
     * @description List Shared View Grouped Data
     *
     * @tags Public
     * @name GroupedDataList
     * @summary List Shared View Grouped Data
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/group/{columnId}
     * @response `200` `any` OK
     */
    groupedDataList: (
      sharedViewUuid: string,
      columnId: IdType,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description List all shared view rows
     *
     * @tags Public
     * @name DataList
     * @summary List Shared View Rows
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/rows
     * @response `200` `any` OK
     */
    dataList: (
      sharedViewUuid: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description Create a new row for the target shared view
     *
     * @tags Public
     * @name DataCreate
     * @summary Create Share View Row
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
     * @description List all nested list data in a given shared view
     *
     * @tags Public
     * @name DataNestedList
     * @summary List Nested List Data
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/rows/{rowId}/{relationType}/{columnName}
     * @response `200` `any` OK
     */
    dataNestedList: (
      sharedViewUuid: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
     * @description Export all rows in Share View in a CSV / Excel Format
     *
     * @tags Public
     * @name CsvExport
     * @summary Export Rows in Share View
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
        ...params,
      }),

    /**
     * @description List Nested Data Relation
     *
     * @tags Public
     * @name DataRelationList
     * @summary List Nested Data Relation
     * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/nested/{columnName}
     * @response `200` `any` OK
     */
    dataRelationList: (
      sharedViewUuid: string,
      columnName: string,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
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
 * @description Get Share Base Meta
 * 
 * @tags Public
 * @name SharedBaseGet
 * @summary Get Share Base Meta
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
 * @description Get Share View Meta
 * 
 * @tags Public
 * @name SharedViewMetaGet
 * @summary Get Share View Meta
 * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/meta
 * @response `200` `(ViewType & {
  relatedMetas?: any,
  client?: string,
  base_id?: string,
  columns?: ((GridColumnType | FormColumnType | GalleryColumnType | (GridColumnType & FormColumnType & GalleryColumnType)) & ColumnType),
  \** Model for Table *\
  model?: TableType,

} & {
  view?: (FormType | GridType | GalleryType | (FormType & GridType & GalleryType)),

})` OK
 */
    sharedViewMetaGet: (sharedViewUuid: string, params: RequestParams = {}) =>
      this.request<
        ViewType & {
          relatedMetas?: any;
          client?: string;
          base_id?: string;
          columns?: (
            | GridColumnType
            | FormColumnType
            | GalleryColumnType
            | (GridColumnType & FormColumnType & GalleryColumnType)
          ) &
            ColumnType;
          /** Model for Table */
          model?: TableType;
        } & {
          view?:
            | FormType
            | GridType
            | GalleryType
            | (FormType & GridType & GalleryType);
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
     * @description List all comments
     *
     * @tags Utils
     * @name CommentList
     * @summary List Comments in Audit
     * @request GET:/api/v1/db/meta/audits/comments
     * @response `201` `any` Created
     */
    commentList: (
      query: {
        row_id: string;
        /** Model for ID */
        fk_model_id: IdType;
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
     * @description Create a new comment for Audit
     *
     * @tags Utils
     * @name CommentRow
     * @request POST:/api/v1/db/meta/audits/comments
     * @response `200` `void` OK
     */
    commentRow: (data: CommentReqType, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/audits/comments`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Return the number of comments in the given query.
     *
     * @tags Utils
     * @name CommentCount
     * @summary Count Comments
     * @request GET:/api/v1/db/meta/audits/comments/count
     * @response `201` `any` Created
     */
    commentCount: (
      query: {
        ids: any;
        /** Model for ID */
        fk_model_id: IdType;
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
     * @description Update Audit Row
     *
     * @tags Utils
     * @name AuditRowUpdate
     * @summary Update Audit Row
     * @request POST:/api/v1/db/meta/audits/rows/{rowId}/update
     * @response `200` `void` OK
     */
    auditRowUpdate: (
      rowId: any,
      data: AuditRowUpdateReqType,
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
 * @description Test the DB Connection
 * 
 * @tags Utils
 * @name TestConnection
 * @summary Test DB Connection
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
     * @description Extract XC URL From JDBC and parse to connection config
     *
     * @tags Utils
     * @name UrlToConfig
     * @summary Convert JDBC URL to Config
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
     * @description Get the application info such as authType, defaultLimit, version and etc.
     *
     * @tags Utils
     * @name AppInfo
     * @summary Get App Info
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
     * @summary Axios Request
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
     * @description Get the application version
     *
     * @tags Utils
     * @name AppVersion
     * @summary Get App Version
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
     * @description Get Application Health Status
     *
     * @tags Utils
     * @name AppHealth
     * @summary Get Application Health Status
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
 * @description Get Aggregated Meta Info such as tableCount, dbViewCount, viewCount and etc.
 * 
 * @tags Utils
 * @name AggregatedMetaInfo
 * @summary Get Aggregated Meta Info
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
     * @summary Get Cache
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
     * @summary Delete Cache
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
 * @description List all hook records in the given Table
 * 
 * @tags DB Table Webhook
 * @name List
 * @summary List Table Hooks
 * @request GET:/api/v1/db/meta/tables/{tableId}/hooks
 * @response `200` `{
  list: (HookType)[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

}` OK
 */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          list: HookType[];
          /** Model for Paginated */
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
     * @description Create a hook in the given table
     *
     * @tags DB Table Webhook
     * @name Create
     * @summary Create Table Hook
     * @request POST:/api/v1/db/meta/tables/{tableId}/hooks
     * @response `200` `AuditType` OK
     */
    create: (tableId: IdType, data: AuditType, params: RequestParams = {}) =>
      this.request<AuditType, any>({
        path: `/api/v1/db/meta/tables/${tableId}/hooks`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Test the hook in the given Table
     *
     * @tags DB Table Webhook
     * @name Test
     * @summary Test Hook
     * @request POST:/api/v1/db/meta/tables/{tableId}/hooks/test
     * @response `200` `any` OK
     */
    test: (
      tableId: IdType,
      data: HookTestReqType,
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
 * @description Get the sample hook payload
 * 
 * @tags DB Table Webhook
 * @name SamplePayloadGet
 * @summary Get Sample Hook Payload
 * @request GET:/api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{operation}
 * @response `200` `{
  plugins?: {
  list: (PluginType)[],
  \** Model for Paginated *\
  pageInfo: PaginatedType,

},

}` OK
 */
    samplePayloadGet: (
      tableId: IdType,
      operation: 'update' | 'delete' | 'insert',
      params: RequestParams = {}
    ) =>
      this.request<
        {
          plugins?: {
            list: PluginType[];
            /** Model for Paginated */
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
     * @description Update the exsiting hook by its ID
     *
     * @tags DB Table Webhook
     * @name Update
     * @summary Update Hook
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
     * @description Delete the exsiting hook by its ID
     *
     * @tags DB Table Webhook
     * @name Delete
     * @summary Delete Hook
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
  plugin = {
    /**
 * @description List all plugins
 * 
 * @tags Plugin
 * @name List
 * @summary List Plugins
 * @request GET:/api/v1/db/meta/plugins
 * @response `200` `{
  list?: (PluginType)[],
  \** Model for Paginated *\
  pageInfo?: PaginatedType,

}` OK
 */
    list: (params: RequestParams = {}) =>
      this.request<
        {
          list?: PluginType[];
          /** Model for Paginated */
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
     * @summary Get Plugin Status
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
     * @description Test if the plugin is working with the given configurations
     *
     * @tags Plugin
     * @name Test
     * @summary Test Plugin
     * @request POST:/api/v1/db/meta/plugins/test
     * @response `200` `any` OK
     * @response `400` `void` Bad Request
     * @response `401` `void` Unauthorized
     */
    test: (data: PluginTestReqType, params: RequestParams = {}) =>
      this.request<any, void>({
        path: `/api/v1/db/meta/plugins/test`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the plugin data by ID
     *
     * @tags Plugin
     * @name Update
     * @summary Update Plugin
     * @request PATCH:/api/v1/db/meta/plugins/{pluginId}
     * @response `200` `any` OK
     */
    update: (
      pluginId: string,
      data: PluginReqType,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/meta/plugins/${pluginId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get the plugin data by ID
     *
     * @tags Plugin
     * @name Read
     * @summary Get Plugin
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
 * @description List API Tokens in the given project
 * 
 * @tags API Token
 * @name List
 * @summary List API Tokens in Project
 * @request GET:/api/v1/db/meta/projects/{projectId}/api-tokens
 * @response `200` `{
  \** List of API Token Models *\
  list: (ApiTokenType)[],
  \** Pagination Info *\
  pageInfo: PaginatedType,

}` OK
 */
    list: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /** List of API Token Models */
          list: ApiTokenType[];
          /** Pagination Info */
          pageInfo: PaginatedType;
        },
        any
      >({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create API Token in a project
     *
     * @tags API Token
     * @name Create
     * @summary Create API Token
     * @request POST:/api/v1/db/meta/projects/{projectId}/api-tokens
     * @response `200` `void` OK
     * @response `201` `any` Created
     */
    create: (
      projectId: IdType,
      data: ApiTokenReqType,
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
     * @description Delete the given API Token in project
     *
     * @tags API Token
     * @name Delete
     * @summary Delete API Token
     * @request DELETE:/api/v1/db/meta/projects/{projectId}/api-tokens/{token}
     * @response `200` `void` OK
     */
    delete: (projectId: IdType, token: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens/${token}`,
        method: 'DELETE',
        ...params,
      }),
  };
  storage = {
    /**
     * @description Upload attachment
     *
     * @tags Storage
     * @name Upload
     * @summary Attachment Upload
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
     * @description Upload attachment by URL. Used in Airtable Migration.
     *
     * @tags Storage
     * @name UploadByUrl
     * @summary Attachment Upload by URL
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
}
