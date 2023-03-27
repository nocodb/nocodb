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
 * Model for API Token
 */
export interface ApiTokenType {
  /** Unique API Token ID */
  id?: IdType;
  /** Foreign Key to User */
  fk_user_id?: IdType;
  /**
   * API Token Description
   * @example This API Token is for ABC application
   */
  description?: string;
  /**
   * API Token
   * @example DYh540o8hbWpUGdarekECKLdN5OhlgCUWutVJYX2
   */
  token?: string;
}

/**
 * Model for API Token Request
 */
export interface ApiTokenReqType {
  /**
   * Description of the API token
   * @example This API Token is for ABC application
   */
  description?: string;
}

/**
 * Model for API Token List
 */
export interface ApiTokenListType {
  /**
   * List of api token objects
   * @example [{"list":[{"id":"1","fk_user_id":"us_b3xo2i44nx5y9l","description":"This API Token is for ABC application","token":"DYh540o8hbWpUGdarekECKLdN5OhlgCUWutVJYX2"}],"pageInfo":{"isFirstPage":true,"isLastPage":true,"page":1,"pageSize":10,"totalRows":1}}]
   */
  list: ApiTokenType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Attachment
 */
export interface AttachmentType {
  /** Data for uploading */
  data?: any;
  /** The mimetype of the attachment */
  mimetype?: string;
  /** File Path */
  path?: string;
  /** Attachment Size */
  size?: number;
  /** The title of the attachment. Used in UI. */
  title?: string;
  /** Attachment URL */
  url?: string;
}

/**
 * Model for Attachment Request
 */
export interface AttachmentReqType {
  /** The mimetype of the attachment */
  mimetype?: string;
  /** The file path of the attachment */
  path?: string;
  /** The size of the attachment */
  size?: number;
  /** The title of the attachment used in UI */
  title?: string;
  /** Attachment URL to be uploaded via upload-by-url */
  url?: string;
}

/**
 * Model for Audit
 */
export interface AuditType {
  /** Unique ID */
  id?: IdType;
  /**
   * The user name performing the action
   * @example w@nocodb.com
   */
  user?: string;
  /**
   * IP address from the user
   * @example ::ffff:127.0.0.1
   */
  ip?: string;
  /**
   * Base ID in where action is performed
   * @example ds_3l9qx8xqksenrl
   */
  base_id?: string;
  /**
   * Project ID in where action is performed
   * @example p_9sx43moxhqtjm3
   */
  project_id?: string;
  /**
   * Model ID in where action is performed
   * @example md_ehn5izr99m7d45
   */
  fk_model_id?: string;
  /**
   * Row ID
   * @example rec0Adp9PMG9o7uJy
   */
  row_id?: string;
  /**
   * Operation Type
   * @example AUTHENTICATION
   */
  op_type?:
    | 'COMMENT'
    | 'DATA'
    | 'PROJECT'
    | 'VIRTUAL_RELATION'
    | 'RELATION'
    | 'TABLE_VIEW'
    | 'TABLE'
    | 'VIEW'
    | 'META'
    | 'WEBHOOKS'
    | 'AUTHENTICATION'
    | 'TABLE_COLUMN'
    | 'ORG_USER';
  /**
   * Operation Sub Type
   * @example UPDATE
   */
  op_sub_type?:
    | 'UPDATE'
    | 'INSERT'
    | 'BULK_INSERT'
    | 'BULK_UPDATE'
    | 'BULK_DELETE'
    | 'LINK_RECORD'
    | 'UNLINK_RECORD'
    | 'DELETE'
    | 'CREATED'
    | 'DELETED'
    | 'RENAMED'
    | 'IMPORT_FROM_ZIP'
    | 'EXPORT_TO_FS'
    | 'EXPORT_TO_ZIP'
    | 'UPDATED'
    | 'SIGNIN'
    | 'SIGNUP'
    | 'PASSWORD_RESET'
    | 'PASSWORD_FORGOT'
    | 'PASSWORD_CHANGE'
    | 'EMAIL_VERIFICATION'
    | 'ROLES_MANAGEMENT'
    | 'INVITE'
    | 'RESEND_INVITE';
  /** Audit Status */
  status?: string;
  /**
   * Description of the action
   * @example Table nc_snms___Table_1 : field Date got changed from  2023-03-12 to
   */
  description?: string;
  /**
   * Detail
   * @example <span class="">Date</span>   : <span class="text-decoration-line-through red px-2 lighten-4 black--text">2023-03-12</span>   <span class="black--text green lighten-4 px-2"></span>
   */
  details?: string;
}

/**
 * Model for Audit Row Update Request
 */
export interface AuditRowUpdateReqType {
  /**
   * Column Name
   * @example baz
   */
  column_name?: string;
  /**
   * Foreign Key to Model
   * @example md_ehn5izr99m7d45
   */
  fk_model_id?: string;
  /**
   * Row ID
   * @example rec0Adp9PMG9o7uJy
   */
  row_id?: string;
  /** The previous value before the action */
  prev_value?: any;
  /** The current value after the action */
  value?: any;
}

/**
 * Model for Base
 */
export interface BaseType {
  /** Base Name - Default BASE will be null by default */
  alias?: StringOrNullType;
  /** Base Configuration */
  config?: any;
  /** Is this base enabled */
  enabled?: BoolType;
  /** Unique Base ID */
  id?: string;
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
  /** Is the data source connected externally */
  is_meta?: BoolType;
  /**
   * The order of the list of bases
   * @example 1
   */
  order?: number;
  /** The project ID that this base belongs to */
  project_id?: string;
  /**
   * DB Type
   * @example mysql2
   */
  type?:
    | 'mssql'
    | 'mysql'
    | 'mysql2'
    | 'oracledb'
    | 'pg'
    | 'snowflake'
    | 'sqlite3';
}

/**
 * Model for Base List
 */
export interface BaseListType {
  /** List of base objects */
  list: BaseType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
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
  /** Is the data source connected externally */
  is_meta?: boolean;
  /** DB Type */
  type?:
    | 'mssql'
    | 'mysql'
    | 'mysql2'
    | 'oracledb'
    | 'pg'
    | 'snowflake'
    | 'sqlite3';
}

/**
 * Model for Bool
 */
export type BoolType = number | boolean | null;

/**
 * Model for Column
 */
export interface ColumnType {
  /** Is Auto-Increment? */
  ai?: BoolType;
  /** Auto Update Timestamp */
  au?: BoolType;
  /**
   * Base ID that this column belongs to
   * @example ds_krsappzu9f8vmo
   */
  base_id?: string;
  /** Column Comment */
  cc?: string;
  /** Column Default */
  cdf?: StringOrNullType;
  /** Character Maximum Length */
  clen?: number | null | string;
  /** Column Options */
  colOptions?:
    | FormulaType
    | LinkToAnotherRecordType
    | LookupType
    | RollupType
    | SelectOptionsType
    | object
    | (FormulaType &
        LinkToAnotherRecordType &
        LookupType &
        RollupType &
        SelectOptionsType &
        object);
  /**
   * Column Name
   * @example title
   */
  column_name?: string;
  /** Column Ordinal Position */
  cop?: string;
  /** Character Set Name */
  csn?: StringOrNullType;
  /**
   * Column Type
   * @example varchar(45)
   */
  ct?: string;
  /** Is Deleted? */
  deleted?: BoolType;
  /**
   * Data Type in DB
   * @example varchar
   */
  dt?: string;
  /**
   * Data Type X
   * @example specificType
   */
  dtx?: string;
  /** Data Type X Precision */
  dtxp?: null | number | string;
  /** Data Type X Scale */
  dtxs?: null | number | string;
  /**
   * Model ID that this column belongs to
   * @example md_yvwvbt2i78rgcm
   */
  fk_model_id?: string;
  /** Unique ID */
  id?: IdType;
  /** Meta Info */
  meta?: MetaType;
  /** Numeric Precision */
  np?: number | null | string;
  /** Numeric Scale */
  ns?: number | null | string;
  /** The order of the list of columns */
  order?: number;
  /** Is Primary Key? */
  pk?: BoolType;
  /** Is Primary Value? */
  pv?: BoolType;
  /** Is Required? */
  rqd?: BoolType;
  /** Is System Column? */
  system?: BoolType;
  /**
   * Column Title
   * @example Title
   */
  title?: string;
  /**
   * The data type in UI
   * @example SingleLineText
   */
  uidt?:
    | 'Attachment'
    | 'AutoNumber'
    | 'Barcode'
    | 'Button'
    | 'Checkbox'
    | 'Collaborator'
    | 'Count'
    | 'CreateTime'
    | 'Currency'
    | 'Date'
    | 'DateTime'
    | 'Decimal'
    | 'Duration'
    | 'Email'
    | 'Formula'
    | 'ForeignKey'
    | 'GeoData'
    | 'Geometry'
    | 'ID'
    | 'JSON'
    | 'LastModifiedTime'
    | 'LongText'
    | 'LinkToAnotherRecord'
    | 'Lookup'
    | 'MultiSelect'
    | 'Number'
    | 'Percent'
    | 'PhoneNumber'
    | 'Rating'
    | 'Rollup'
    | 'SingleLineText'
    | 'SingleSelect'
    | 'SpecificDBType'
    | 'Time'
    | 'URL'
    | 'Year'
    | 'QrCode';
  /** Is Unsigned? */
  un?: BoolType;
  /** Is unique? */
  unique?: BoolType;
  /** Is Visible? */
  visible?: BoolType;
}

/**
 * Model for Column List
 */
export interface ColumnListType {
  /** List of column objects */
  list: ColumnType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Column Request
 */
export type ColumnReqType = (
  | FormulaColumnReqType
  | LinkToAnotherColumnReqType
  | LookupColumnReqType
  | NormalColumnRequestType
  | RollupColumnReqType
  | (FormulaColumnReqType &
      LinkToAnotherColumnReqType &
      LookupColumnReqType &
      NormalColumnRequestType &
      RollupColumnReqType)
) & {
  column_name?: string;
  /** Column order in a specific view */
  column_order?: {
    order?: number;
    view_id?: string;
  };
  title: string;
};

/**
 * Model for Comment Request
 */
export interface CommentReqType {
  /**
   * Description for the target row
   * @example This is the comment for the row
   */
  description?: string;
  /**
   * Foreign Key to Model
   * @example md_ehn5izr99m7d45
   */
  fk_model_id: string;
  /**
   * Row ID
   * @example 3
   */
  row_id: string;
}

/**
 * Model for Comment Update Request
 */
export interface CommentUpdateReqType {
  /**
   * Description for the target row
   * @example This is the comment for the row
   */
  description?: string;
}

/**
 * Model for Filter
 */
export interface FilterType {
  /** Unqiue Base ID */
  base_id?: string;
  /** Children filters. Available when the filter is grouped. */
  children?: FilterType[];
  /** Comparison Operator */
  comparison_op?:
    | 'allof'
    | 'anyof'
    | 'blank'
    | 'btw'
    | 'checked'
    | 'empty'
    | 'eq'
    | 'ge'
    | 'gt'
    | 'gte'
    | 'in'
    | 'is'
    | 'isWithin'
    | 'isnot'
    | 'le'
    | 'like'
    | 'lt'
    | 'lte'
    | 'nallof'
    | 'nanyof'
    | 'nbtw'
    | 'neq'
    | 'nlike'
    | 'not'
    | 'notblank'
    | 'notchecked'
    | 'notempty'
    | 'notnull'
    | 'null';
  /** Comparison Sub-Operator */
  comparison_sub_op?:
    | 'daysAgo'
    | 'daysFromNow'
    | 'exactDate'
    | 'nextMonth'
    | 'nextNumberOfDays'
    | 'nextWeek'
    | 'nextYear'
    | 'oneMonthAgo'
    | 'oneMonthFromNow'
    | 'oneWeekAgo'
    | 'oneWeekFromNow'
    | 'pastMonth'
    | 'pastNumberOfDays'
    | 'pastWeek'
    | 'pastYear'
    | 'today'
    | 'tomorrow'
    | 'yesterday'
    | null
    | (
        | 'daysAgo'
        | 'daysFromNow'
        | 'exactDate'
        | 'nextMonth'
        | 'nextNumberOfDays'
        | 'nextWeek'
        | 'nextYear'
        | 'oneMonthAgo'
        | 'oneMonthFromNow'
        | 'oneWeekAgo'
        | 'oneWeekFromNow'
        | 'pastMonth'
        | 'pastNumberOfDays'
        | 'pastWeek'
        | 'pastYear'
        | 'today'
        | 'tomorrow'
        | ('yesterday' & null)
      );
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign Key to Hook */
  fk_hook_id?: StringOrNullType;
  /** Foreign Key to Model */
  fk_model_id?: IdType;
  /** Foreign Key to parent group. */
  fk_parent_id?: StringOrNullType;
  /** Foreign Key to View */
  fk_view_id?: StringOrNullType;
  /** Unique ID */
  id?: IdType;
  /** Is this filter grouped? */
  is_group?: boolean | number | null;
  /** Logical Operator */
  logical_op?: 'and' | 'not' | 'or';
  /** Unique Project ID */
  project_id?: string;
  /** The filter value. Can be NULL for some operators. */
  value?: any;
}

/**
 * Model for Filter List
 */
export interface FilterListType {
  /** List of filter objects */
  list: FilterType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Filter Log List
 */
export interface FilterLogListType {
  /** List of filter objects */
  list: FilterType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Filter Request
 */
export interface FilterReqType {
  /** Comparison Operator */
  comparison_op?:
    | 'allof'
    | 'anyof'
    | 'blank'
    | 'btw'
    | 'checked'
    | 'empty'
    | 'eq'
    | 'ge'
    | 'gt'
    | 'gte'
    | 'in'
    | 'is'
    | 'isWithin'
    | 'isnot'
    | 'le'
    | 'like'
    | 'lt'
    | 'lte'
    | 'nallof'
    | 'nanyof'
    | 'nbtw'
    | 'neq'
    | 'nlike'
    | 'not'
    | 'notblank'
    | 'notchecked'
    | 'notempty'
    | 'notnull'
    | 'null';
  /** Comparison Sub-Operator */
  comparison_sub_op?:
    | 'daysAgo'
    | 'daysFromNow'
    | 'exactDate'
    | 'nextMonth'
    | 'nextNumberOfDays'
    | 'nextWeek'
    | 'nextYear'
    | 'oneMonthAgo'
    | 'oneMonthFromNow'
    | 'oneWeekAgo'
    | 'oneWeekFromNow'
    | 'pastMonth'
    | 'pastNumberOfDays'
    | 'pastWeek'
    | 'pastYear'
    | 'today'
    | 'tomorrow'
    | 'yesterday'
    | null
    | (
        | 'daysAgo'
        | 'daysFromNow'
        | 'exactDate'
        | 'nextMonth'
        | 'nextNumberOfDays'
        | 'nextWeek'
        | 'nextYear'
        | 'oneMonthAgo'
        | 'oneMonthFromNow'
        | 'oneWeekAgo'
        | 'oneWeekFromNow'
        | 'pastMonth'
        | 'pastNumberOfDays'
        | 'pastWeek'
        | 'pastYear'
        | 'today'
        | 'tomorrow'
        | ('yesterday' & null)
      );
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Belong to which filter ID */
  fk_parent_id?: StringOrNullType;
  /** Is this filter grouped? */
  is_group?: BoolType;
  /** Logical Operator */
  logical_op?: 'and' | 'not' | 'or';
  /** The filter value. Can be NULL for some operators. */
  value?: any;
}

/**
 * Model for Form
 */
export interface FormType {
  /** Unique ID */
  id?: IdType;
  /** Banner Image URL. Not in use currently. */
  banner_image_url?: StringOrNullType;
  /** Form Columns */
  columns?: FormColumnType[];
  /** Email to sned after form is submitted */
  email?: StringOrNullType;
  /**
   * Foreign Key to Model
   * @example md_rsu68aqjsbyqtl
   */
  fk_model_id?: string;
  /**
   * Base ID
   * @example md_rsu68aqjsbyqtl
   */
  base_id?: string;
  /**
   * The heading of the form
   * @example My Form
   */
  heading?: string;
  /**
   * Lock Type of this view
   * @example collaborative
   */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Logo URL. Not in use currently. */
  logo_url?: StringOrNullType;
  /** Meta Info for this view */
  meta?: MetaType;
  /** The numbers of seconds to redirect after form submission */
  redirect_after_secs?: StringOrNullType;
  /** URL to redirect after submission */
  redirect_url?: StringOrNullType;
  /** Show `Blank Form` after 5 seconds */
  show_blank_form?: BoolType;
  /**
   * The subheading of the form
   * @example My Form Subheading
   */
  subheading?: string;
  /** Show `Submit Another Form` button */
  submit_another_form?: BoolType;
  /** Custom message after the form is successfully submitted */
  success_msg?: StringOrNullType;
  /**
   * Form View Title
   * @example Form View 1
   */
  title?: string;
}

/**
 * Model for Form Update Request
 */
export interface FormUpdateReqType {
  /** Banner Image URL. Not in use currently. */
  banner_image_url?: StringOrNullType;
  /** Email to sned after form is submitted */
  email?: StringOrNullType;
  /**
   * The heading of the form
   * @example My Form
   */
  heading?: string;
  /** Logo URL. Not in use currently. */
  logo_url?: StringOrNullType;
  /** Meta Info for this view */
  meta?: MetaType;
  /** The numbers of seconds to redirect after form submission */
  redirect_after_secs?: StringOrNullType;
  /** URL to redirect after submission */
  redirect_url?: StringOrNullType;
  /** Show `Blank Form` after 5 seconds */
  show_blank_form?: BoolType;
  /** The subheading of the form */
  subheading?: StringOrNullType;
  /** Show `Submit Another Form` button */
  submit_another_form?: BoolType;
  /** Custom message after the form is successfully submitted */
  success_msg?: StringOrNullType;
}

/**
 * Model for Form Column
 */
export interface FormColumnType {
  /** Unique ID */
  id?: IdType;
  /** Form Column Description (Not in use) */
  description?: StringOrNullType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /** Form Column Help Text */
  help?: StringOrNullType;
  /** Form Column Label */
  label?: StringOrNullType;
  /** Meta Info */
  meta?: MetaType;
  /**
   * The order among all the columns in the form
   * @example 1
   */
  order?: number;
  /** Is this form column required in submission? */
  required?: BoolType;
  /** Is this column shown in Form? */
  show?: BoolType;
  /**
   * Indicates whether the 'Fill by scan' button is visible for this column or not.
   * @example true
   */
  enable_scanner?: BoolType;
  /** Form Column UUID (Not in use) */
  uuid?: StringOrNullType;
}

/**
 * Model for Form Column Request
 */
export interface FormColumnReqType {
  /** Form Column Description (Not in use) */
  description?: StringOrNullType;
  /** Form Column Help Text */
  help?: StringOrNullType;
  /** Form Column Label */
  label?: StringOrNullType;
  /** Meta Info */
  meta?: MetaType;
  /** The order among all the columns in the form */
  order?: number;
  /** Is this form column required in submission? */
  required?: BoolType;
  /** Is this column shown in Form? */
  show?: BoolType;
}

/**
 * Model for Formula
 */
export interface FormulaType {
  /** Unique ID */
  id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /**
   * Formula with column ID replaced
   * @example CONCAT("FOO", {{cl_c5knoi4xs4sfpt}})
   */
  formula?: string;
  /**
   * Original Formula inputted in UI
   * @example CONCAT("FOO", {Title})
   */
  formula_raw?: string;
  /** Error Message */
  error?: string;
}

/**
 * Model for Formula Column Request
 */
export interface FormulaColumnReqType {
  /** Formula with column ID replaced */
  formula?: string;
  /** Original Formula inputted in UI */
  formula_raw?: string;
  /** Formula Title */
  title?: string;
  /** UI Data Type */
  uidt?: 'Formula';
}

/**
 * Model for Gallery
 */
export interface GalleryType {
  alias?: string;
  columns?: GalleryColumnType[];
  cover_image?: string;
  cover_image_idx?: number;
  /** Model for Bool */
  deleted?: BoolType;
  /** Foreign Key to Cover Image Column */
  fk_cover_image_col_id?: string;
  /** Foreign Key to Model */
  fk_model_id?: string;
  /** Foreign Key to View */
  fk_view_id?: string;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Model for Bool */
  next_enabled?: BoolType;
  /** Order of Gallery */
  order?: number;
  /** Model for Bool */
  prev_enabled?: BoolType;
  restrict_number?: string;
  restrict_size?: string;
  restrict_types?: string;
  title?: string;
}

/**
 * Model for Gallery Column
 */
export interface GalleryColumnType {
  fk_col_id?: string;
  fk_gallery_id?: string;
  help?: string;
  /** Unique ID */
  id?: IdType;
  label?: string;
}

/**
 * Model for Gallery View Update Request
 */
export interface GalleryUpdateReqType {
  /** The id of the column that contains the cover image */
  fk_cover_image_col_id?: StringOrNullType;
  /** Meta Info */
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
 * Model for Grid
 */
export interface GridType {
  /** Unique ID */
  id?: IdType;
  /** Project ID */
  project_id?: IdType;
  /** Base ID */
  base_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /**
   * Row Height
   * @example 1
   */
  row_height?: number;
  /** Meta info for Grid Model */
  meta?: MetaType;
  /** Grid View Columns */
  columns?: GridColumnType[];
}

/**
 * Model for Grid
 */
export interface GridCopyType {
  /** Unique ID */
  id?: IdType;
  /** Project ID */
  project_id?: IdType;
  /** Base ID */
  base_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /**
   * Row Height
   * @example 1
   */
  row_height?: number;
  /** Meta info for Grid Model */
  meta?: MetaType;
  /** Grid View Columns */
  columns?: GridColumnType[];
}

/**
 * Model for Grid Column
 */
export interface GridColumnType {
  /** Unique ID */
  id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Project ID */
  project_id?: IdType;
  /** Base ID */
  base_id?: IdType;
  /** Model for Bool */
  show?: BoolType;
  /**
   * Grid Column Order
   * @example 1
   */
  order?: number;
  /**
   * Column Width
   * @example 200px
   */
  width?: string;
  /** Column Help Text */
  help?: StringOrNullType;
}

/**
 * Model for Grid Column Request
 */
export interface GridColumnReqType {
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  help?: string;
  /**
   * The label of the column
   * @example My Column
   */
  label?: string;
  /**
   * The width of the column
   * @pattern ^[0-9]+(px|%)$
   * @example 200px
   */
  width?: string;
}

/**
 * Model for Grid View Update
 */
export interface GridUpdateReqType {
  /**
   * Row Height
   * @example 1
   */
  row_height?: number;
  /** Meta Info for grid view */
  meta?: MetaType;
}

/**
 * Model for Hook
 */
export interface HookType {
  /** Is the hook active? */
  active?: BoolType;
  /** Is the hook aysnc? */
  async?: BoolType;
  /**
   * Hook Description
   * @example This is my hook description
   */
  description?: string;
  /**
   * Environment for the hook
   * @example all
   */
  env?: string;
  /**
   * Event Type for the operation
   * @example after
   */
  event?: 'after' | 'before';
  /**
   * Foreign Key to Model
   * @example md_rsu68aqjsbyqtl
   */
  fk_model_id?: string;
  /** Unique ID */
  id?: IdType;
  /** Hook Notification including info such as type, payload, method, body, and etc */
  notification?: object | string;
  /**
   * Hook Operation
   * @example insert
   */
  operation?: 'delete' | 'insert' | 'update';
  /**
   * Retry Count
   * @example 10
   */
  retries?: number;
  /**
   * Retry Interval
   * @example 60000
   */
  retry_interval?: number;
  /**
   * Timeout
   * @example 60000
   */
  timeout?: number;
  /**
   * Hook Title
   * @example My Webhook
   */
  title?: string;
  /** Hook Type */
  type?: string;
  /**
   * Hook Version
   * @example v2
   */
  version?: 'v1' | 'v2';
}

/**
 * Model for Hook
 */
export interface HookReqType {
  /** Is the hook active? */
  active?: BoolType;
  /** Is the hook aysnc? */
  async?: BoolType;
  /** Hook Description */
  description?: StringOrNullType;
  /**
   * Environment for the hook
   * @example all
   */
  env?: string;
  /**
   * Event Type for the operation
   * @example after
   */
  event: 'after' | 'before';
  /**
   * Foreign Key to Model
   * @example md_rsu68aqjsbyqtl
   */
  fk_model_id?: string;
  /** Unique ID */
  id?: IdType;
  /** Hook Notification including info such as type, payload, method, body, and etc */
  notification: object | string;
  /**
   * Hook Operation
   * @example insert
   */
  operation: 'delete' | 'insert' | 'update';
  /**
   * Retry Count
   * @example 10
   */
  retries?: number;
  /**
   * Retry Interval
   * @example 60000
   */
  retry_interval?: number;
  /**
   * Timeout
   * @example 60000
   */
  timeout?: number;
  /**
   * Hook Title
   * @example My Webhook
   */
  title: string;
  /** Hook Type */
  type?: string | null;
  /** Is this hook assoicated with some filters */
  condition?: BoolType;
}

/**
 * Model for Hook List
 */
export interface HookListType {
  /** List of hook objects */
  list: HookType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Hook Log
 */
export interface HookLogType {
  /**
   * Unique Base ID
   * @example ds_jxuewivwbxeum2
   */
  base_id?: string;
  /** Hook Conditions */
  conditions?: string;
  /** Error */
  error?: StringOrNullType;
  /** Error Code */
  error_code?: StringOrNullType;
  /** Error Message */
  error_message?: StringOrNullType;
  /**
   * Hook Event
   * @example after
   */
  event?: 'after' | 'before';
  /**
   * Execution Time in milliseconds
   * @example 98
   */
  execution_time?: string;
  /** Foreign Key to Hook */
  fk_hook_id?: StringOrNullType;
  /** Unique ID */
  id?: StringOrNullType;
  /** Hook Notification */
  notifications?: string;
  /**
   * Hook Operation
   * @example insert
   */
  operation?: 'insert' | 'update' | 'delete';
  /**
   * Hook Payload
   * @example {"method":"POST","body":"{{ json data }}","headers":[{}],"parameters":[{}],"auth":"","path":"https://webhook.site/6eb45ce5-b611-4be1-8b96-c2965755662b"}
   */
  payload?: string;
  /**
   * Project ID
   * @example p_tbhl1hnycvhe5l
   */
  project_id?: string;
  /** Hook Response */
  response?: StringOrNullType;
  /** Is this testing hook call? */
  test_call?: BoolType;
  /** Who triggered the hook? */
  triggered_by?: StringOrNullType;
  /**
   * Hook Type
   * @example URL
   */
  type?: string;
}

/**
 * Model for Hook Log List
 */
export interface HookLogListType {
  /** List of hook objects */
  list: HookLogType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

/**
 * Model for Hook Test Request
 */
export interface HookTestReqType {
  /** Model for Hook */
  hook: HookReqType;
  /** Payload to be sent */
  payload: any;
}

/**
 * Model for ID
 */
export type IdType = string;

/**
 * Model for Kanban
 */
export interface KanbanType {
  /** Unique ID */
  id?: IdType;
  /** Grouping Field Column ID */
  fk_grp_col_id?: StringOrNullType;
  /** View ID */
  fk_view_id?: IdType;
  /** Cover Image Column ID */
  fk_cover_image_col_id?: IdType;
  /** Kanban Columns */
  columns?: KanbanColumnType[];
  /** Meta Info for Kanban */
  meta?: MetaType;
  /**
   * Kanban Title
   * @example My Kanban
   */
  title?: string;
}

/**
 * Model for Kanban Column
 */
export interface KanbanColumnType {
  /** Unique ID */
  id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /**
   * Baes ID
   *
   */
  base_id?: IdType;
  /** Project ID */
  project_id?: IdType;
  /** Project ID */
  title?: string;
  /** Is this column shown? */
  show?: BoolType;
  /**
   * Column Order
   * @example 1
   */
  order?: number;
}

/**
 * Model for Kanban Update Request
 */
export interface KanbanUpdateReqType {
  /** Foreign Key to Grouping Field Column */
  fk_grp_col_id?: StringOrNullType;
  /** Foreign Key to Cover Image Column */
  fk_cover_image_col_id?: StringOrNullType;
  /** Meta Info */
  meta?: MetaType;
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
 * Model for LinkToAnotherColumn Request
 */
export interface LinkToAnotherColumnReqType {
  /** Foreign Key to chhild column */
  childId: IdType;
  /** Foreign Key to parent column */
  parentId: IdType;
  /** The title of the virtual column */
  title: string;
  /** The type of the relationship */
  type: 'bt' | 'hm' | 'mm';
  /** Abstract type of the relationship */
  uidt: 'LinkToAnotherRecord';
  /** Is this relationship virtual? */
  virtual?: BoolType;
}

/**
 * Model for LinkToAnotherRecord
 */
export interface LinkToAnotherRecordType {
  deleted?: string;
  dr?: string;
  fk_child_column_id?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  fk_index_name?: string;
  fk_mm_child_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_parent_column_id?: string;
  fk_parent_column_id?: string;
  fk_related_model_id?: string;
  /** Unique ID */
  id?: IdType;
  order?: string;
  type?: string;
  ur?: string;
  /** Model for Bool */
  virtual?: BoolType;
}

/**
 * Model for Lookup
 */
export interface LookupType {
  /** Unique ID */
  id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign Key to Lookup Column */
  fk_lookup_column_id?: IdType;
  /** Foreign Key to Relation Column */
  fk_relation_column_id?: IdType;
  /**
   * The order among the list
   * @example 1
   */
  order?: number;
}

/**
 * Model for Lookup Column Request
 */
export interface LookupColumnReqType {
  /** Foreign Key to Lookup Column */
  fk_lookup_column_id?: IdType;
  /** Foreign Key to Relation Column */
  fk_relation_column_id?: IdType;
  /**
   * Lookup Title
   * @example My Lookup
   */
  title?: string;
  /** UI DataType */
  uidt?: 'Lookup';
}

/**
 * Model for Map
 */
export interface MapType {
  /**
   * The ID of the base that this view belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  base_id?: string;
  /** Columns in this view */
  columns?: MapColumnType[];
  /**
   * Foreign Key to GeoData Column
   * @example cl_8iw2o4ejzvdyna
   */
  fk_geo_data_col_id?: string;
  /**
   * Unique ID for Map
   * @example vw_qjt7klod1p9kyv
   */
  fk_view_id?: string;
  /** Meta data for this view */
  meta?: MetaType;
  /** The order of the map list */
  order?: number;
  /**
   * The ID of the project that this view belongs to
   * @example p_xm3thidrblw4n7
   */
  project_id?: string;
  /** To show this Map or not */
  show?: boolean;
  /**
   * Title of Map View
   * @example My Map
   */
  title?: string;
}

/**
 * Model for Map
 */
export interface MapUpdateReqType {
  /**
   * Foreign Key to GeoData Column
   * @example cl_8iw2o4ejzvdyna
   */
  fk_geo_data_col_id?: string;
  /** Meta data for this view */
  meta?: MetaType;
}

/**
 * Model for Map Column
 */
export interface MapColumnType {
  /**
   * The ID of the base that this map column belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  base_id?: string;
  /**
   * Foreign Key to Column
   * @example cl_8iw2o4ejzvdyna
   */
  fk_column_id?: string;
  /**
   * Foreign Key to View
   * @example vw_qjt7klod1p9kyv
   */
  fk_view_id?: string;
  /**
   * Unique ID of Map Column
   * @example nc_46xcacqn4rc9xf
   */
  id?: string;
  /**
   * the order in the list of map columns
   * @example 1
   */
  order?: number;
  /**
   * The ID of the project that this map column belongs to
   * @example p_xm3thidrblw4n7
   */
  project_id?: string;
  /**
   * Whether to show this column or not
   * @example 1
   */
  show?: number;
}

/**
 * Model for Meta
 */
export type MetaType = null | object | string;

/**
 * Model for ModelRoleVisibility
 */
export interface ModelRoleVisibilityType {
  base_id?: string;
  /** Model for Bool */
  disabled?: BoolType;
  fk_model_id?: string;
  fk_view_id?: string;
  /** Unique ID */
  id?: IdType;
  project_id?: string;
  role?: string;
}

/**
 * Model for Normal Column Request
 */
export interface NormalColumnRequestType {
  /** Is this column auto-incremented? */
  ai?: BoolType;
  /** Is this column auto-updated datetime field? */
  au?: BoolType;
  /** Column Comment */
  cc?: StringOrNullType;
  /** Column Default Value */
  cdf?: StringOrNullType;
  /** Column Name */
  column_name: string;
  /** Model for StringOrNull */
  csn?: StringOrNullType;
  /** Data Type */
  dt?: string;
  /** Data Type Extra */
  dtx?: StringOrNullType;
  /** Data Type Extra Precision */
  dtxp?: StringOrNullType | number;
  /** Data Type Extra Scale */
  dtxs?: StringOrNullType | number;
  /** Numeric Precision */
  np?: StringOrNullType | number;
  /** Numeric Scale */
  ns?: StringOrNullType | number;
  /** Is this column a primary key? */
  pk?: BoolType;
  /** Is this column a primary value? */
  pv?: BoolType;
  /** Is this column required? */
  rqd?: BoolType;
  /** Column Title */
  title?: string;
  /** UI Data Type */
  uidt?:
    | 'Attachment'
    | 'AutoNumber'
    | 'Barcode'
    | 'Button'
    | 'Checkbox'
    | 'Collaborator'
    | 'Count'
    | 'CreateTime'
    | 'Currency'
    | 'Date'
    | 'DateTime'
    | 'Decimal'
    | 'Duration'
    | 'Email'
    | 'Formula'
    | 'ForeignKey'
    | 'GeoData'
    | 'Geometry'
    | 'ID'
    | 'JSON'
    | 'LastModifiedTime'
    | 'LongText'
    | 'LinkToAnotherRecord'
    | 'Lookup'
    | 'MultiSelect'
    | 'Number'
    | 'Percent'
    | 'PhoneNumber'
    | 'Rating'
    | 'Rollup'
    | 'SingleLineText'
    | 'SingleSelect'
    | 'SpecificDBType'
    | 'Time'
    | 'URL'
    | 'Year'
    | 'QrCode';
  /** Is this column unique? */
  un?: BoolType;
  /** Is this column unique? */
  unique?: BoolType;
}

/**
 * Model for Organisation User Update Request
 */
export interface OrgUserReqType {
  /** @format email */
  email?: string;
  /** Roles for the project user */
  roles?: 'org-level-creator' | 'org-level-viewer';
}

/**
 * Model for Paginated
 */
export interface PaginatedType {
  /** Is the current page the first page */
  isFirstPage?: boolean;
  /** Is the current page the last page */
  isLastPage?: boolean;
  /**
   * The current page
   * @example 1
   */
  page?: number;
  /**
   * The number of pages
   * @example 10
   */
  pageSize?: number;
  /**
   * The number of rows in the given result
   * @example 1
   */
  totalRows?: number;
}

/**
 * Model for Password
 * @example password123456789
 */
export type PasswordType = string;

/**
 * Model for Password Change Request
 */
export interface PasswordChangeReqType {
  currentPassword: string;
  newPassword: string;
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
 * Model for Plugin
 */
export interface PluginType {
  /** Is plguin active? */
  active?: BoolType;
  /**
   * Plugin Category
   * @example Storage
   */
  category?: string;
  /** Plugin Creator (Not in use) */
  creator?: string;
  /** Plugin Creator website (Not in use) */
  creator_website?: string;
  /**
   * Plugin Description
   * @example Amazon Simple Storage Service (Amazon S3) is an object storage service that offers industry-leading scalability, data availability, security, and performance.
   */
  description?: string;
  /** Documentation of plugin (Not in use) */
  docs?: string;
  /** Plugin Icon (Not in use) */
  icon?: string;
  /** Unique ID */
  id?: IdType;
  /** Plugin Input */
  input?: StringOrNullType | number;
  /**
   * Plugin Input Schema
   *
   */
  input_schema?: string;
  /**
   * Plugin logo
   * @example plugins/s3.png
   */
  logo?: string;
  /** Plugin Price (Not in use) */
  price?: string;
  /** Plugin Rating (Not in use) */
  rating?: number;
  /**
   * Plugin Status
   * @example install
   */
  status?: string;
  /** Not in use */
  status_details?: string;
  /**
   * Plugin tags
   * @example Storage
   */
  tags?: string;
  /** Plugin Title */
  title?: string;
  /**
   * Plugin Version
   * @example 0.0.1
   */
  version?: string;
}

/**
 * Model for Plugin Request
 */
export interface PluginReqType {
  /** Is Plugin Active? */
  active?: BoolType;
  /** Plugin Input */
  input?: StringOrNullType;
}

/**
 * Model for Plugin Test Request
 */
export interface PluginTestReqType {
  /** Plugin Title */
  title: string;
  /** Plugin Input as JSON string */
  input: string | object;
  /** @example Email */
  category: string;
}

/**
 * Model for Project
 */
export interface ProjectType {
  /** List of base models */
  bases?: BaseType[];
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Is the project deleted */
  deleted?: BoolType;
  /**
   * Project Description
   * @example This is my project description
   */
  description?: string;
  /**
   * Unique Project ID
   * @example p_124hhlkbeasewh
   */
  id?: string;
  /** Model for Bool */
  is_meta?: BoolType;
  /** Meta Info such as theme colors */
  meta?: MetaType;
  /** The order in project list */
  order?: number;
  /**
   * Project prefix. Used in XCDB only.
   * @example nc_vm5q__
   */
  prefix?: string;
  status?: string;
  /**
   * Project Title
   * @example my-project
   */
  title?: string;
}

/**
 * Model for Project List
 */
export interface ProjectListType {
  /** List of Project Models */
  list: ProjectType[];
  /** Pagination Info */
  pageInfo: PaginatedType;
}

/**
 * Model for Project Request
 */
export interface ProjectReqType {
  /** Array of Bases */
  bases?: BaseReqType[];
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /**
   * Project Description
   * @example This is my project description
   */
  description?: string;
  /**
   * Project Title
   * @example My Project
   */
  title: string;
}

/**
 * Model for Project Update Request
 */
export interface ProjectUpdateReqType {
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Project Meta */
  meta?: MetaType;
  /**
   * Project Title
   * @example My Project
   */
  title?: string;
}

/**
 * Model for Project User Request
 */
export interface ProjectUserReqType {
  /**
   * Project User Email
   * @format email
   */
  email: string;
  /** Project User Role */
  roles: 'commenter' | 'editor' | 'guest' | 'owner' | 'viewer' | 'creator';
}

/**
 * Model for Rollup
 */
export interface RollupType {
  /** Unique ID */
  id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign to Relation Column */
  fk_relation_column_id?: IdType;
  /** Foreign to Rollup Column */
  fk_rollup_column_id?: IdType;
  /**
   * Rollup Function
   * @example count
   */
  rollup_function?:
    | 'count'
    | 'min'
    | 'max'
    | 'avg'
    | 'countDistinct'
    | 'sumDistinct'
    | 'avgDistinct';
}

/**
 * Model for Rollup Column Request
 */
export interface RollupColumnReqType {
  /** Foreign Key to Relation Column */
  fk_relation_column_id?: IdType;
  /** Foreign Key to Rollup Column */
  fk_rollup_column_id?: IdType;
  /** Rollup Column Title */
  title?: string;
  /** Rollup Function */
  rollup_function?:
    | 'avg'
    | 'avgDistinct'
    | 'count'
    | 'countDistinct'
    | 'max'
    | 'min'
    | 'sum'
    | 'sumDistinct';
  /** UI DataType */
  uidt?: 'Rollup';
}

/**
 * Model for SelectOption
 */
export interface SelectOptionType {
  /** Unique ID */
  id?: IdType;
  /**
   * Option Title
   *
   * @example Option A
   */
  title?: string;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /**
   * Option Color
   * @example #cfdffe
   */
  color?: string;
  /**
   * The order among the options
   * @example 1
   */
  order?: number;
}

/**
 * Model for SelectOptions
 */
export interface SelectOptionsType {
  /** Array of select options */
  options: SelectOptionType[];
}

/**
 * Model for Shared Base Request
 */
export interface SharedBaseReqType {
  /**
   * Password to protect the base
   * @example password123
   */
  password?: string;
  /**
   * The role given the target user
   * @example editor
   */
  roles?: 'commenter' | 'editor' | 'viewer';
}

/**
 * Model for Shared View
 */
export type SharedViewType = ViewType;

/**
 * Model for Shared View List
 */
export interface SharedViewListType {
  /** List of shared view objects */
  list: SharedViewType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
}

/**
 * Model for Shared View Request
 */
export interface SharedViewReqType {
  /** Meta data passing to Shared View such as if download is allowed or not. */
  meta?: MetaType;
  /** Password to restrict access */
  password?: StringOrNullType;
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
  /** Model for StringOrNull */
  firstname?: StringOrNullType;
  /** Model for StringOrNull */
  lastname?: StringOrNullType;
  /** Sign Up Token. Used for invitation. */
  token?: StringOrNullType;
  /** Ignore Subscription */
  ignore_subscribe?: BoolType;
}

/**
 * Model for Sort
 */
export interface SortType {
  /** Unique ID */
  id?: IdType;
  /** Model for ID */
  fk_column_id?: IdType;
  /** Model for ID */
  fk_model_id?: IdType;
  /**
   * Base ID
   * @example ds_3l9qx8xqksenrl
   */
  base_id?: string;
  /**
   * Sort direction
   * @example desc
   */
  direction?: 'asc' | 'desc';
  /** @example 1 */
  order?: number;
  /**
   * Project ID
   * @example p_9sx43moxhqtjm3
   */
  project_id?: string;
}

/**
 * Model for Sort List
 */
export interface SortListType {
  /** List of Sort Objects */
  list: SortType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
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
 * Model for StringOrNull
 */
export type StringOrNullType = string | null;

/**
 * Model for Table
 */
export interface TableType {
  /** Unique Base ID */
  base_id?: string;
  /** The columns included in this table */
  columns?: ColumnType[];
  /** Column Models grouped by IDs */
  columnsById?: object;
  /** Model for Bool */
  deleted?: BoolType;
  /** Is this table enabled? */
  enabled?: BoolType;
  /** Unique Table ID */
  id?: string;
  /** Meta Data */
  meta?: MetaType;
  /** Is this table used for M2M */
  mm?: BoolType;
  /** The order of the list of tables */
  order?: number;
  /** Currently not in use */
  pinned?: BoolType;
  /** Unique Project ID */
  project_id?: string;
  /** Table Name. Prefix will be added for XCDB projects. */
  table_name: string;
  /** Currently not in use */
  tags?: StringOrNullType;
  /** Table Title */
  title: string;
  /** Table Type */
  type?: string;
}

/**
 * Model for Table List
 */
export interface TableListType {
  /** List of table objects */
  list: TableType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
}

/**
 * Model for Table Request
 */
export interface TableReqType {
  /** The column models in this table */
  columns: NormalColumnRequestType[];
  /** the meta data for this table */
  meta?: MetaType;
  /**
   * The order of table list
   * @example 1
   */
  order?: number;
  /**
   * Table name
   * @example my_table
   */
  table_name: string;
  /**
   * Table title
   * @example My Table
   */
  title?: string;
}

/**
 * Model for User
 */
export interface UserType {
  /**
   * The email of the user
   * @format email
   * @example user@example.com
   */
  email: string;
  /** Set to true if the user's email has been verified. */
  email_verified: boolean;
  /**
   * The first name of the user
   * @example Alice
   */
  firstname: string;
  /**
   * Unique identifier for the given user.
   * @example us_8kugj628ebjngs
   */
  id: string;
  /**
   * The last name of the user
   * @example Smith
   */
  lastname: string;
  /**
   * The roles of the user
   * @example org-level-viewer
   */
  roles?: string;
}

/**
 * Model for User Info
 */
export interface UserInfoType {
  /**
   * User Email
   * @format email
   */
  email?: string;
  /** Set to true if the user's email has been verified. */
  email_verified?: boolean;
  /** The firstname of the user */
  firstname?: string;
  /** User ID */
  id?: string;
  /** The lastname of the user */
  lastname?: string;
  /** The roles of the user */
  roles?: any;
}

/**
 * Model for User List
 */
export interface UserListType {
  /** List of user objects */
  list: UserType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
}

/**
 * Model for View
 */
export interface ViewType {
  /** Unique Base ID */
  base_id?: IdType;
  /** Unique Model ID */
  fk_model_id: IdType;
  /** Unique ID for View */
  id?: IdType;
  /** Lock Type of the view */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Meta data for this view */
  meta?: MetaType;
  /** The rder of the list of views */
  order?: number;
  /** Password for protecting the view */
  password?: StringOrNullType;
  /** Unique Project ID */
  project_id?: IdType;
  /** If this view is shown? */
  show: BoolType;
  /** Should show system fields in this view? */
  show_system_fields?: BoolType;
  /** View Title */
  title: string;
  /** View Type */
  type: number;
  /** UUID of the view */
  uuid?: StringOrNullType;
  /** Associated View Model */
  view?:
    | FormType
    | GalleryType
    | GridType
    | KanbanType
    | MapType
    | (FormType & GalleryType & GridType & KanbanType & MapType);
}

/**
 * Model for View List
 */
export interface ViewListType {
  /** List of view objects */
  list: ViewType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
}

/**
 * Model for View Create Request
 */
export interface ViewCreateReqType {
  /**
   * View Title
   * @example My View
   */
  title: string;
  /** View Type */
  type?: number;
  /** ID of view to be copied from. Used in Copy View. */
  copy_from_id?: StringOrNullType;
  /** Foreign Key to Grouping Column. Used in creating Kanban View. */
  fk_grp_col_id?: StringOrNullType;
  /** Foreign Key to Geo Data Column. Used in creating Map View. */
  fk_geo_data_col_id?: StringOrNullType;
}

/**
 * Model for View Update Request
 */
export interface ViewUpdateReqType {
  /**
   * View Title
   * @example Grid View 1
   */
  title?: string;
  /**
   * View UUID. Used in Shared View.
   * @example e2457bbf-e29c-4fec-866e-fe3b01dba57f
   */
  uuid?: string;
  /**
   * View Password. Used in Shared View.
   * @example password123
   */
  password?: string;
  /**
   * Lock type of View.
   * @example collaborative
   */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Meta info used in View. */
  meta?: MetaType;
  /**
   * The order of the list of views.
   * @min 0
   * @example 1
   */
  order?: number;
  /** Should this view show system fields? */
  show_system_fields?: BoolType;
}

/**
 * Model for View Column Update Request
 */
export interface ViewColumnUpdateReqType {
  /** View Title */
  show?: BoolType;
  /**
   * The order of the list of views.
   * @min 0
   * @example 1
   */
  order?: number;
}

/**
 * Model for View Column Request
 */
export interface ViewColumnReqType {
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** View Title */
  show?: BoolType;
  /**
   * The order of the list of views.
   * @min 0
   * @example 1
   */
  order?: number;
}

/**
 * Model for Visibility Rule Request
 */
export type VisibilityRuleReqType = {
  id?: string | null;
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
  \**
   * The signed JWT token for information exchange
   * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IndAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfYjN4bzJpNDRueDV5OWwiLCJyb2xlcyI6Im9yZy1sZXZlbC1jcmVhdG9yLHN1cGVyIiwidG9rZW5fdmVyc2lvbiI6ImJmMTc3ZGUzYjk3YjAzMjY4YjU0NGZmMjMzNGU5YjFhMGUzYzgxM2NiYzliOTJkYWMwYmM5NTRiNmUzN2ZjMTJjYmFkNDM2NmIwYzExZTdjIiwiaWF0IjoxNjc4MDc4NDMyLCJleHAiOjE2NzgxMTQ0MzJ9.gzwp_svZlbA5PV_eawYV-9UFjZVjniy-tCDce16xrkI
   *\
  token?: string,

}` OK
 * @response `400` `{
  msg?: string,

}` Bad Request
 */
    signup: (data: SignUpReqType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * The signed JWT token for information exchange
           * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IndAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfYjN4bzJpNDRueDV5OWwiLCJyb2xlcyI6Im9yZy1sZXZlbC1jcmVhdG9yLHN1cGVyIiwidG9rZW5fdmVyc2lvbiI6ImJmMTc3ZGUzYjk3YjAzMjY4YjU0NGZmMjMzNGU5YjFhMGUzYzgxM2NiYzliOTJkYWMwYmM5NTRiNmUzN2ZjMTJjYmFkNDM2NmIwYzExZTdjIiwiaWF0IjoxNjc4MDc4NDMyLCJleHAiOjE2NzgxMTQ0MzJ9.gzwp_svZlbA5PV_eawYV-9UFjZVjniy-tCDce16xrkI
           */
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
  \**
   * Success Message
   * @example Signed out successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    signout: (params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Success Message
           * @example Signed out successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
  \**
   * The signed JWT token for information exchange
   * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IndAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfYjN4bzJpNDRueDV5OWwiLCJyb2xlcyI6Im9yZy1sZXZlbC1jcmVhdG9yLHN1cGVyIiwidG9rZW5fdmVyc2lvbiI6ImJmMTc3ZGUzYjk3YjAzMjY4YjU0NGZmMjMzNGU5YjFhMGUzYzgxM2NiYzliOTJkYWMwYmM5NTRiNmUzN2ZjMTJjYmFkNDM2NmIwYzExZTdjIiwiaWF0IjoxNjc4MDc4NDMyLCJleHAiOjE2NzgxMTQ0MzJ9.gzwp_svZlbA5PV_eawYV-9UFjZVjniy-tCDce16xrkI
   *\
  token?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    signin: (data: SignInReqType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * The signed JWT token for information exchange
           * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IndAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfYjN4bzJpNDRueDV5OWwiLCJyb2xlcyI6Im9yZy1sZXZlbC1jcmVhdG9yLHN1cGVyIiwidG9rZW5fdmVyc2lvbiI6ImJmMTc3ZGUzYjk3YjAzMjY4YjU0NGZmMjMzNGU5YjFhMGUzYzgxM2NiYzliOTJkYWMwYmM5NTRiNmUzN2ZjMTJjYmFkNDM2NmIwYzExZTdjIiwiaWF0IjoxNjc4MDc4NDMyLCJleHAiOjE2NzgxMTQ0MzJ9.gzwp_svZlbA5PV_eawYV-9UFjZVjniy-tCDce16xrkI
           */
          token?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    me: (
      query?: {
        /** Pass project id to get project specific roles along with user info */
        project_id?: IdType;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        UserInfoType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \**
   * Success Message
   * @example Please check your email to reset the password
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    passwordForgot: (data: PasswordForgotReqType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Success Message
           * @example Please check your email to reset the password
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/auth/password/forgot`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
  \** Success Message *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    passwordChange: (data: PasswordChangeReqType, params: RequestParams = {}) =>
      this.request<
        {
          /** Success Message */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
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
 * @response `200` `{
  \**
   * Success Message
   * @example Token has been validated successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    passwordResetTokenValidate: (token: string, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Success Message
           * @example Token has been validated successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/auth/token/validate/${token}`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description Api for verifying email where token need to be passed which is shared to user email.
 * 
 * @tags Auth
 * @name EmailValidate
 * @summary Verify Email
 * @request POST:/api/v1/auth/email/validate/{token}
 * @response `200` `{
  \**
   * Success Message
   * @example Email has been verified successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    emailValidate: (token: string, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Success Message
           * @example Email has been verified successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/auth/email/validate/${token}`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update user password to new by using reset token.
 * 
 * @tags Auth
 * @name PasswordReset
 * @summary Reset Password
 * @request POST:/api/v1/auth/password/reset/{token}
 * @response `200` `{
  \**
   * Success Message
   * @example Password has been reset successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    passwordReset: (
      token: string,
      data: PasswordResetReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Success Message
           * @example Password has been reset successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/auth/password/reset/${token}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
  \**
   * New access token for user
   * @example 96751db2d53fb834382b682268874a2ea9ee610e4d904e688d1513f11d3c30d62d36d9e05dec0d63
   *\
  token?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    tokenRefresh: (params: RequestParams = {}) =>
      this.request<
        {
          /**
           * New access token for user
           * @example 96751db2d53fb834382b682268874a2ea9ee610e4d904e688d1513f11d3c30d62d36d9e05dec0d63
           */
          token?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `{
  \**
   * Success Message for inviting single email
   * @example The user has been invited successfully
   *\
  msg?: string,
  \** @example 8354ddba-a769-4d64-8397-eccb2e2b3c06 *\
  invite_token?: string,
  error?: ({
  \** @example w@nocodb.com *\
  email?: string,
  \** @example <ERROR_MESSAGE> *\
  error?: string,

})[],
  \** @example w@nocodb.com *\
  email?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    projectUserAdd: (
      projectId: IdType,
      data: ProjectUserReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Success Message for inviting single email
           * @example The user has been invited successfully
           */
          msg?: string;
          /** @example 8354ddba-a769-4d64-8397-eccb2e2b3c06 */
          invite_token?: string;
          error?: {
            /** @example w@nocodb.com */
            email?: string;
            /** @example <ERROR_MESSAGE> */
            error?: string;
          }[];
          /** @example w@nocodb.com */
          email?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \**
   * Success Message
   * @example The user has been updated successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    projectUserUpdate: (
      projectId: IdType,
      userId: IdType,
      data: ProjectUserReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Success Message
           * @example The user has been updated successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \**
   * Success Message
   * @example The user has been updated successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    projectUserRemove: (
      projectId: IdType,
      userId: IdType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Success Message
           * @example The user has been updated successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \**
   * Success Message
   * @example The invitation has been sent to the user
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    projectUserResendInvite: (
      projectId: IdType,
      userId: IdType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Success Message
           * @example The invitation has been sent to the user
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/users/${userId}/resend-invite`,
        method: 'POST',
        format: 'json',
        ...params,
      }),
  };
  orgTokens = {
    /**
 * @description List all organisation API tokens.  Access with API tokens will be blocked.
 * 
 * @tags Org Tokens
 * @name List
 * @summary List Organisation API Tokens
 * @request GET:/api/v1/tokens
 * @response `200` `ApiTokenListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (params: RequestParams = {}) =>
      this.request<
        ApiTokenListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/tokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Creat an organisation API token. Access with API tokens will be blocked.
 * 
 * @tags Org Tokens
 * @name Create
 * @summary Create Organisation API Token
 * @request POST:/api/v1/tokens
 * @response `200` `ApiTokenType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (data: ApiTokenReqType, params: RequestParams = {}) =>
      this.request<
        ApiTokenType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/tokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete an organisation API token. Access with API tokens will be blocked.
 * 
 * @tags Org Tokens
 * @name Delete
 * @summary Delete Organisation API Tokens
 * @request DELETE:/api/v1/tokens/{token}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (token: string, params: RequestParams = {}) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/tokens/${token}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),
  };
  orgLicense = {
    /**
 * @description Get the application license key. Exclusive for super admin.
 * 
 * @tags Org License
 * @name Get
 * @summary Get App License
 * @request GET:/api/v1/license
 * @response `200` `{
  \** Application license key *\
  key?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    get: (params: RequestParams = {}) =>
      this.request<
        {
          /** Application license key */
          key?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/license`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Set the application license key. Exclusive for super admin.
 * 
 * @tags Org License
 * @name Set
 * @summary Create App License
 * @request POST:/api/v1/license
 * @response `200` `{
  \** @example The license key has been saved *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    set: (data: LicenseReqType, params: RequestParams = {}) =>
      this.request<
        {
          /** @example The license key has been saved */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/license`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  orgAppSettings = {
    /**
 * @description Get the application settings. Exclusive for super admin.
 * 
 * @tags Org App Settings
 * @name Get
 * @summary Get App Settings
 * @request GET:/api/v1/app-settings
 * @response `200` `{
  \**
   * Status of invite only signup
   * @example true
   *\
  invite_only_signup?: boolean,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    get: (params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Status of invite only signup
           * @example true
           */
          invite_only_signup?: boolean;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/app-settings`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the application settings. Exclusive for super admin.
 * 
 * @tags Org App Settings
 * @name Set
 * @summary Create App Settings
 * @request POST:/api/v1/app-settings
 * @response `200` `{
  \** @example The app settings have been saved *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    set: (
      data: {
        /**
         * Status of invite only signup
         * @example true
         */
        invite_only_signup?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The app settings have been saved */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/app-settings`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  orgUsers = {
    /**
 * @description List all organisation users. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Org Users
 * @name List
 * @summary List Organisation Users
 * @request GET:/api/v1/users
 * @response `200` `UserListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (params: RequestParams = {}) =>
      this.request<
        UserListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/users`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create an organisation user. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Org Users
 * @name Add
 * @summary Create Organisation User
 * @request POST:/api/v1/users
 * @response `200` `{
  \** Invite Token *\
  invite_token?: string,
  \**
   * User email
   * @example user@example.com
   *\
  email?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    add: (data: OrgUserReqType, params: RequestParams = {}) =>
      this.request<
        {
          /** Invite Token */
          invite_token?: string;
          /**
           * User email
           * @example user@example.com
           */
          email?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @tags Org Users
 * @name Update
 * @summary Update Organisation User
 * @request PATCH:/api/v1/users/{userId}
 * @response `200` `{
  \** @example The user has been updated successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      userId: IdType,
      data: OrgUserReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The user has been updated successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/users/${userId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete an organisation user by User ID. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Org Users
 * @name Delete
 * @summary Delete Organisation User
 * @request DELETE:/api/v1/users/{userId}
 * @response `200` `{
  \**
   * Sucess Message
   * @example The user has been deleted successfully
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (userId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Sucess Message
           * @example The user has been deleted successfully
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/users/${userId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Resend Invitation to a specific user. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Org Users
 * @name ResendInvite
 * @summary Invite Organisation User
 * @request POST:/api/v1/users/{userId}/resend-invite
 * @response `200` `{
  \**
   * Success Message
   * @example The invitation has been sent to the target user
   *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    resendInvite: (userId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Success Message
           * @example The invitation has been sent to the target user
           */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/users/${userId}/resend-invite`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description Generate Password Reset Token for Organisation User. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Org Users
 * @name GeneratePasswordResetToken
 * @summary Generate Organisation User Password Reset Token
 * @request POST:/api/v1/users/{userId}/generate-reset-url
 * @response `200` `{
  \** Password Reset Token for the user *\
  reset_password_token?: string,
  \** Password Reset URL for the user *\
  reset_password_url?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    generatePasswordResetToken: (userId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /** Password Reset Token for the user */
          reset_password_token?: string;
          /** Password Reset URL for the user */
          reset_password_url?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
  \**
   * Node version
   * @example v12.16.1
   *\
  Node?: string,
  \**
   * Architecture type
   * @example x64
   *\
  Arch?: string,
  \**
   * Platform type
   * @example linux
   *\
  Platform?: string,
  \**
   * Is docker
   * @example false
   *\
  Docker?: boolean,
  \**
   * Database type
   * @example postgres
   *\
  Database?: string,
  \**
   * Is project on rootdb
   * @example false
   *\
  ProjectOnRootDB?: boolean,
  \**
   * Root database type
   * @example postgres
   *\
  RootDB?: string,
  \**
   * Package version
   * @example 1.0.0
   *\
  PackageVersion?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaGet: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Node version
           * @example v12.16.1
           */
          Node?: string;
          /**
           * Architecture type
           * @example x64
           */
          Arch?: string;
          /**
           * Platform type
           * @example linux
           */
          Platform?: string;
          /**
           * Is docker
           * @example false
           */
          Docker?: boolean;
          /**
           * Database type
           * @example postgres
           */
          Database?: string;
          /**
           * Is project on rootdb
           * @example false
           */
          ProjectOnRootDB?: boolean;
          /**
           * Root database type
           * @example postgres
           */
          RootDB?: string;
          /**
           * Package version
           * @example 1.0.0
           */
          PackageVersion?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    modelVisibilityList: (
      projectId: IdType,
      query?: {
        includeM2M?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        any[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example UI ACL has been created successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    modelVisibilitySet: (
      projectId: IdType,
      data: VisibilityRuleReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example UI ACL has been created successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `ProjectListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (params: RequestParams = {}) =>
      this.request<
        ProjectListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/`,
        method: 'GET',
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      data: ProjectType & {
        /** If true, the project will us an external database else it will use the root database */
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        ProjectReqType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the info of a given project
 * 
 * @tags Project
 * @name Read
 * @summary Get Project
 * @request GET:/api/v1/db/meta/projects/{projectId}
 * @response `200` `ProjectType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        ProjectType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the given project
 * 
 * @tags Project
 * @name Update
 * @summary Update Project
 * @request PATCH:/api/v1/db/meta/projects/{projectId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      projectId: IdType,
      data: ProjectUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
  \**
   * @format uuid
   * @example a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
   *\
  uuid?: string,
  \** @format uri *\
  url?: string,
  \** @example viewer *\
  roles?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseGet: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * @format uuid
           * @example a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
           */
          uuid?: string;
          /** @format uri */
          url?: string;
          /** @example viewer */
          roles?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseDisable: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/shared`,
        method: 'DELETE',
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
  \**
   * @format uuid
   * @example a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
   *\
  uuid?: string,
  \** @format uri *\
  url?: string,
  \** @example viewer *\
  roles?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseUpdate: (
      projectId: IdType,
      data: SharedBaseReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * @format uuid
           * @example a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
           */
          uuid?: string;
          /** @format uri */
          url?: string;
          /** @example viewer */
          roles?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    cost: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The meta has been synchronized successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffSync: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /** @example The meta has been synchronized successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `({
  \**
   * Table Name
   * @example Table 1
   *\
  table_name?: string,
  \**
   * Base ID
   * @example ds_rrplkgy0pq1f3c
   *\
  base_id?: string,
  \**
   * Change Type
   * @example table
   *\
  type?: string,
  \** Detected Changes *\
  detectedChanges?: (object)[],

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffGet: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Table Name
           * @example Table 1
           */
          table_name?: string;
          /**
           * Base ID
           * @example ds_rrplkgy0pq1f3c
           */
          base_id?: string;
          /**
           * Change Type
           * @example table
           */
          type?: string;
          /** Detected Changes */
          detectedChanges?: object[];
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    hasEmptyOrNullFilters: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `BaseType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (projectId: IdType, baseId: string, params: RequestParams = {}) =>
      this.request<
        BaseType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (projectId: IdType, baseId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the base details of a given project
 * 
 * @tags Base
 * @name Update
 * @summary Update Base
 * @request PATCH:/api/v1/db/meta/projects/{projectId}/bases/{baseId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      projectId: IdType,
      baseId: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/bases/${baseId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        BaseListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      projectId: IdType,
      data: BaseType & {
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        BaseType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        TableListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    tableCreate: (
      projectId: IdType,
      baseId: string,
      data: TableReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        TableType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The base meta has been synchronized successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffSync: (
      projectId: IdType,
      baseId: string,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The base meta has been synchronized successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `({
  \**
   * Table Name
   * @example Table 1
   *\
  table_name?: string,
  \**
   * Base ID
   * @example ds_rrplkgy0pq1f3c
   *\
  base_id?: string,
  \**
   * Change Type
   * @example table
   *\
  type?: string,
  \** Detected Changes *\
  detectedChanges?: (object)[],

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffGet: (
      projectId: IdType,
      baseId: string,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * Table Name
           * @example Table 1
           */
          table_name?: string;
          /**
           * Base ID
           * @example ds_rrplkgy0pq1f3c
           */
          base_id?: string;
          /**
           * Change Type
           * @example table
           */
          type?: string;
          /** Detected Changes */
          detectedChanges?: object[];
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      projectId: IdType,
      data: TableReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        TableType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        TableListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `TableType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        TableType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The table has been updated successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      tableId: IdType,
      data: {
        /**
         * Table name
         * @example users
         */
        table_name?: string;
        /**
         * Table title
         * @example Users
         */
        title?: string;
        /**
         * Project ID
         * @example p_124hhlkbeasewh
         */
        project_id?: string;
        /** Model for Meta */
        meta?: MetaType;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The table has been updated successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the table meta data by the given table ID
 * 
 * @tags DB Table
 * @name Delete
 * @summary Delete Table
 * @request DELETE:/api/v1/db/meta/tables/{tableId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the order of the given Table
 * 
 * @tags DB Table
 * @name Reorder
 * @summary Reorder Table
 * @request POST:/api/v1/db/meta/tables/{tableId}/reorder
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    reorder: (
      tableId: IdType,
      data: {
        order?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}/reorder`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      tableId: IdType,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        void,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      columnId: string,
      data: ColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ColumnType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (columnId: string, params: RequestParams = {}) =>
      this.request<
        void,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    get: (columnId: string, params: RequestParams = {}) =>
      this.request<
        void,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    primaryColumnSet: (columnId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/columns/${columnId}/primary`,
        method: 'POST',
        format: 'json',
        ...params,
      }),
  };
  dbView = {
    /**
 * @description List all views in a given Table.
 * 
 * @tags DB View
 * @name List
 * @summary List Views
 * @request GET:/api/v1/db/meta/tables/{tableId}/views
 * @response `200` `ViewListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        ViewListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}/views`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the view with the given view Id.
 * 
 * @tags DB View
 * @name Update
 * @summary Update View
 * @request PATCH:/api/v1/db/meta/views/{viewId}
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      viewId: IdType,
      data: ViewUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the view with the given view Id.
 * 
 * @tags DB View
 * @name Delete
 * @summary Delete View
 * @request DELETE:/api/v1/db/meta/views/{viewId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (viewId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Show All Columns in a given View
 * 
 * @tags DB View
 * @name ShowAllColumn
 * @summary Show All Columns In View
 * @request POST:/api/v1/db/meta/views/{viewId}/show-all
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    showAllColumn: (
      viewId: IdType,
      query?: {
        ignoreIds?: any[];
      },
      params: RequestParams = {}
    ) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/show-all`,
        method: 'POST',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Hide All Columns in a given View
 * 
 * @tags DB View
 * @name HideAllColumn
 * @summary Hide All Columns In View
 * @request POST:/api/v1/db/meta/views/{viewId}/hide-all
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    hideAllColumn: (
      viewId: IdType,
      query?: {
        ignoreIds?: any[];
      },
      params: RequestParams = {}
    ) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/hide-all`,
        method: 'POST',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new grid view in a given Table
 * 
 * @tags DB View
 * @name GridCreate
 * @summary Create Grid View
 * @request POST:/api/v1/db/meta/tables/{tableId}/grids
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    gridCreate: (
      tableId: IdType,
      data: ViewCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    formCreate: (
      tableId: IdType,
      data: ViewCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @summary Update Form View
 * @request PATCH:/api/v1/db/meta/forms/{formViewId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    formUpdate: (
      formViewId: IdType,
      data: FormUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/forms/${formViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    formRead: (formViewId: IdType, params: RequestParams = {}) =>
      this.request<
        FormType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    formColumnUpdate: (
      formViewColumnId: IdType,
      data: FormColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        FormColumnReqType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    gridUpdate: (
      viewId: string,
      data: GridUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    gridColumnsList: (gridId: string, params: RequestParams = {}) =>
      this.request<
        GridColumnType[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    gridColumnUpdate: (
      columnId: IdType,
      data: GridColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @summary Create Gallery View
 * @request POST:/api/v1/db/meta/tables/{tableId}/galleries
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    galleryCreate: (
      tableId: IdType,
      data: ViewCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @request PATCH:/api/v1/db/meta/galleries/{galleryViewId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    galleryUpdate: (
      galleryViewId: string,
      data: GalleryUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/galleries/${galleryViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the Gallery View data with Gallery ID
 * 
 * @tags DB View
 * @name GalleryRead
 * @summary Get Gallery View
 * @request GET:/api/v1/db/meta/galleries/{galleryViewId}
 * @response `200` `GalleryType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    galleryRead: (galleryViewId: string, params: RequestParams = {}) =>
      this.request<
        GalleryType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/galleries/${galleryViewId}`,
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
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    kanbanCreate: (
      tableId: IdType,
      data: ViewCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @request PATCH:/api/v1/db/meta/kanbans/{kanbanViewId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    kanbanUpdate: (
      kanbanViewId: string,
      data: KanbanUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/kanbans/${kanbanViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the Kanban View data by Kanban ID
 * 
 * @tags DB View
 * @name KanbanRead
 * @summary Get Kanban View
 * @request GET:/api/v1/db/meta/kanbans/{kanbanViewId}
 * @response `200` `KanbanType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    kanbanRead: (kanbanViewId: string, params: RequestParams = {}) =>
      this.request<
        KanbanType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/kanbans/${kanbanViewId}`,
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
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    mapCreate: (
      tableId: IdType,
      data: ViewCreateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @request PATCH:/api/v1/db/meta/maps/{mapViewId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    mapUpdate: (
      mapViewId: string,
      data: MapUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/maps/${mapViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the Map View data by Map ID
 * 
 * @tags DB View
 * @name MapRead
 * @summary Get Map View
 * @request GET:/api/v1/db/meta/maps/{mapViewId}
 * @response `200` `MapType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    mapRead: (mapViewId: string, params: RequestParams = {}) =>
      this.request<
        MapType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/maps/${mapViewId}`,
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
 * @response `200` `SharedViewListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        SharedViewListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `SharedViewReqType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (viewId: string, params: RequestParams = {}) =>
      this.request<
        SharedViewReqType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      viewId: string,
      data: SharedViewReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        SharedViewType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (viewId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/share`,
        method: 'DELETE',
        format: 'json',
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
 * @response `200` `ColumnListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<
        ColumnListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/columns`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new column in a given View
 * 
 * @tags DB View Column
 * @name Create
 * @summary Create Column in View
 * @request POST:/api/v1/db/meta/views/{viewId}/columns
 * @response `200` `ColumnType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      viewId: string,
      data: ViewColumnReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ColumnType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/columns`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Update a column in a View
 * 
 * @tags DB View Column
 * @name Update
 * @summary Update View Column
 * @request PATCH:/api/v1/db/meta/views/{viewId}/columns/{columnId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      viewId: IdType,
      columnId: IdType,
      data: ViewColumnUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/columns/${columnId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
 * @response `200` `SortListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (viewId: string, params: RequestParams = {}) =>
      this.request<
        SortListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      viewId: string,
      data: SortReqType & {
        /**
         * Push the sort to the top of the list
         * @example true
         */
        push_to_top?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/sorts`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    get: (sortId: string, params: RequestParams = {}) =>
      this.request<
        SortType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (sortId: string, data: SortReqType, params: RequestParams = {}) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the sort data by Sort ID
 * 
 * @tags DB Table Sort
 * @name Delete
 * @summary Delete Sort
 * @request DELETE:/api/v1/db/meta/sorts/{sortId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (sortId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/sorts/${sortId}`,
        method: 'DELETE',
        format: 'json',
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
 * @response `200` `FilterListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (viewId: string, params: RequestParams = {}) =>
      this.request<
        FilterListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (viewId: string, data: FilterReqType, params: RequestParams = {}) =>
      this.request<
        FilterType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    get: (filterId: IdType, params: RequestParams = {}) =>
      this.request<
        FilterType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      filterId: IdType,
      data: FilterReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the filter data with a given Filter ID
 * 
 * @tags DB Table Filter
 * @name Delete
 * @summary Delete Filter
 * @request DELETE:/api/v1/db/meta/filters/{filterId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (filterId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/filters/${filterId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Get Filter Group Children of a given group ID
 * 
 * @tags DB Table Filter
 * @name ChildrenRead
 * @summary Get Filter Group Children
 * @request GET:/api/v1/db/meta/filters/{filterGroupId}/children
 * @response `200` `FilterListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    childrenRead: (filterGroupId: IdType, params: RequestParams = {}) =>
      this.request<
        FilterListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/filters/${filterGroupId}/children`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTableWebhookFilter = {
    /**
 * @description Get the filter data in a given Hook
 * 
 * @tags DB Table Webhook Filter
 * @name Read
 * @summary Get Hook Filter
 * @request GET:/api/v1/db/meta/hooks/{hookId}/filters
 * @response `200` `FilterListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (hookId: IdType, params: RequestParams = {}) =>
      this.request<
        FilterListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/hooks/${hookId}/filters`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create filter(s) in a given Hook
 * 
 * @tags DB Table Webhook Filter
 * @name Create
 * @summary Create Hook Filter
 * @request POST:/api/v1/db/meta/hooks/{hookId}/filters
 * @response `200` `FilterType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (hookId: IdType, data: FilterReqType, params: RequestParams = {}) =>
      this.request<
        FilterType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/hooks/${hookId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  dbTableWebhookLogs = {
    /**
 * @description List the log data in a given Hook
 * 
 * @tags DB Table Webhook Logs
 * @name List
 * @summary List Hook Logs
 * @request GET:/api/v1/db/meta/hooks/{hookId}/logs
 * @response `200` `HookLogListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (hookId: IdType, params: RequestParams = {}) =>
      this.request<
        HookLogListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/hooks/${hookId}/logs`,
        method: 'GET',
        format: 'json',
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
 * @response `200` `{
  \** List of data objects *\
  list: (object)[],
  \** Paginated Info *\
  pageInfo: PaginatedType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (
      orgs: string,
      projectName: string,
      tableName: string,
      query?: {
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** List of data objects */
          list: object[];
          /** Paginated Info */
          pageInfo: PaginatedType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        any[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/group/${columnId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the Table Row by Row ID
 * 
 * @tags DB Table Row
 * @name Read
 * @summary Get Table Row
 * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `({
  id?: string,

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkCreate: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        {
          id?: string;
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `(number)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkUpdate: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        number[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `(number)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkDelete: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        number[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkUpdateAll: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object,
      query?: {
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `(object)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkDeleteAll: (
      orgs: string,
      projectName: string,
      tableName: string,
      data: object,
      query?: {
        where?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        object[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    csvExport: (
      orgs: string,
      projectName: string,
      tableName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/export/${type}`,
        method: 'GET',
        wrapped: true,
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The relation data has been created successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The relation data has been created successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The relation data has been deleted successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        {
          /** @example The relation data has been deleted successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        any[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** List of table view rows *\
  list: (object)[],
  \** Paginated Info *\
  pageInfo: PaginatedType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        {
          /** List of table view rows */
          list: object[];
          /** Paginated Info */
          pageInfo: PaginatedType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  count?: number,

}` OK
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
      this.request<
        {
          count?: number;
        },
        any
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/${rowId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Check row with provided primary key exists or not
 * 
 * @tags DB View Row
 * @name Exist
 * @summary Does Table View Row Exist
 * @request GET:/api/v1/db/data/{orgs}/{projectName}/{tableName}/views/{viewName}/{rowId}/exist
 * @response `201` `number` Created
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    exist: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      rowId: any,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    export: (
      orgs: string,
      projectName: string,
      tableName: string,
      viewName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${projectName}/${tableName}/views/${viewName}/export/${type}`,
        method: 'GET',
        wrapped: true,
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
 * @response `200` `({
  \** The Grouped Key *\
  key: string,
  \** the paginated result of the given key *\
  value: {
  \** List of the target data *\
  list: (object)[],
  \** Paginated Info *\
  pageInfo: PaginatedType,

},

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    groupedDataList: (
      sharedViewUuid: string,
      columnId: IdType,
      query?: {
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** The Grouped Key */
          key: string;
          /** the paginated result of the given key */
          value: {
            /** List of the target data */
            list: object[];
            /** Paginated Info */
            pageInfo: PaginatedType;
          };
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `SharedViewListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataList: (
      sharedViewUuid: string,
      query?: {
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        SharedViewListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataCreate: (
      sharedViewUuid: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
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
 * @response `200` `{
  \** List of data objects *\
  list: (object)[],
  \** Paginated info *\
  pageInfo: PaginatedType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataNestedList: (
      sharedViewUuid: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt',
      columnName: string,
      query?: {
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** List of data objects */
          list: object[];
          /** Paginated info */
          pageInfo: PaginatedType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    csvExport: (
      sharedViewUuid: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/rows/export/${type}`,
        method: 'GET',
        wrapped: true,
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataRelationList: (
      sharedViewUuid: string,
      columnName: string,
      query?: {
        /** Which fields to be shown */
        fields?: any[];
        /** The result will be sorted based on `sort` query */
        sort?: string[] | string;
        /** Extra filtering */
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
        /** Used for multiple sort queries */
        sortArrJson?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
  \** Project ID *\
  project_id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseGet: (sharedBaseUuid: string, params: RequestParams = {}) =>
      this.request<
        {
          /** Project ID */
          project_id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
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
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `{
  list: (AuditType)[],

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    commentList: (
      query: {
        /**
         * Row ID
         * @example 10
         */
        row_id: string;
        /**
         * Foreign Key to Model
         * @example md_c6csq89tl37jm5
         */
        fk_model_id: IdType;
        /**
         * Is showing comments only?
         * @example true
         */
        comments_only?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          list: AuditType[];
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/audits/comments`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new comment in a row. Logged in Audit.
 * 
 * @tags Utils
 * @name CommentRow
 * @summary Comment Rows
 * @request POST:/api/v1/db/meta/audits/comments
 * @response `200` `AuditType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    commentRow: (data: CommentReqType, params: RequestParams = {}) =>
      this.request<
        AuditType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/audits/comments`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update comment in Audit
     *
     * @tags Utils
     * @name CommentUpdate
     * @summary Update Comment in Audit
     * @request PATCH:/api/v1/db/meta/audits/{auditId}/comment
     * @response `200` `number` OK
     */
    commentUpdate: (
      auditId: string,
      data: CommentUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<number, any>({
        path: `/api/v1/db/meta/audits/${auditId}/comment`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Return the number of comments in the given query.
 * 
 * @tags Utils
 * @name CommentCount
 * @summary Count Comments
 * @request GET:/api/v1/db/meta/audits/comments/count
 * @response `200` `({
  \**
   * The number of comments
   * @example 4
   *\
  count: string,
  \**
   * Row ID
   * @example 1
   *\
  row_id: string,

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    commentCount: (
      query: {
        /** Comment IDs */
        ids: any;
        /** Foreign Key to Model */
        fk_model_id: IdType;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * The number of comments
           * @example 4
           */
          count: string;
          /**
           * Row ID
           * @example 1
           */
          row_id: string;
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `AuditType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    auditRowUpdate: (
      rowId: any,
      data: AuditRowUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        AuditType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/audits/rows/${rowId}/update`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
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
  data?: object,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    testConnection: (
      data: {
        /**
         * DB Type
         * @example mysql2
         */
        client?:
          | 'mssql'
          | 'mysql'
          | 'mysql2'
          | 'oracledb'
          | 'pg'
          | 'snowflake'
          | 'sqlite3';
        connection?: {
          host?: string;
          port?: string;
          user?: string;
          password?: string;
          /** Model for StringOrNull */
          database?: StringOrNullType;
        };
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          code?: number;
          message?: string;
          data?: object;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `{
  \**
   * DB Type
   * @example mysql2
   *\
  client?: "mssql" | "mysql" | "mysql2" | "oracledb" | "pg" | "snowflake" | "sqlite3",
  \** Connection Config *\
  connection?: {
  \** DB User *\
  user?: string,
  \** DB Password *\
  password?: string,
  \** DB Name *\
  database?: string,
  \** DB Host *\
  host?: string,
  \** DB Host *\
  port?: string,

},

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    urlToConfig: (
      data: {
        /**
         * JDBC URL
         * @example jdbc:mysql://username:password@localhost:3306/sakila
         */
        url?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /**
           * DB Type
           * @example mysql2
           */
          client?:
            | 'mssql'
            | 'mysql'
            | 'mysql2'
            | 'oracledb'
            | 'pg'
            | 'snowflake'
            | 'sqlite3';
          /** Connection Config */
          connection?: {
            /** DB User */
            user?: string;
            /** DB Password */
            password?: string;
            /** DB Name */
            database?: string;
            /** DB Host */
            host?: string;
            /** DB Host */
            port?: string;
          };
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/url_to_config`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the application info such as authType, defaultLimit, version and etc.
 * 
 * @tags Utils
 * @name AppInfo
 * @summary Get App Info
 * @request GET:/api/v1/db/meta/nocodb/info
 * @response `200` `{
  authType?: string,
  projectHasAdmin?: boolean,
  firstUser?: boolean,
  type?: string,
  googleAuthEnabled?: boolean,
  githubAuthEnabled?: boolean,
  oneClick?: boolean,
  connectToExternalDB?: boolean,
  version?: string,
  defaultLimit?: number,
  ncMin?: boolean,
  teleEnabled?: boolean,
  auditEnabled?: boolean,
  ncSiteUrl?: string,
  ee?: boolean,
  ncAttachmentFieldSize?: number,
  ncMaxAttachmentsAllowed?: number,
  isCloud?: boolean,
  \** @example OFF *\
  automationLogLevel?: "OFF" | "ERROR" | "ALL",

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    appInfo: (params: RequestParams = {}) =>
      this.request<
        {
          authType?: string;
          projectHasAdmin?: boolean;
          firstUser?: boolean;
          type?: string;
          googleAuthEnabled?: boolean;
          githubAuthEnabled?: boolean;
          oneClick?: boolean;
          connectToExternalDB?: boolean;
          version?: string;
          defaultLimit?: number;
          ncMin?: boolean;
          teleEnabled?: boolean;
          auditEnabled?: boolean;
          ncSiteUrl?: string;
          ee?: boolean;
          ncAttachmentFieldSize?: number;
          ncMaxAttachmentsAllowed?: number;
          isCloud?: boolean;
          /** @example OFF */
          automationLogLevel?: 'OFF' | 'ERROR' | 'ALL';
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    axiosRequestMake: (data: object, params: RequestParams = {}) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \**
   * Current NocoDB Version
   * @example 0.104.0
   *\
  currentVersion?: string,
  \**
   * Latest Release Version
   * @example 0.105.3
   *\
  releaseVersion?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    appVersion: (params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Current NocoDB Version
           * @example 0.104.0
           */
          currentVersion?: string;
          /**
           * Latest Release Version
           * @example 0.105.3
           */
          releaseVersion?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example OK *\
  message?: string,
  \** @example 1678702175755 *\
  timestamp?: string,
  \** @example 1618.996877834 *\
  uptime?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    appHealth: (params: RequestParams = {}) =>
      this.request<
        {
          /** @example OK */
          message?: string;
          /** @example 1678702175755 */
          timestamp?: string;
          /** @example 1618.996877834 */
          uptime?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
  \** Table Count *\
  table?: number,
  \** View Count *\
  view?: number,

},
  \** External Project *\
  external?: boolean,
  viewCount?: {
  \** Form Count *\
  formCount?: number,
  \** Grid Count *\
  gridCount?: number,
  \** Gallery Count *\
  galleryCount?: number,
  \** Kanban Count *\
  kanbanCount?: number,
  \** Total View Count *\
  total?: number,
  \** Shared Form Count *\
  sharedFormCount?: number,
  \** Shared Grid Count *\
  sharedGridCount?: number,
  \** Shared Gallery Count *\
  sharedGalleryCount?: number,
  \** Shared Kanban Count *\
  sharedKanbanCount?: number,
  \** Shared Total View Count *\
  sharedTotal?: number,
  \** Shared Locked View Count *\
  sharedLockedCount?: number,

},
  \** Webhook Count *\
  webhookCount?: number,
  \** Filter Count *\
  filterCount?: number,
  \** Sort Count *\
  sortCount?: number,
  \** Row Count *\
  rowCount?: ({
  TotalRecords?: string,

})[],
  \** Total project user Count *\
  userCount?: number,

})[],
  \** Total user Count *\
  userCount?: number,
  \** Total shared base Count *\
  sharedBaseCount?: number,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    aggregatedMetaInfo: (params: RequestParams = {}) =>
      this.request<
        {
          projectCount?: number;
          projects?: {
            tableCount?: {
              /** Table Count */
              table?: number;
              /** View Count */
              view?: number;
            };
            /** External Project */
            external?: boolean;
            viewCount?: {
              /** Form Count */
              formCount?: number;
              /** Grid Count */
              gridCount?: number;
              /** Gallery Count */
              galleryCount?: number;
              /** Kanban Count */
              kanbanCount?: number;
              /** Total View Count */
              total?: number;
              /** Shared Form Count */
              sharedFormCount?: number;
              /** Shared Grid Count */
              sharedGridCount?: number;
              /** Shared Gallery Count */
              sharedGalleryCount?: number;
              /** Shared Kanban Count */
              sharedKanbanCount?: number;
              /** Shared Total View Count */
              sharedTotal?: number;
              /** Shared Locked View Count */
              sharedLockedCount?: number;
            };
            /** Webhook Count */
            webhookCount?: number;
            /** Filter Count */
            filterCount?: number;
            /** Sort Count */
            sortCount?: number;
            /** Row Count */
            rowCount?: {
              TotalRecords?: string;
            }[];
            /** Total project user Count */
            userCount?: number;
          }[];
          /** Total user Count */
          userCount?: number;
          /** Total shared base Count */
          sharedBaseCount?: number;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    cacheDelete: (params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/cache`,
        method: 'DELETE',
        format: 'json',
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
 * @response `200` `HookListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        HookListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `HookType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (tableId: IdType, data: HookReqType, params: RequestParams = {}) =>
      this.request<
        HookType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `{
  \** @example The hook has been tested successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    test: (
      tableId: IdType,
      data: HookTestReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The hook has been tested successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @request GET:/api/v1/db/meta/tables/{tableId}/hooks/samplePayload/{operation}/{version}
 * @response `200` `{
  \** Sample Payload Data *\
  data?: object,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    samplePayloadGet: (
      tableId: IdType,
      operation: 'update' | 'delete' | 'insert',
      version: 'v1' | 'v2',
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** Sample Payload Data */
          data?: object;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}/hooks/samplePayload/${operation}/${version}`,
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (hookId: string, data: HookType, params: RequestParams = {}) =>
      this.request<
        HookType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (hookId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/hooks/${hookId}`,
        method: 'DELETE',
        format: 'json',
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (params: RequestParams = {}) =>
      this.request<
        {
          list?: PluginType[];
          /** Model for Paginated */
          pageInfo?: PaginatedType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    status: (pluginTitle: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    test: (data: PluginTestReqType, params: RequestParams = {}) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      pluginId: string,
      data: PluginReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        any,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (pluginId: string, params: RequestParams = {}) =>
      this.request<
        PluginType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
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
 * @response `200` `ApiTokenListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (projectId: IdType, params: RequestParams = {}) =>
      this.request<
        ApiTokenListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
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
 * @response `200` `ApiTokenType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      projectId: IdType,
      data: ApiTokenReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        ApiTokenType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the given API Token in project
 * 
 * @tags API Token
 * @name Delete
 * @summary Delete API Token
 * @request DELETE:/api/v1/db/meta/projects/{projectId}/api-tokens/{token}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (projectId: IdType, token: string, params: RequestParams = {}) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${projectId}/api-tokens/${token}`,
        method: 'DELETE',
        format: 'json',
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
        /**
         * Target File Path
         * @example download/noco/jango_fett/Table1/attachment/uVbjPVQxC_SSfs8Ctx.jpg
         */
        path: string;
      },
      data: AttachmentReqType,
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
        /**
         * Target File Path
         * @example download/noco/jango_fett/Table1/attachment/c7z_UF8sZBgJUxMjpN.jpg
         */
        path: string;
      },
      data: AttachmentReqType[],
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
