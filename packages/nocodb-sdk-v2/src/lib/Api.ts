/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/** Workspace roles for the user. */
export enum WorkspaceRoles {
  WorkspaceLevelOwner = "workspace-level-owner",
  WorkspaceLevelCreator = "workspace-level-creator",
  WorkspaceLevelEditor = "workspace-level-editor",
  WorkspaceLevelViewer = "workspace-level-viewer",
  WorkspaceLevelCommenter = "workspace-level-commenter",
  WorkspaceLevelNoAccess = "workspace-level-no-access",
}

/** Base roles for the user. */
export enum BaseRoles {
  Owner = "owner",
  Creator = "creator",
  Editor = "editor",
  Viewer = "viewer",
  Commenter = "commenter",
  NoAccess = "no-access",
}

export interface Base {
  /** Unique identifier for the base. */
  id: string;
  /** Title of the base. */
  title: string;
  meta: BaseMetaRes;
  /**
   * Timestamp of when the base was created.
   * @format date-time
   */
  created_at: string;
  /**
   * Timestamp of when the base was last updated.
   * @format date-time
   */
  updated_at: string;
  /** Unique identifier for the workspace to which this base belongs to. */
  workspace_id: string;
  /** List of data sources associated with this base. This information will be included only if one or more external data sources are associated with the base. */
  sources?: {
    /** Unique identifier for the data source. */
    id: string;
    /** Title of the data source. */
    title: string;
    /** Type of the data source (e.g., pg, mysql). */
    type: string;
    /** Indicates if the schema in this data source is read-only. */
    is_schema_readonly: boolean;
    /** Indicates if the data (records) in this data source is read-only. */
    is_data_readonly: boolean;
    /** Integration ID for the data source. */
    integration_id: string;
  }[];
}

export interface BaseMetaRes {
  /**
   * Specifies the color of the base icon using a hexadecimal color code (e.g., `#36BFFF`)
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  icon_color?: string;
}

export interface BaseMetaReq {
  /**
   * Specifies the color of the base icon using a hexadecimal color code (e.g., `#36BFFF`).
   *
   * **Constraints**:
   * - Must be a valid 6-character hexadecimal color code preceded by a `#`.
   * - Optional field; defaults to a standard color if not provided.
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  icon_color?: string;
}

export interface BaseCreate {
  /** Title of the base. */
  title: string;
  meta?: BaseMetaReq;
}

export interface BaseUpdate {
  /** Title of the base. */
  title?: string;
  meta?: BaseMetaReq;
}

export interface TableList {
  list: {
    /** Unique identifier for the table. */
    id: string;
    /** Title of the table. */
    title: string;
    /** Description of the table. */
    description?: string | null;
    meta?: TableMeta;
    /** Unique identifier for the base to which this table belongs to. */
    base_id: string;
    /** Unique identifier for the data source. This information will be included only if the table is associated with an external data source. */
    source_id?: string;
    /** Unique identifier for the workspace to which this base belongs to. */
    workspace_id: string;
  }[];
}

export interface TableMeta {
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  icon?: string;
}

export interface TableCreate {
  /** Title of the table. */
  title: string;
  /** Description of the table. */
  description?: string | null;
  meta?: TableMeta;
  /** Unique identifier for the data source. Include this information only if the table being created is part of a data source. */
  source_id?: string;
  fields?: CreateField[];
}

export type FieldOptions = any;

export type CreateField = FieldBase;

export interface Table {
  /** Unique identifier for the table. */
  id: string;
  /** Unique identifier for the data source. This information will be included only if the table is associated with an external data source. */
  source_id?: string;
  /** Unique identifier for the base to which this table belongs to. */
  base_id: string;
  /** Title of the table. */
  title: string;
  /** Description of the table. */
  description?: string;
  /** Unique identifier for the display field of the table. First non system field is set as display field by default. */
  display_field_id: string;
  /** Unique identifier for the workspace to which this base belongs to. */
  workspace_id: string;
  /** List of fields associated with this table. */
  fields: CreateField[];
  /** List of views associated with this table. */
  views: ViewSummary[];
}

export interface BaseUser {
  /** Unique identifier for the user. */
  id: string;
  /**
   * Email address of the user.
   * @format email
   */
  email: string;
  /** Display name of the user. */
  user_name?: string;
  /**
   * Timestamp of when the user was created.
   * @format date-time
   */
  created_at: string;
  /**
   * Timestamp of when the user access was last updated.
   * @format date-time
   */
  updated_at: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
  /** Workspace roles for the user. */
  workspace_role: WorkspaceRoles;
  /** Unique identifier for the workspace. */
  workspace_id: string;
}

export type BaseUserDeleteRequest = any;

export interface BaseUserList {
  list?: BaseUser[];
}

/** Array of users to be created. */
export type BaseUserCreate = {
  /** Unique identifier for the user. Can be provided optionally during creation. */
  id?: string;
  /**
   * Email address of the user. Used as a primary identifier if 'id' is not provided.
   * @format email
   */
  email?: string;
  /** Full name of the user. */
  user_name?: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
}[];

/** Array of user updates. */
export type BaseUserUpdate = {
  /** Unique identifier for the user. Used as a primary identifier if provided. */
  id?: string;
  /**
   * Email address of the user. Used as a primary identifier if 'id' is not provided.
   * @format email
   */
  email?: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
}[];

export type BaseUserDelete = {
  /** Unique identifier for the user. */
  id?: string;
  /**
   * Email address of the user.
   * @format email
   */
  email?: string;
}[];

export interface TableMetaReq {
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  icon?: string;
}

export type TableUpdate = {
  /** New title of the table. */
  title?: string;
  /** Description of the table. */
  description?: string;
  /** Unique identifier for the display field of the table. The type of the field should be one of the allowed types for display field. */
  display_field_id?: string;
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  meta?: TableMetaReq;
};

export interface Sort {
  /**
   * Unique identifier for the sort.
   * @format uuid
   */
  id: string;
  /**
   * Identifier for the field being sorted.
   * @format uuid
   */
  field_id: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction: "asc" | "desc";
}

export interface SortCreate {
  /**
   * Identifier for the field being sorted.
   * @format uuid
   */
  field_id: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction: "asc" | "desc";
}

export interface SortUpdate {
  /** Unique identifier for the sort. */
  id: string;
  /**
   * Identifier for the field being sorted.
   * @format uuid
   */
  field_id?: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction?: "asc" | "desc";
}

export interface ViewSummary {
  /**
   * Unique identifier for the view.
   * @format uuid
   */
  id?: string;
  /** Name of the view. */
  title?: string;
  /** Type of the view. */
  view_type?: "GRID" | "GALLERY" | "KANBAN" | "CALENDAR" | "FORM";
}

/** GRID View */
export type View = (
  | {
      fields: {
        /**
         * Field ID for GRID view.
         * @format uuid
         */
        field_id?: string;
        /** Indicates if the field is hidden in GRID view. */
        is_hidden?: boolean;
      }[];
      group?: {
        /**
         * Field ID for grouping in GRID view.
         * @format uuid
         */
        field_id?: string;
        /** Sorting order for the group. */
        sort?: "asc" | "desc";
      }[];
    }
  | {
      fields: {
        /**
         * Field ID displayed in GALLERY view.
         * @format uuid
         */
        field_id?: string;
        /** Indicates if the field is the cover image. */
        cover_image?: boolean;
      }[];
      /**
       * Field ID for the cover image.
       * @format uuid
       */
      cover_image_field_id?: string;
    }
  | {
      fields: {
        /**
         * Field ID used in KANBAN view.
         * @format uuid
         */
        field_id?: string;
        /** Indicates if the field is used for stacking in KANBAN. */
        is_stack_by?: boolean;
      }[];
      /**
       * Field ID for the cover image.
       * @format uuid
       */
      cover_image_field_id?: string;
      /**
       * Field ID used for stacking in KANBAN view.
       * @format uuid
       */
      kanban_stack_by_field_id?: string;
    }
  | {
      fields: {
        /**
         * Field ID displayed in CALENDAR view.
         * @format uuid
         */
        field_id?: string;
        /** Indicates if the field is used for date ranges. */
        is_date_field?: boolean;
      }[];
      calendar_range?: {
        /**
         * Field ID for the start date.
         * @format uuid
         */
        start_field_id?: string;
        /**
         * Field ID for the end date.
         * @format uuid
         */
        end_field_id?: string;
      }[];
    }
  | {
      fields: {
        /**
         * Field ID used in FORM view.
         * @format uuid
         */
        field_id?: string;
        /** Indicates if the field is required in the form. */
        is_required?: boolean;
      }[];
      /** Heading for the form. */
      form_heading?: string;
      /** Subheading for the form. */
      form_sub_heading?: string;
      /** Success message shown after form submission. */
      form_success_message?: string;
      /**
       * URL to redirect to after form submission.
       * @format uri
       */
      form_redirect_url?: string;
      /** Seconds to wait before redirecting. */
      form_redirect_after_secs?: number;
      /** Whether to send a response email. */
      form_send_response_email?: boolean;
      /** Whether to show another form after submission. */
      form_show_another?: boolean;
      /** Whether to show a blank form after submission. */
      form_show_blank?: boolean;
      /** Whether to hide the banner on the form. */
      form_hide_banner?: boolean;
      /** Whether to hide branding on the form. */
      form_hide_branding?: boolean;
      /**
       * URL of the banner image for the form.
       * @format uri
       */
      form_banner_image_url?: string;
      /**
       * URL of the logo for the form.
       * @format uri
       */
      form_logo_url?: string;
      /**
       * Background color for the form.
       * @pattern ^#[0-9A-Fa-f]{6}$
       */
      form_background_color?: string;
    }
) & {
  /**
   * Unique identifier for the view.
   * @format uuid
   */
  id?: string;
  /** Name of the view. */
  view_name?: string;
  /** Type of the view. */
  view_type?: "GRID" | "GALLERY" | "KANBAN" | "CALENDAR" | "FORM";
  /** Lock type of the view. */
  lock_type?: "COLLABARATIVE" | "LOCKED" | "PERSONAL";
  /** Description of the view. */
  description?: string;
  /** Indicates if this is the default view. */
  is_default?: boolean;
  meta?: {
    /** Description for locked views. */
    locked_view_description?: string;
    /**
     * User ID of the person who locked the view.
     * @format uuid
     */
    locked_by_user_id?: string;
  };
  /**
   * User ID of the creator.
   * @format uuid
   */
  created_by?: string;
  /**
   * User ID of the owner.
   * @format uuid
   */
  owned_by?: string;
  /**
   * Timestamp of creation.
   * @format date-time
   */
  created_at?: string;
  /**
   * Timestamp of last update.
   * @format date-time
   */
  updated_at?: string;
  /** Filters applied to the view. */
  filters?: Filter[];
  /** Sort options for the view. */
  sorts?: Sort[];
};

export interface ViewCreate {
  /** Name of the view. */
  view_name?: string;
  /** Type of the view. */
  view_type?: "GRID" | "GALLERY" | "KANBAN" | "CALENDAR" | "FORM";
  /** Lock type of the view. */
  lock_type?: "COLLABARATIVE" | "LOCKED" | "PERSONAL";
  /** Description of the view. */
  description?: string;
}

export interface FieldBase {
  /** Unique identifier for the field. */
  id?: string;
  /** Title of the field. */
  title: string;
  /** Field data type. */
  type: string;
  /** Description of the field. */
  description?: string | null;
  /** Default value for the field. Applicable for SingleLineText, LongText, PhoneNumber, URL, Email, Number, Decimal, Currency, Percent, Duration, Date, DateTime, Time, SingleSelect, MultiSelect, Rating, Checkbox, User and JSON fields. */
  default_value?: string;
}

export interface FieldOptionsLongText {
  /** Enable rich text formatting. */
  rich_text?: boolean;
  /** Enable text generation for this field using NocoAI. */
  generate_text_using_ai?: boolean;
}

export interface FieldOptionsPhoneNumber {
  /** Enable validation for phone numbers. */
  validation?: boolean;
}

export interface FieldOptionsURL {
  /** Enable validation for URL. */
  validation?: boolean;
}

export interface FieldOptionsEmail {
  /** Enable validation for Email. */
  validation?: boolean;
}

export interface FieldOptionsNumber {
  /** Show thousand separator on the UI. */
  locale_string?: boolean;
}

export interface FieldOptionsDecimal {
  /**
   * Decimal field precision. Defaults to 0
   * @min 0
   * @max 5
   */
  precision?: number;
}

/** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
export interface FieldOptionsCurrency {
  /** Locale for currency formatting. Refer https://simplelocalize.io/data/locales/ */
  locale?: string;
  /** Currency code. Refer https://simplelocalize.io/data/locales/ */
  code?:
    | "AED"
    | "AFN"
    | "ALL"
    | "AMD"
    | "ANG"
    | "AOA"
    | "ARS"
    | "AUD"
    | "AWG"
    | "AZN"
    | "BAM"
    | "BBD"
    | "BDT"
    | "BGN"
    | "BHD"
    | "BIF"
    | "BMD"
    | "BND"
    | "BOB"
    | "BOV"
    | "BRL"
    | "BSD"
    | "BTN"
    | "BWP"
    | "BYR"
    | "BZD"
    | "CAD"
    | "CDF"
    | "CHE"
    | "CHF"
    | "CHW"
    | "CLF"
    | "CLP"
    | "CNY"
    | "COP"
    | "COU"
    | "CRC"
    | "CUP"
    | "CVE"
    | "CYP"
    | "CZK"
    | "DJF"
    | "DKK"
    | "DOP"
    | "DZD"
    | "EEK"
    | "EGP"
    | "ERN"
    | "ETB"
    | "EUR"
    | "FJD"
    | "FKP"
    | "GBP"
    | "GEL"
    | "GHC"
    | "GIP"
    | "GMD"
    | "GNF"
    | "GTQ"
    | "GYD"
    | "HKD"
    | "HNL"
    | "HRK"
    | "HTG"
    | "HUF"
    | "IDR"
    | "ILS"
    | "INR"
    | "IQD"
    | "IRR"
    | "ISK"
    | "JMD"
    | "JOD"
    | "JPY"
    | "KES"
    | "KGS"
    | "KHR"
    | "KMF"
    | "KPW"
    | "KRW"
    | "KWD"
    | "KYD"
    | "KZT"
    | "LAK"
    | "LBP"
    | "LKR"
    | "LRD"
    | "LSL"
    | "LTL"
    | "LVL"
    | "LYD"
    | "MAD"
    | "MDL"
    | "MGA"
    | "MKD"
    | "MMK"
    | "MNT"
    | "MOP"
    | "MRO"
    | "MTL"
    | "MUR"
    | "MVR"
    | "MWK"
    | "MXN"
    | "MXV"
    | "MYR"
    | "MZN"
    | "NAD"
    | "NGN"
    | "NIO"
    | "NOK"
    | "NPR"
    | "NZD"
    | "OMR"
    | "PAB"
    | "PEN"
    | "PGK"
    | "PHP"
    | "PKR"
    | "PLN"
    | "PYG"
    | "QAR"
    | "ROL"
    | "RON"
    | "RSD"
    | "RUB"
    | "RWF"
    | "SAR"
    | "SBD"
    | "SCR"
    | "SDD"
    | "SEK"
    | "SGD"
    | "SHP"
    | "SIT"
    | "SKK"
    | "SLL"
    | "SOS"
    | "SRD"
    | "STD"
    | "SYP"
    | "SZL"
    | "THB"
    | "TJS"
    | "TMM"
    | "TND"
    | "TOP"
    | "TRY"
    | "TTD"
    | "TWD"
    | "TZS"
    | "UAH"
    | "UGX"
    | "USD"
    | "USN"
    | "USS"
    | "UYU"
    | "UZS"
    | "VEB"
    | "VND"
    | "VUV"
    | "WST"
    | "XAF"
    | "XAG"
    | "XAU"
    | "XBA"
    | "XBB"
    | "XBC"
    | "XBD"
    | "XCD"
    | "XDR"
    | "XFO"
    | "XFU"
    | "XOF"
    | "XPD"
    | "XPF"
    | "XPT"
    | "XTS"
    | "XXX"
    | "YER"
    | "ZAR"
    | "ZMK"
    | "ZWD";
}

export interface FieldOptionsPercent {
  /**
   * Number of decimal places allowed.
   * @min 0
   * @max 5
   */
  precision?: number;
  /** Display as a progress bar. */
  show_as_progress?: boolean;
}

export interface FieldOptionsDuration {
  /**
   * Duration format. Supported options are listed below
   * - `h:mm`
   * - `h:mm:ss`
   * - `h:mm:ss.S`
   * - `h:mm:ss.SS`
   * - `h:mm:ss.SSS`
   */
  format?: string;
}

export interface FieldOptionsDateTime {
  /**
   * Date format. Supported options are listed below
   * - `YYYY/MM/DD`
   * - `YYYY-MM-DD`
   * - `YYYY MM DD`
   * - `DD/MM/YYYY`
   * - `DD-MM-YYYY`
   * - `DD MM YYYY`
   * - `MM/DD/YYYY`
   * - `MM-DD-YYYY`
   * - `MM DD YYYY`
   * - `YYYY-MM`
   * - `YYYY MM`
   */
  date_format?: string;
  /**
   * Time format. Supported options are listed below
   * - `HH:mm`
   * - `HH:mm:ss`
   * - `HH:mm:ss.SSS`
   */
  time_format?: string;
  /** Use 12-hour time format. */
  "12hr_format"?: boolean;
}

export interface FieldOptionsDate {
  /**
   * Date format. Supported options are listed below
   * - `YYYY/MM/DD`
   * - `YYYY-MM-DD`
   * - `YYYY MM DD`
   * - `DD/MM/YYYY`
   * - `DD-MM-YYYY`
   * - `DD MM YYYY`
   * - `MM/DD/YYYY`
   * - `MM-DD-YYYY`
   * - `MM DD YYYY`
   * - `YYYY-MM`
   * - `YYYY MM`
   */
  date_format?: string;
}

export interface FieldOptionsTime {
  /**
   * Time format. Supported options are listed below
   * - `HH:mm`
   * - `HH:mm:ss`
   * - `HH:mm:ss.SSS`
   */
  time_format?: string;
  /** Use 12-hour time format. */
  "12hr_format"?: boolean;
}

export interface FieldOptionsSelect {
  /** @uniqueItems true */
  choices?: {
    /** Choice title. */
    title: string;
    /**
     * Specifies the tile color for the choice using a hexadecimal color code (e.g., `#36BFFF`).
     * @pattern ^#[0-9A-Fa-f]{6}$
     */
    color?: string;
  }[];
}

export interface FieldOptionsRating {
  /**
   * Icon to display rating on the UI. Supported options are listed below
   * - `star`
   * - `heart`
   * - `circle-filled`
   * - `thumbs-up`
   * - `flag`
   */
  icon?: "star" | "heart" | "circle-filled" | "thumbs-up" | "flag";
  /**
   * Maximum value for the rating. Allowed range: 1-10.
   * @min 1
   * @max 10
   */
  max_value?: number;
  /**
   * Specifies icon color using a hexadecimal color code (e.g., `#36BFFF`).
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  color?: string;
}

export interface FieldOptionsCheckbox {
  /**
   * Icon to display checkbox on the UI. Supported options are listed below
   * - `square`
   * - `circle-check`
   * - `circle-filled`
   * - `star`
   * - `heart`
   * - `thumbs-up`
   * - `flag`
   */
  icon?:
    | "square"
    | "circle-check"
    | "circle-filled"
    | "star"
    | "heart"
    | "thumbs-up"
    | "flag";
  /**
   * Specifies icon color using a hexadecimal color code (e.g., `#36BFFF`).
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  color?: string;
}

export interface FieldOptionsBarcode {
  /** Barcode format (e.g., CODE128). */
  format?: string;
  /** Field ID that contains the value. */
  value_field_id?: string;
}

export interface FieldOptionsFormula {
  /** Formula expression. */
  formula?: string;
}

export interface FieldOptionsUser {
  /** Allow selecting multiple users. */
  allow_multiple_users?: boolean;
}

export interface FieldOptionsLookup {
  /** Linked field ID. Can be of type Links or LinkToAnotherRecord */
  link_field_id: string;
  /** Lookup field ID in the linked table. */
  linked_table_lookup_field_id: string;
}

export interface FieldOptionsRollup {
  /** Linked field ID. */
  link_field_id: string;
  /** Rollup field ID in the linked table. */
  linked_table_rollup_field_id: string;
  /** Rollup function. */
  rollup_function:
    | "count"
    | "min"
    | "max"
    | "avg"
    | "sum"
    | "countDistinct"
    | "sumDistinct"
    | "avgDistinct";
}

export type FieldOptionsButton = any;

export interface FieldOptionsLinks {
  /**
   * Type of relationship.
   *
   * Supported options are listed below
   * - `mm` many-to-many
   * - `hm` has-many
   * - `oo` one-to-one
   */
  relation_type: string;
  /** Identifier of the linked table. */
  linked_table_id: string;
}

export interface FieldOptionsLinkToAnotherRecord {
  /**
   * Type of relationship.
   *
   * Supported options are listed below
   * - `mm` many-to-many
   * - `hm` has-many
   * - `oo` one-to-one
   */
  relation_type: string;
  /** Identifier of the linked table. */
  linked_table_id: string;
}

export type Field = FieldBase &
  (
    | {
        type?: "SingleLineText";
      }
    | {
        type?: "LongText";
        options?: FieldOptionsLongText;
      }
    | {
        type?: "PhoneNumber" | "URL" | "Email";
        options?: FieldOptionsPhoneNumber;
      }
    | {
        type?: "Number" | "Decimal";
        options?: FieldOptionsNumber;
      }
    | {
        type?: "JSON";
      }
    | {
        type?: "Currency";
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrency;
      }
    | {
        type?: "Percent";
        options?: FieldOptionsPercent;
      }
    | {
        type?: "Duration";
        options?: FieldOptionsDuration;
      }
    | {
        type?: "Date" | "DateTime" | "Time";
        options?: FieldOptionsDateTime;
      }
    | {
        type?: "SingleSelect" | "MultiSelect";
        options?: FieldOptionsSelect;
      }
    | {
        type?: "Rating" | "Checkbox";
        options?: FieldOptionsRating;
      }
    | {
        type?: "Barcode";
        options?: FieldOptionsBarcode;
      }
    | {
        type?: "Formula";
        options?: FieldOptionsFormula;
      }
    | {
        type?: "User";
        options?: FieldOptionsUser;
      }
    | {
        type?: "Lookup";
        options?: FieldOptionsLookup;
      }
    | {
        type?: "Links";
        options?: FieldOptionsLinks;
      }
    | {
        type?: "LinkToAnotherRecord";
        options?: FieldOptionsLinkToAnotherRecord;
      }
  );

export type FilterCreateUpdate = Filter | FilterGroup;

export type FieldUpdate = FieldBase &
  (
    | {
        type?: "LongText";
        options?: FieldOptionsLongText;
      }
    | {
        type?: "PhoneNumber" | "URL" | "Email";
        options?: FieldOptionsPhoneNumber;
      }
    | {
        type?: "Number" | "Decimal";
        options?: FieldOptionsNumber;
      }
    | {
        type?: "JSON";
      }
    | {
        type?: "Currency";
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrency;
      }
    | {
        type?: "Percent";
        options?: FieldOptionsPercent;
      }
    | {
        type?: "Duration";
        options?: FieldOptionsDuration;
      }
    | {
        type?: "Date" | "DateTime" | "Time";
        options?: FieldOptionsDateTime;
      }
    | {
        type?: "SingleSelect" | "MultiSelect";
        options?: FieldOptionsSelect;
      }
    | {
        type?: "Rating" | "Checkbox";
        options?: FieldOptionsRating;
      }
    | {
        type?: "Barcode";
        options?: FieldOptionsBarcode;
      }
    | {
        type?: "Formula";
        options?: FieldOptionsFormula;
      }
    | {
        type?: "User";
        options?: FieldOptionsUser;
      }
    | {
        type?: "Lookup";
        options?: FieldOptionsLookup;
      }
    | {
        type?: "Links";
        options?: FieldOptionsLinks;
      }
    | {
        type?: "LinkToAnotherRecord";
        options?: FieldOptionsLinkToAnotherRecord;
      }
  );

export interface Filter {
  /** Unique identifier for the filter. */
  id: string;
  /** Parent ID of the filter, specifying this filters group association. */
  parent_id?: string;
  /** Field ID to which this filter applies. Defaults to **root**. */
  field_id: string;
  /** Primary comparison operator (e.g., eq, gt, lt). */
  operator: string;
  /** Secondary comparison operator (if applicable). */
  sub_operator?: string | null;
  /** Value for comparison. */
  value: string | number | boolean | null;
}

export interface FilterListResponse {
  /** List of filter groups. Initial set of filters are mapped to a default group with group-id set to **root**. */
  list: FilterGroup[];
}

export interface FilterGroupLevel3 {
  /** Logical operator for the group. */
  group_operator: "AND" | "OR";
  /** List of filters in this group. */
  filters: Filter[];
}

export interface FilterGroupLevel2 {
  /** Logical operator for the group. */
  group_operator: "AND" | "OR";
  /** List of filters or nested filter groups at level 3. */
  filters: (Filter | FilterGroupLevel3)[];
}

export interface FilterGroupLevel1 {
  /** Logical operator for the group. */
  group_operator: "AND" | "OR";
  /** List of filters or nested filter groups at level 2. */
  filters: (Filter | FilterGroupLevel2)[];
}

export interface FilterGroup {
  /** Unique identifier for the group. */
  id: string;
  /** Parent ID of this filter-group. */
  parent_id?: string;
  /** Logical operator for combining filters in the group. */
  group_operator: "AND" | "OR";
  /** Nested filters or filter groups. */
  filters: (Filter | FilterGroup)[];
}

export type FilterCreate = Filter | FilterGroupLevel1;

export type FilterUpdate = {
  /** Unique identifier for the filter. */
  id: string;
} & (Filter | FilterGroup);

export interface SortListResponse {
  list: Sort[];
}

/**
 * Paginated Model
 * Model for Paginated
 */
export interface Paginated {
  /** URL to access next page */
  next?: string;
  /** URL to access previous page */
  prev?: string;
  /** URL to access current page data with next set of nested fields data */
  nestedNext?: string;
  /** URL to access current page data with previous set of nested fields data */
  nestedPrev?: string;
}

import type {
  AxiosInstance,
  AxiosRequestConfig,
  HeadersDefaults,
  ResponseType,
} from "axios";
import axios from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams
  extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
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
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown>
  extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
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
      baseURL: axiosConfig.baseURL || "http://localhost:8080",
    });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected mergeRequestParams(
    params1: AxiosRequestConfig,
    params2?: AxiosRequestConfig,
  ): AxiosRequestConfig {
    const method = params1.method || (params2 && params2.method);

    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...((method &&
          this.instance.defaults.headers[
            method.toLowerCase() as keyof HeadersDefaults
          ]) ||
          {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected stringifyFormItem(formItem: unknown) {
    if (typeof formItem === "object" && formItem !== null) {
      return JSON.stringify(formItem);
    } else {
      return `${formItem}`;
    }
  }

  protected createFormData(input: Record<string, unknown>): FormData {
    if (input instanceof FormData) {
      return input;
    }
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      const propertyContent: any[] =
        property instanceof Array ? property : [property];

      for (const formItem of propertyContent) {
        const isFileType = formItem instanceof Blob || formItem instanceof File;
        formData.append(
          key,
          isFileType ? formItem : this.stringifyFormItem(formItem),
        );
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
    body,
    ...params
  }: FullRequestParams): Promise<T> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = format || this.format || undefined;

    if (
      type === ContentType.FormData &&
      body &&
      body !== null &&
      typeof body === "object"
    ) {
      body = this.createFormData(body as Record<string, unknown>);
    }

    if (
      type === ContentType.Text &&
      body &&
      body !== null &&
      typeof body !== "string"
    ) {
      body = JSON.stringify(body);
    }

    return this.instance
      .request({
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type ? { "Content-Type": type } : {}),
        },
        params: query,
        responseType: responseFormat,
        data: body,
        url: path,
      })
      .then((response) => response.data);
  };
}

/**
 * @title NocoDB v3
 * @baseUrl http://localhost:8080
 *
 * NocoDB API Documentation
 */
export class InternalApi<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * @description Retrieve a list of bases associated with a specific workspace.
     *
     * @tags Bases
     * @name V3MetaWorkspacesBasesList
     * @summary List bases
     * @request GET:/api/v3/meta/workspaces/{workspaceId}/bases
     */
    v3MetaWorkspacesBasesList: (
      workspaceId: string,
      params: RequestParams = {},
    ) =>
      this.request<Base[], void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/bases`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new base in a specified workspace. The request requires the workspace identifier in the path and base details in the request body.
     *
     * @tags Bases
     * @name V3MetaWorkspacesBasesCreate
     * @summary Create base
     * @request POST:/api/v3/meta/workspaces/{workspaceId}/bases
     */
    v3MetaWorkspacesBasesCreate: (
      workspaceId: string,
      data: BaseCreate,
      params: RequestParams = {},
    ) =>
      this.request<Base, void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/bases`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve meta details of a specific base using its unique identifier.
     *
     * @tags Bases
     * @name V3MetaBasesDetail
     * @summary Get base meta
     * @request GET:/api/v3/meta/bases/{baseId}
     */
    v3MetaBasesDetail: (baseId: string, params: RequestParams = {}) =>
      this.request<Base, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Update properties of a specific base. You can modify fields such as the title and metadata of the base. The baseId parameter identifies the base to be updated, and the new details must be provided in the request body. At least one of title or meta must be provided.
     *
     * @tags Bases
     * @name V3MetaBasesPartialUpdate
     * @summary Update base
     * @request PATCH:/api/v3/meta/bases/{baseId}
     */
    v3MetaBasesPartialUpdate: (
      baseId: string,
      data: BaseUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Base, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a specific base using its unique identifier. Once deleted, the base and its associated data cannot be recovered.
     *
     * @tags Bases
     * @name V3MetaBasesDelete
     * @summary Delete base
     * @request DELETE:/api/v3/meta/bases/{baseId}
     */
    v3MetaBasesDelete: (baseId: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Retrieve list of all tables within the specified base.
     *
     * @tags Tables
     * @name V3MetaBasesTablesList
     * @summary List tables
     * @request GET:/api/v3/meta/bases/{base_id}/tables
     */
    v3MetaBasesTablesList: (baseId: string, params: RequestParams = {}) =>
      this.request<TableList, void>({
        path: `/api/v3/meta/bases/${baseId}/tables`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new table within the specified base by providing the required table details in the request body.
     *
     * @tags Tables
     * @name V3MetaBasesTablesCreate
     * @summary Create table
     * @request POST:/api/v3/meta/bases/{base_id}/tables
     */
    v3MetaBasesTablesCreate: (
      baseId: string,
      data: TableCreate,
      params: RequestParams = {},
    ) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve the details of a specific table.
     *
     * @tags Tables
     * @name V3MetaBasesTablesDetail
     * @summary Get table schema
     * @request GET:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    v3MetaBasesTablesDetail: (
      tableId: string,
      baseId: string,
      params: RequestParams = {},
    ) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Update the details of a specific table.
     *
     * @tags Tables
     * @name V3MetaBasesTablesPartialUpdate
     * @summary Update table
     * @request PATCH:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    v3MetaBasesTablesPartialUpdate: (
      tableId: string,
      baseId: string,
      data: TableUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a specific table.
     *
     * @tags Tables
     * @name V3MetaBasesTablesDelete
     * @summary Delete table
     * @request DELETE:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    v3MetaBasesTablesDelete: (
      tableId: string,
      baseId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Retrieve a list of all views for a specific table.
     *
     * @tags Views
     * @name V3MetaBasesTablesViewsList
     * @summary List views
     * @request GET:/api/v3/meta/bases/{baseId}/tables/{tableId}/views
     */
    v3MetaBasesTablesViewsList: (
      baseId: string,
      tableId: string,
      params: RequestParams = {},
    ) =>
      this.request<
        {
          list: View[];
        },
        void
      >({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}/views`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new field within the specified table.
     *
     * @tags Fields
     * @name V3MetaBasesTablesFieldsCreate
     * @summary Create field
     * @request POST:/api/v3/meta/bases/{baseId}/tables/{tableId}/fields
     */
    v3MetaBasesTablesFieldsCreate: (
      tableId: string,
      baseId: string,
      data: CreateField,
      params: RequestParams = {},
    ) =>
      this.request<CreateField, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}/fields`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve the details of a specific field.
     *
     * @tags Fields
     * @name V3MetaBasesFieldsDetail
     * @summary Get field
     * @request GET:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    v3MetaBasesFieldsDetail: (
      baseId: string,
      fieldId: string,
      params: RequestParams = {},
    ) =>
      this.request<Field, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Update the details of a specific field.
     *
     * @tags Fields
     * @name V3MetaBasesFieldsPartialUpdate
     * @summary Update field
     * @request PATCH:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    v3MetaBasesFieldsPartialUpdate: (
      baseId: string,
      fieldId: string,
      data: FieldUpdate,
      params: RequestParams = {},
    ) =>
      this.request<CreateField, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a specific field.
     *
     * @tags Fields
     * @name V3MetaBasesFieldsDelete
     * @summary Delete field
     * @request DELETE:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    v3MetaBasesFieldsDelete: (
      fieldId: string,
      baseId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Retrieve a list of all filters and groups for a specific view.
     *
     * @tags View Filters
     * @name V3MetaBasesViewsFiltersList
     * @summary List view filters
     * @request GET:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    v3MetaBasesViewsFiltersList: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<FilterListResponse, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new filter or filter-group for a specific view.
     *
     * @tags View Filters
     * @name V3MetaBasesViewsFiltersCreate
     * @summary Create filter
     * @request POST:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    v3MetaBasesViewsFiltersCreate: (
      baseId: string,
      viewId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update the details of an existing filter or group.
     *
     * @tags View Filters
     * @name V3MetaBasesViewsFiltersPartialUpdate
     * @summary Update filter
     * @request PATCH:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    v3MetaBasesViewsFiltersPartialUpdate: (
      baseId: string,
      filterId: string,
      viewId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an existing filter or filter-group.
     *
     * @tags View Filters
     * @name V3MetaBasesViewsFiltersDelete
     * @summary Delete filter
     * @request DELETE:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    v3MetaBasesViewsFiltersDelete: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Replace filters for a specific view. All the existing filters will be overwritten with the new filters specified in this request.
     *
     * @tags View Filters
     * @name V3MetaBasesViewsFiltersUpdate
     * @summary Replace filter
     * @request PUT:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    v3MetaBasesViewsFiltersUpdate: (
      viewId: string,
      baseId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve a list of all sorts for a specific view.
     *
     * @tags View Sorts
     * @name V3MetaBasesViewsSortsList
     * @summary List view sorts
     * @request GET:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    v3MetaBasesViewsSortsList: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<SortListResponse, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new sort for a specific view.
     *
     * @tags View Sorts
     * @name V3MetaBasesViewsSortsCreate
     * @summary Add sort
     * @request POST:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    v3MetaBasesViewsSortsCreate: (
      baseId: string,
      viewId: string,
      data: SortCreate,
      params: RequestParams = {},
    ) =>
      this.request<Sort, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an existing sort.
     *
     * @tags View Sorts
     * @name V3MetaBasesViewsSortsDelete
     * @summary Delete sort
     * @request DELETE:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    v3MetaBasesViewsSortsDelete: (
      baseId: string,
      sortId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Update the details of an existing sort.
     *
     * @tags View Sorts
     * @name V3MetaBasesViewsSortsPartialUpdate
     * @summary Update sort
     * @request PATCH:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    v3MetaBasesViewsSortsPartialUpdate: (
      baseId: string,
      sortId: string,
      viewId: string,
      data: SortUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Sort, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve a list of users associated with a specific base.
     *
     * @tags Base Users
     * @name V3MetaBasesUsersList
     * @summary List base users
     * @request GET:/api/v3/meta/bases/{base_id}/users
     */
    v3MetaBasesUsersList: (baseId: string, params: RequestParams = {}) =>
      this.request<BaseUserList, void>({
        path: `/api/v3/meta/bases/${baseId}/users`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Invite new users to a specific base using their email address.
     *
     * @tags Base Users
     * @name V3MetaBasesUsersCreate
     * @summary Invite users to a base
     * @request POST:/api/v3/meta/bases/{base_id}/users
     */
    v3MetaBasesUsersCreate: (
      baseId: string,
      data: BaseUserCreate,
      params: RequestParams = {},
    ) =>
      this.request<BaseUser[], void>({
        path: `/api/v3/meta/bases/${baseId}/users`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update roles for existing users in a base.
     *
     * @tags Base Users
     * @name V3MetaBasesUsersPartialUpdate
     * @summary Update users in a base
     * @request PATCH:/api/v3/meta/bases/{base_id}/users
     */
    v3MetaBasesUsersPartialUpdate: (
      baseId: string,
      data: BaseUserUpdate,
      params: RequestParams = {},
    ) =>
      this.request<BaseUser[], void>({
        path: `/api/v3/meta/bases/${baseId}/users`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Remove users from a specific base using their IDs.
     *
     * @tags Base Users
     * @name V3MetaBasesUsersDelete
     * @summary Delete users from a base
     * @request DELETE:/api/v3/meta/bases/{base_id}/users
     */
    v3MetaBasesUsersDelete: (
      baseId: string,
      data: BaseUserDelete,
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /** Indicates if the operation was successful. */
          success?: boolean;
          /** List of successfully deleted users. */
          deleted_users?: BaseUserDeleteRequest[];
        },
        void
      >({
        path: `/api/v3/meta/bases/${baseId}/users`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve records from a specified table. You can customize the response by applying various query parameters for filtering, sorting, and formatting. **Pagination**: The response is paginated by default, with the first page being returned initially. The response includes the following additional information in the `pageInfo` JSON block: - **next**: Contains the URL to retrieve the next page of records. For example, `"https://staging.noco.ws/api/v3/tables/medhonywr18cysz/records?page=2"` points to the next page of records. - If there are no more records available (you are on the last page), this attribute will be _null_. The `pageInfo` attribute is particularly valuable when working with large datasets divided into multiple pages. It provides the necessary URL to seamlessly fetch subsequent pages, enabling efficient navigation through the dataset.
     *
     * @tags Table Records
     * @name DbDataTableRowList
     * @summary List Table Records
     * @request GET:/api/v3/{baseId}/{tableId}
     */
    dbDataTableRowList: (
      baseId: string,
      tableId: string,
      query?: {
        /**
         * Allows you to specify the fields that you wish to include in your API response. By default, all the fields are included in the response.
         *
         * Example: `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         *
         * Please note that it's essential not to include spaces between field names in the comma-separated list. Alternatively, multiple `fields` query params can also works, ex: `?fields=field1&fields=field2`.
         */
        fields?: string;
        /**
         * Allows you to specify the fields by which you want to sort the records in your API response. By default, sorting is done in ascending order for the designated fields. To sort in descending order, add a '-' symbol before the field name.
         *
         * Example: `sort=field1,-field2` will sort the records first by 'field1' in ascending order and then by 'field2' in descending order.
         *
         * If `viewId` query parameter is also included, the sort included here will take precedence over any sorting configuration defined in the view.
         *
         * Please note that it's essential not to include spaces between field names in the comma-separated list.
         */
        sort?: string;
        /**
         * Enables you to define specific conditions for filtering records in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.
         *
         * Example: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'.
         *
         * You can also use other comparison operators like 'ne' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * If `viewId` query parameter is also included, then the filters included here will be applied over the filtering configuration defined in the view.
         *
         * Please remember to maintain the specified format, and do not include spaces between the different condition components
         */
        where?: string;
        /**
         * Enables you to control the pagination of your API response by specifying the page number you want to retrieve. By default, the first page is returned. If you want to retrieve the next page, you can increment the page number by one.
         *
         * Example: `page=2` will return the second page of records in the dataset.
         * @min 1
         */
        page?: number;
        /**
         * Enables you to control the pagination of your nested data (linked records) in API response by specifying the page number you want to retrieve. By default, the first page is returned. If you want to retrieve the next page, you can increment the page number by one.
         *
         * Example: `page=2` will return the second page of nested data records in the dataset.
         * @min 1
         */
        nestedPage?: number;
        /**
         * Enables you to set a limit on the number of records you want to retrieve in your API response. By default, your response includes all the available records, but by using this parameter, you can control the quantity you receive.
         *
         * Example: `limit=100` will constrain your response to the first 100 records in the dataset.
         * @min 1
         */
        limit?: number;
        /**
         * ***View Identifier***. Allows you to fetch records that are currently visible within a specific view. API retrieves records in the order they are displayed if the SORT option is enabled within that view.
         *
         * Additionally, if you specify a `sort` query parameter, it will take precedence over any sorting configuration defined in the view. If you specify a `where` query parameter, it will be applied over the filtering configuration defined in the view.
         *
         * By default, all fields, including those that are disabled within the view, are included in the response. To explicitly specify which fields to include or exclude, you can use the `fields` query parameter to customize the output according to your requirements.
         */
        viewId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /** List of data objects */
          list: object[];
          /** Paginated Info */
          pageInfo: Paginated;
        },
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows the creation of new records within a specified table. Records to be inserted are input as an array of key-value pair objects, where each key corresponds to a field name. Ensure that all the required fields are included in the payload, with exceptions for fields designated as auto-increment or those having default values. Certain read-only field types will be disregarded if included in the request. These field types include Look Up, Roll Up, Formula, Created By, Updated By, Created At, Updated At, Button, Barcode and QR Code. For **Attachment** field types, this API cannot be used. Instead, utilize the storage APIs for managing attachments. Support for attachment fields in the record update API will be added soon.
     *
     * @tags Table Records
     * @name DbDataTableRowCreate
     * @summary Create Table Records
     * @request POST:/api/v3/{baseId}/{tableId}
     */
    dbDataTableRowCreate: (
      baseId: string,
      tableId: string,
      data: object | object[],
      params: RequestParams = {},
    ) =>
      this.request<
        FieldOptions,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows updating existing records within a specified table identified by an array of Record-IDs, serving as unique identifier for the record. Records to be updated are input as an array of key-value pair objects, where each key corresponds to a field name. Ensure that all the required fields are included in the payload, with exceptions for fields designated as auto-increment or those having default values. Certain read-only field types will be disregarded if included in the request. These field types include Look Up, Roll Up, Formula, Created By, Updated By, Created At, Updated At, Button, Barcode and QR Code. For **Link to another record** field type if specified, all the existing links will be removed & the one's specified in this payload will be inserted. For **Attachment** field types, this API cannot be used. Instead, utilize the storage APIs for managing attachments. Support for attachment fields in the record insert API will be added soon. Note that a PATCH request only updates the specified fields while leaving other fields unaffected. Currently, PUT requests are not supported by this endpoint.
     *
     * @tags Table Records
     * @name DbDataTableRowUpdate
     * @summary Update Table Records
     * @request PATCH:/api/v3/{baseId}/{tableId}
     */
    dbDataTableRowUpdate: (
      baseId: string,
      tableId: string,
      data: object | object[],
      params: RequestParams = {},
    ) =>
      this.request<
        FieldOptions,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows deleting existing records within a specified table identified by an array of Record-IDs, serving as unique identifier for the record. Records to be deleted are input as an array of record-identifiers.
     *
     * @tags Table Records
     * @name DbDataTableRowDelete
     * @summary Delete Table Records
     * @request DELETE:/api/v3/{baseId}/{tableId}
     */
    dbDataTableRowDelete: (
      baseId: string,
      tableId: string,
      data: object | object[],
      params: RequestParams = {},
    ) =>
      this.request<
        FieldOptions,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve a single record identified by Record-ID, serving as unique identifier for the record from a specified table.
     *
     * @tags Table Records
     * @name DbDataTableRowRead
     * @summary Read Table Record
     * @request GET:/api/v3/{baseId}/{tableId}/{recordId}
     */
    dbDataTableRowRead: (
      baseId: string,
      tableId: string,
      recordId: string,
      query?: {
        /**
         * Allows you to specify the fields that you wish to include in your API response. By default, all the fields are included in the response.
         *
         * Example: `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         *
         * Please note that it's essential not to include spaces between field names in the comma-separated list.
         */
        fields?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        object,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}/${recordId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve the total number of records from a specified table or a view. You can narrow down search results by applying `where` query parameter
     *
     * @tags Table Records
     * @name DbDataTableRowCount
     * @summary Count Table Records
     * @request GET:/api/v3/{baseId}/{tableId}/count
     */
    dbDataTableRowCount: (
      baseId: string,
      tableId: string,
      query?: {
        /** **View Identifier**. Allows you to fetch record count that are currently visible within a specific view. */
        viewId?: string;
        /**
         * Enables you to define specific conditions for filtering record count in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.
         *
         * Example: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'.
         *
         * You can also use other comparison operators like 'ne' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * If `viewId` query parameter is also included, then the filters included here will be applied over the filtering configuration defined in the view.
         *
         * Please remember to maintain the specified format, and do not include spaces between the different condition components
         */
        where?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        {
          count?: number;
        },
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}/count`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve list of linked records for a specific `Link to another record field` and `Record ID`. The response is an array of objects containing Primary Key and its corresponding display value.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedList
     * @summary List Linked Records
     * @request GET:/api/v3/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
     */
    dbDataTableRowNestedList: (
      tableId: string,
      linkFieldId: string,
      recordId: string,
      baseId: string,
      query?: {
        /**
         * Allows you to specify the fields that you wish to include from the linked records in your API response. By default, only Primary Key and associated display value field is included.
         *
         * Example: `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         *
         * Please note that it's essential not to include spaces between field names in the comma-separated list.
         */
        fields?: string;
        /**
         * Allows you to specify the fields by which you want to sort linked records in your API response. By default, sorting is done in ascending order for the designated fields. To sort in descending order, add a '-' symbol before the field name.
         *
         * Example: `sort=field1,-field2` will sort the records first by 'field1' in ascending order and then by 'field2' in descending order.
         *
         * Please note that it's essential not to include spaces between field names in the comma-separated list.
         */
        sort?: string;
        /**
         * Enables you to define specific conditions for filtering linked records in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.
         *
         * Example: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter linked records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'.
         *
         * You can also use other comparison operators like 'ne' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * Please remember to maintain the specified format, and do not include spaces between the different condition components
         */
        where?: string;
        /**
         * Enables you to control the pagination of your API response by specifying the page number you want to retrieve. By default, the first page is returned. If you want to retrieve the next page, you can increment the page number by one.
         *
         * Example: `page=2` will return the second page of linked records in the dataset.
         * @min 0
         */
        page?: number;
        /**
         * Enables you to set a limit on the number of linked records you want to retrieve in your API response. By default, your response includes all the available linked records, but by using this parameter, you can control the quantity you receive.
         *
         * Example: `limit=100` will constrain your response to the first 100 linked records in the dataset.
         * @min 1
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /** List of data objects */
          list: object[];
          /** Paginated Info */
          pageInfo: Paginated;
        },
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to link records to a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for linking purposes. Note that any existing links, if present, will be unaffected during this operation.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedLink
     * @summary Link Records
     * @request POST:/api/v3/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
     */
    dbDataTableRowNestedLink: (
      tableId: string,
      linkFieldId: string,
      recordId: string,
      baseId: string,
      data: object | object[],
      params: RequestParams = {},
    ) =>
      this.request<
        FieldOptions,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description This API endpoint allows you to unlink records from a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for unlinking purposes. Note that, - duplicated record-ids will be ignored. - non-existent record-ids will be ignored.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedUnlink
     * @summary Unlink Records
     * @request DELETE:/api/v3/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
     */
    dbDataTableRowNestedUnlink: (
      tableId: string,
      linkFieldId: string,
      recordId: string,
      baseId: string,
      data: object[],
      params: RequestParams = {},
    ) =>
      this.request<
        FieldOptions,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
