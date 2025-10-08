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
  WorkspaceLevelOwner = 'workspace-level-owner',
  WorkspaceLevelCreator = 'workspace-level-creator',
  WorkspaceLevelEditor = 'workspace-level-editor',
  WorkspaceLevelViewer = 'workspace-level-viewer',
  WorkspaceLevelCommenter = 'workspace-level-commenter',
  WorkspaceLevelNoAccess = 'workspace-level-no-access',
}

/** Base roles for the user. */
export enum BaseRoles {
  Owner = 'owner',
  Creator = 'creator',
  Editor = 'editor',
  Viewer = 'viewer',
  Commenter = 'commenter',
  NoAccess = 'no-access',
}

export enum ViewAggregationEnum {
  Sum = 'sum',
  Min = 'min',
  Max = 'max',
  Avg = 'avg',
  Median = 'median',
  StdDev = 'std_dev',
  Range = 'range',
  Count = 'count',
  CountEmpty = 'count_empty',
  CountFilled = 'count_filled',
  CountUnique = 'count_unique',
  PercentEmpty = 'percent_empty',
  PercentFilled = 'percent_filled',
  PercentUnique = 'percent_unique',
  None = 'none',
  AttachmentSize = 'attachment_size',
  Checked = 'checked',
  Unchecked = 'unchecked',
  PercentChecked = 'percent_checked',
  PercentUnchecked = 'percent_unchecked',
  EarliestDate = 'earliest_date',
  LatestDate = 'latest_date',
  DateRange = 'date_range',
  MonthRange = 'month_range',
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

export interface BaseWithMembers {
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
  individual_members?: {
    base_members?: BaseMemberWithWorkspaceRole[];
    workspace_members?: WorkspaceMember[];
  };
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

export type CreateField = FieldBaseCreate;

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

export interface BaseMember {
  /** Unique identifier for the user. */
  user_id: string;
  /**
   * Email address of the user.
   * @format email
   */
  email: string;
  /** Display name of the user. */
  user_name?: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
}

export interface BaseMemberWithWorkspaceRole {
  /** Unique identifier for the user. */
  user_id: string;
  /**
   * Email address of the user.
   * @format email
   */
  email: string;
  /** Display name of the user. */
  user_name?: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
  /** Role assigned to the user in the workspace */
  workspace_role?: WorkspaceRoles;
}

export type BaseUserDeleteRequest = any;

export interface BaseMemberList {
  list?: BaseMember[];
}

/** Array of members to be created. */
export type BaseMemberCreate = ((
  | {
      /** Unique identifier for the user (skip if email is provided) */
      user_id: string;
      /** Full name of the user. */
      user_name?: string;
    }
  | {
      /**
       * Email address of the user (skip if user_id is provided)
       * @format email
       */
      email: string;
      /** Full name of the user. */
      user_name?: string;
    }
) & {
  /** Base roles for the user. */
  base_role: BaseRoles;
})[];

/** Array of member updates. */
export type BaseMemberUpdate = {
  /** Unique user identifier for the member. */
  user_id: string;
  /** Base roles for the user. */
  base_role: BaseRoles;
}[];

export type BaseMemberDelete = {
  /** User unique identifier for the member. */
  user_id: string;
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
  /** Unique identifier for the sort. */
  id: string;
  /**
   * Identifier for the field being sorted.
   * @format uuid
   */
  field_id: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction: 'asc' | 'desc';
}

export interface SortCreate {
  /** Identifier for the field being sorted. */
  field_id: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction?: 'asc' | 'desc';
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
  direction?: 'asc' | 'desc';
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
  view_type?: 'grid' | 'gallery' | 'kanban' | 'calendar' | 'form';
}

export interface ViewList {
  list: {
    /** Unique identifier for the view. */
    id: string;
    /** Id of table associated with the view. */
    table_id?: string;
    /** Title of the view. */
    title: string;
    /** Description of the view. */
    description?: string | null;
    /** Type of the view. */
    type: 'grid' | 'gallery' | 'kanban' | 'calendar' | 'form';
    /** View configuration edit state. */
    lock_type: 'collaborative' | 'locked' | 'personal';
    /** Indicates if this is the default view. */
    is_default?: boolean;
    /** User ID of the creator. */
    created_by: string;
    /** User ID of the owner. Applicable only for personal views. */
    owned_by?: string;
    /**
     * Timestamp of creation.
     * @format date-time
     */
    created_at: string;
    /**
     * Timestamp of last update.
     * @format date-time
     */
    updated_at: string;
  }[];
}

export interface ViewBase {
  /** Title of the view. */
  title: string;
  /**
   * Type of the view.
   *
   * Note: Form view via API is not supported currently
   */
  type: 'grid' | 'gallery' | 'kanban' | 'calendar';
  /**
   * Lock type of the view.
   *
   *  Note: Assigning view as personal using API is not supported currently
   * @default "collaborative"
   */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Description of the view. */
  description?: string;
}

export interface ViewBaseInUpdate {
  /** Title of the view. */
  title?: string;
  /**
   * Lock type of the view.
   *
   *  Note: Assigning view as personal using API is not supported currently
   * @default "collaborative"
   */
  lock_type?: 'collaborative' | 'locked' | 'personal';
  /** Description of the view. */
  description?: string;
}

/**
 * List of fields to be displayed in the view.
 *
 * - If not specified, all fields are displayed by default.
 * - If an empty array is provided, only the display value field will be shown.
 * - In case of partial list, fields not included in the list will be excluded from the view.
 */
export type ViewFields = {
  /** Unique identifier for the field. */
  field_id: string;
  /** Indicates whether the field should be displayed in the view. */
  show: boolean;
  /**
   * Width of the field in pixels.
   *
   *  **Applicable only for grid view.**
   */
  width?: number;
  /**
   * Aggregation function to be applied to the field.
   *
   *  **Applicable only for grid view.**
   */
  aggregation?: ViewAggregationEnum;
}[];

export type ViewRowColour =
  | {
      /** Mode of row coloring. In this mode, the color is selected based on conditions applied to the fields. */
      mode: 'filter';
      conditions: {
        apply_as_row_background?: boolean;
        color?: string;
        filters?: FilterCreateUpdate;
      }[];
    }
  | {
      /** Mode of row coloring. In this mode, the color is selected based on a single select field. */
      mode: 'select';
      /** Single select field ID to be used for colouring rows in the view. */
      field_id: string;
      /** Whether to additionally apply the color as row background. */
      apply_as_row_background?: boolean;
    };

export interface ViewOptionsGrid {
  /** List of groups to be applied on the grid view. */
  groups?: {
    /** Identifier for the field being sorted. */
    field_id: string;
    /**
     * Direction of the group, either 'asc' (ascending) or 'desc' (descending).
     * @default "asc"
     */
    direction?: 'asc' | 'desc';
  }[];
  /**
   * Height of the rows in the grid view.
   * @default "short"
   */
  row_height?: 'short' | 'medium' | 'tall' | 'extra';
}

export interface ViewOptionsKanban {
  stack_by: {
    /** Single select field ID to be used for stacking cards in kanban view. */
    field_id: string;
    /**
     * Order of the stacks in kanban view. If not provided, the order will be determined by options listed in associated field.
     *
     * Example: ```stack_order: ['option1', 'option2', 'option3']```
     */
    stack_order?: string[];
  };
  /** Attachment field ID to be used as cover image in kanban view. If not provided, cover field configuration is skipped. */
  cover_field_id?: string;
}

export interface ViewOptionsCalendar {
  date_ranges: {
    /** Date field ID to be used as start date in calendar view. */
    start_date_field_id: string;
    /** Date field ID to be used as end date in calendar view. */
    end_date_field_id?: string;
  }[];
}

export interface ViewOptionsGallery {
  /** Attachment field ID to be used as cover image in gallery view. Is optional, if not provided, the first attachment field will be used. */
  cover_field_id?: string;
}

export interface ViewOptionsForm {
  /** Heading for the form. */
  form_title?: string;
  /** Subheading for the form. */
  form_description?: string;
  /** Success message shown after form submission. */
  thank_you_message?: string;
  /** Seconds to wait before redirecting. */
  form_redirect_after_secs?: number;
  /** Whether to show another form after submission. */
  show_submit_another_button?: boolean;
  /** Whether to show a blank form after submission. */
  reset_form_after_submit?: boolean;
  /** Whether to hide the banner on the form. */
  form_hide_banner?: boolean;
  /** Whether to hide branding on the form. */
  form_hide_branding?: boolean;
  /**
   * URL of the banner image for the form.
   * @format uri
   */
  banner?: string;
  /**
   * URL of the logo for the form.
   * @format uri
   */
  logo?: string;
  /**
   * Background color for the form.
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  form_background_color?: string;
  /**
   * URL to redirect to after form submission.
   * @format uri
   */
  redirect_url?: string;
}

export type ViewCreate = ViewBase &
  (
    | {
        type?: 'grid';
        options?: ViewOptionsGrid;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'gallery';
        options?: ViewOptionsGallery;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'kanban';
        options: ViewOptionsKanban;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'calendar';
        options: ViewOptionsCalendar;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
  );

export type ViewUpdate = ViewBaseInUpdate &
  (
    | {
        options?: ViewOptionsGrid;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        options?: ViewOptionsGallery;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        options?: ViewOptionsKanban;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        options?: ViewOptionsCalendar;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
  );

export type View = {
  /** Unique identifier for the view. */
  id: string;
  /** Id of table associated with the view. */
  table_id?: string;
  /** Indicates if this is the default view. Omitted if not the default view. */
  is_default?: boolean;
} & ViewBase & {
    /** User ID of the creator. */
    created_by?: string;
    /** User ID of the owner. */
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
  } & (
    | {
        type?: 'grid';
        options?: ViewOptionsGrid;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'gallery';
        options?: ViewOptionsGallery;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'kanban';
        options: ViewOptionsKanban;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
    | {
        type?: 'calendar';
        options: ViewOptionsCalendar;
        /** List of sorts to be applied to the view. */
        sorts?: SortCreate[];
        filters?: FilterCreateUpdate;
        /**
         * List of fields to be displayed in the view.
         *
         * - If not specified, all fields are displayed by default.
         * - If an empty array is provided, only the display value field will be shown.
         * - In case of partial list, fields not included in the list will be excluded from the view.
         */
        fields?: ViewFields;
        /** Row colour configuration for the the view. */
        row_coloring?: ViewRowColour;
      }
  );

export interface FieldBase {
  /** Unique identifier for the field. */
  id?: string;
  /** Title of the field. */
  title: string;
  /** Field data type. */
  type?:
    | 'SingleLineText'
    | 'LongText'
    | 'PhoneNumber'
    | 'URL'
    | 'Email'
    | 'Number'
    | 'Decimal'
    | 'Currency'
    | 'Percent'
    | 'Duration'
    | 'Date'
    | 'DateTime'
    | 'Time'
    | 'SingleSelect'
    | 'MultiSelect'
    | 'Rating'
    | 'Checkbox'
    | 'Attachment'
    | 'Geometry'
    | 'Links'
    | 'Lookup'
    | 'Rollup'
    | 'Button'
    | 'Formula'
    | 'Barcode'
    | 'Year'
    | 'QrCode'
    | 'CreatedTime'
    | 'LastModifiedTime'
    | 'CreatedBy'
    | 'LastModifiedBy'
    | 'LinkToAnotherRecord'
    | 'User'
    | 'JSON';
  /** Description of the field. */
  description?: string | null;
  /** Default value for the field. Applicable for SingleLineText, LongText, PhoneNumber, URL, Email, Number, Decimal, Currency, Percent, Duration, Date, DateTime, Time, SingleSelect, MultiSelect, Rating, Checkbox, User and JSON fields. */
  default_value?: string | boolean | number;
}

export type FieldBaseCreate = FieldBase;

/** LongText */
export interface FieldOptionsLongText {
  /** Enable rich text formatting. */
  rich_text?: boolean;
  /** Enable text generation for this field using NocoAI. */
  generate_text_using_ai?: boolean;
}

/** PhoneNumber */
export interface FieldOptionsPhoneNumber {
  /** Enable validation for phone numbers. */
  validation?: boolean;
}

/** URL */
export interface FieldOptionsURL {
  /** Enable validation for URL. */
  validation?: boolean;
}

/** Email */
export interface FieldOptionsEmail {
  /** Enable validation for Email. */
  validation?: boolean;
}

/** Number */
export interface FieldOptionsNumber {
  /** Show thousand separator on the UI. */
  locale_string?: boolean;
}

/** Decimal */
export interface FieldOptionsDecimal {
  /**
   * Decimal field precision. Defaults to 0
   * @min 0
   * @max 5
   */
  precision?: number;
}

/**
 * Currency
 * Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD`
 */
export interface FieldOptionsCurrency {
  /** Locale for currency formatting. Refer https://simplelocalize.io/data/locales/ */
  locale?: string;
  /** Currency code. Refer https://simplelocalize.io/data/locales/ */
  code?:
    | 'AED'
    | 'AFN'
    | 'ALL'
    | 'AMD'
    | 'ANG'
    | 'AOA'
    | 'ARS'
    | 'AUD'
    | 'AWG'
    | 'AZN'
    | 'BAM'
    | 'BBD'
    | 'BDT'
    | 'BGN'
    | 'BHD'
    | 'BIF'
    | 'BMD'
    | 'BND'
    | 'BOB'
    | 'BOV'
    | 'BRL'
    | 'BSD'
    | 'BTN'
    | 'BWP'
    | 'BYR'
    | 'BZD'
    | 'CAD'
    | 'CDF'
    | 'CHE'
    | 'CHF'
    | 'CHW'
    | 'CLF'
    | 'CLP'
    | 'CNY'
    | 'COP'
    | 'COU'
    | 'CRC'
    | 'CUP'
    | 'CVE'
    | 'CYP'
    | 'CZK'
    | 'DJF'
    | 'DKK'
    | 'DOP'
    | 'DZD'
    | 'EEK'
    | 'EGP'
    | 'ERN'
    | 'ETB'
    | 'EUR'
    | 'FJD'
    | 'FKP'
    | 'GBP'
    | 'GEL'
    | 'GHC'
    | 'GIP'
    | 'GMD'
    | 'GNF'
    | 'GTQ'
    | 'GYD'
    | 'HKD'
    | 'HNL'
    | 'HRK'
    | 'HTG'
    | 'HUF'
    | 'IDR'
    | 'ILS'
    | 'INR'
    | 'IQD'
    | 'IRR'
    | 'ISK'
    | 'JMD'
    | 'JOD'
    | 'JPY'
    | 'KES'
    | 'KGS'
    | 'KHR'
    | 'KMF'
    | 'KPW'
    | 'KRW'
    | 'KWD'
    | 'KYD'
    | 'KZT'
    | 'LAK'
    | 'LBP'
    | 'LKR'
    | 'LRD'
    | 'LSL'
    | 'LTL'
    | 'LVL'
    | 'LYD'
    | 'MAD'
    | 'MDL'
    | 'MGA'
    | 'MKD'
    | 'MMK'
    | 'MNT'
    | 'MOP'
    | 'MRO'
    | 'MTL'
    | 'MUR'
    | 'MVR'
    | 'MWK'
    | 'MXN'
    | 'MXV'
    | 'MYR'
    | 'MZN'
    | 'NAD'
    | 'NGN'
    | 'NIO'
    | 'NOK'
    | 'NPR'
    | 'NZD'
    | 'OMR'
    | 'PAB'
    | 'PEN'
    | 'PGK'
    | 'PHP'
    | 'PKR'
    | 'PLN'
    | 'PYG'
    | 'QAR'
    | 'ROL'
    | 'RON'
    | 'RSD'
    | 'RUB'
    | 'RWF'
    | 'SAR'
    | 'SBD'
    | 'SCR'
    | 'SDD'
    | 'SEK'
    | 'SGD'
    | 'SHP'
    | 'SIT'
    | 'SKK'
    | 'SLL'
    | 'SOS'
    | 'SRD'
    | 'STD'
    | 'SYP'
    | 'SZL'
    | 'THB'
    | 'TJS'
    | 'TMM'
    | 'TND'
    | 'TOP'
    | 'TRY'
    | 'TTD'
    | 'TWD'
    | 'TZS'
    | 'UAH'
    | 'UGX'
    | 'USD'
    | 'USN'
    | 'USS'
    | 'UYU'
    | 'UZS'
    | 'VEB'
    | 'VND'
    | 'VUV'
    | 'WST'
    | 'XAF'
    | 'XAG'
    | 'XAU'
    | 'XBA'
    | 'XBB'
    | 'XBC'
    | 'XBD'
    | 'XCD'
    | 'XDR'
    | 'XFO'
    | 'XFU'
    | 'XOF'
    | 'XPD'
    | 'XPF'
    | 'XPT'
    | 'XTS'
    | 'XXX'
    | 'YER'
    | 'ZAR'
    | 'ZMK'
    | 'ZWD';
}

/** Percent */
export interface FieldOptionsPercent {
  /** Display as a progress bar. */
  show_as_progress?: boolean;
}

/** Duration */
export interface FieldOptionsDuration {
  /**
   * Duration format. Supported options are listed below
   * - `h:mm`
   * - `h:mm:ss`
   * - `h:mm:ss.S`
   * - `h:mm:ss.SS`
   * - `h:mm:ss.SSS`
   */
  duration_format?: string;
}

/** DateTime */
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
  '12hr_format'?: boolean;
  /** Display timezone. */
  display_timezone?: boolean;
  /** Timezone. Refer to https://en.wikipedia.org/wiki/List_of_tz_database_time_zones */
  timezone?: string;
  /** Use same timezone for all records. */
  use_same_timezone_for_all?: boolean;
}

/** Date */
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

/** Time */
export interface FieldOptionsTime {
  /** Use 12-hour time format. */
  '12hr_format'?: boolean;
}

/** Single & MultiSelect */
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

/** Rating */
export interface FieldOptionsRating {
  /**
   * Icon to display rating on the UI. Supported options are listed below
   * - `star`
   * - `heart`
   * - `circle-filled`
   * - `thumbs-up`
   * - `flag`
   */
  icon?: 'star' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag';
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

/** Checkbox */
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
    | 'square'
    | 'circle-check'
    | 'circle-filled'
    | 'star'
    | 'heart'
    | 'thumbs-up'
    | 'flag';
  /**
   * Specifies icon color using a hexadecimal color code (e.g., `#36BFFF`).
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  color?: string;
}

/** Barcode */
export interface FieldOptionsBarcode {
  /** Barcode format (e.g., CODE128). */
  format?: string;
  /** Field ID that contains the value. */
  barcode_value_field_id?: string;
}

/** QrCode */
export interface FieldOptionsQrCode {
  /** Field ID that contains the value. */
  qrcode_value_field_id?: string;
}

/** Formula */
export interface FieldOptionsFormula {
  /** Formula expression. */
  formula?: string;
}

/** User */
export interface FieldOptionsUser {
  /** Allow selecting multiple users. */
  allow_multiple_users?: boolean;
}

/** Lookup */
export interface FieldOptionsLookup {
  /** Linked field ID. Can be of type Links or LinkToAnotherRecord */
  related_field_id: string;
  /** Lookup field ID in the linked table. */
  related_table_lookup_field_id: string;
}

/** Rollup */
export interface FieldOptionsRollup {
  /** Linked field ID. */
  related_field_id: string;
  /** Rollup field ID in the linked table. */
  related_table_rollup_field_id: string;
  /** Rollup function. */
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

/** Button */
export type FieldOptionsButton = BaseFieldOptionsButton &
  (
    | BaseFieldOptionsButtonTypeMapping<'formula', any>
    | BaseFieldOptionsButtonTypeMapping<'webhook', any>
    | BaseFieldOptionsButtonTypeMapping<'ai', any>
  );

/** Links */
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
  related_table_id: string;
}

/** LinkToAnotherRecord */
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
  related_table_id: string;
}

export type Field = FieldBase &
  (
    | {
        type?: 'SingleLineText';
      }
    | {
        type?: 'LongText';
        options?: FieldOptionsLongText;
      }
    | {
        type?: 'PhoneNumber' | 'URL' | 'Email';
        options?: FieldOptionsPhoneNumber;
      }
    | {
        type?: 'Number' | 'Decimal';
        options?: FieldOptionsNumber;
      }
    | {
        type?: 'JSON';
      }
    | {
        type?: 'Currency';
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrency;
      }
    | {
        type?: 'Percent';
        options?: FieldOptionsPercent;
      }
    | {
        type?: 'Duration';
        options?: FieldOptionsDuration;
      }
    | {
        type?: 'Date' | 'DateTime' | 'Time';
        options?: FieldOptionsDateTime;
      }
    | {
        type?: 'SingleSelect' | 'MultiSelect';
        options?: FieldOptionsSelect;
      }
    | {
        type?: 'Rating' | 'Checkbox';
        options?: FieldOptionsRating;
      }
    | {
        type?: 'Barcode';
        options?: FieldOptionsBarcode;
      }
    | {
        type?: 'Formula';
        options?: FieldOptionsFormula;
      }
    | {
        type?: 'User';
        options?: FieldOptionsUser;
      }
    | {
        type?: 'Lookup';
        options?: FieldOptionsLookup;
      }
    | {
        type?: 'Links';
        options?: FieldOptionsLinks;
      }
    | {
        type?: 'LinkToAnotherRecord';
        options?: FieldOptionsLinkToAnotherRecord;
      }
  );

export type FilterCreateUpdate = Filter | FilterGroup;

export type FieldUpdate = FieldBase &
  (
    | {
        type?: 'LongText';
        options?: FieldOptionsLongText;
      }
    | {
        type?: 'PhoneNumber' | 'URL' | 'Email';
        options?: FieldOptionsPhoneNumber;
      }
    | {
        type?: 'Number' | 'Decimal';
        options?: FieldOptionsNumber;
      }
    | {
        type?: 'JSON';
      }
    | {
        type?: 'Currency';
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrency;
      }
    | {
        type?: 'Percent';
        options?: FieldOptionsPercent;
      }
    | {
        type?: 'Duration';
        options?: FieldOptionsDuration;
      }
    | {
        type?: 'Date' | 'DateTime' | 'Time';
        options?: FieldOptionsDateTime;
      }
    | {
        type?: 'SingleSelect' | 'MultiSelect';
        options?: FieldOptionsSelect;
      }
    | {
        type?: 'Checkbox';
        options?: FieldOptionsCheckbox;
      }
    | {
        type?: 'Rating';
        options?: FieldOptionsRating;
      }
    | {
        type?: 'Barcode';
        options?: FieldOptionsBarcode;
      }
    | {
        type?: 'Formula';
        options?: FieldOptionsFormula;
      }
    | {
        type?: 'User';
        options?: FieldOptionsUser;
      }
    | {
        type?: 'Lookup';
        options?: FieldOptionsLookup;
      }
    | {
        type?: 'Links';
        options?: FieldOptionsLinks;
      }
    | {
        type?: 'LinkToAnotherRecord';
        options?: FieldOptionsLinkToAnotherRecord;
      }
  );

/** Filter */
export interface Filter {
  /** Unique identifier for the filter. */
  id?: string;
  /** Parent ID of the filter, specifying this filters group association. Defaults to **root**. */
  parent_id?: string;
  /** Field ID to which this filter applies. */
  field_id: string;
  /** Primary comparison operator (e.g., eq, gt, lt). */
  operator: string;
  /** Secondary comparison operator (if applicable). */
  sub_operator?: string | null;
  /** Value for comparison. */
  value?: string | number | boolean | null;
}

export interface FilterListResponse {
  /** List of filter groups. Initial set of filters are mapped to a default group with group-id set to **root**. */
  list: FilterGroup[];
}

export interface FilterGroupLevel3 {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters in this group. */
  filters: Filter[];
}

export interface FilterGroupLevel2 {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters or nested filter groups at level 3. */
  filters: (Filter | FilterGroupLevel3)[];
}

export interface FilterGroupLevel1 {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters or nested filter groups at level 2. */
  filters: (Filter | FilterGroupLevel2)[];
}

/** FilterGroup */
export interface FilterGroup {
  /** Unique identifier for the group. */
  id: string;
  /** Parent ID of this filter-group. */
  parent_id?: string;
  /** Logical operator for combining filters in the group. */
  group_operator: 'AND' | 'OR';
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

/** V3 Data Record format with id and fields separation */
export interface DataRecordV3 {
  /** Record identifier (primary key value) */
  id: string | number;
  /** Record fields data (excluding primary key). Undefined when empty. */
  fields?: Record<string, any>;
}

export type DataRecordWithDeletedV3 = DataRecordV3 & {
  /** Indicates if the record was deleted */
  deleted: boolean;
};

/** V3 Data List Response format */
export interface DataListResponseV3 {
  /** Array of records for has-many and many-to-many relationships */
  records?: DataRecordV3[];
  /** Pagination token for next page */
  next?: string | null;
  /** Pagination token for previous page */
  prev?: string | null;
  /** Nested pagination token for next page */
  nestedNext?: string | null;
  /** Nested pagination token for previous page */
  nestedPrev?: string | null;
}

/** V3 Data Insert Request format */
export interface DataInsertRequestV3 {
  /** Record fields data */
  fields: Record<string, any>;
}

/** V3 Data Update Request format */
export interface DataUpdateRequestV3 {
  /** Record identifier */
  id: string | number;
  /** Record fields data to update */
  fields: Record<string, any>;
}

/** Single record delete request */
export interface DataDeleteRequestV3 {
  /** Record identifier */
  id: string | number;
}

/** V3 Data Insert Response format */
export interface DataInsertResponseV3 {
  /** Array of created records */
  records: DataRecordV3[];
}

/** V3 Data Update Response format */
export interface DataUpdateResponseV3 {
  /** Array of updated record identifiers */
  records: {
    /** Updated record identifier */
    id: string | number;
    /** Record fields data (excluding primary key). Undefined when empty. */
    fields?: Record<string, any>;
  }[];
}

/** V3 Data Delete Response format */
export interface DataDeleteResponseV3 {
  /** Array of deleted records */
  records: DataRecordWithDeletedV3[];
}

/** V3 Data Read Response format */
export type DataReadResponseV3 = DataRecordV3;

/** V3 Nested Data List Response format - supports both single record and array responses */
export interface DataNestedListResponseV3 {
  /** Array of records for has-many and many-to-many relationships */
  records?: DataRecordV3[];
  /** Single record for belongs-to and one-to-one relationships */
  record?: DataRecordV3 | null;
  /** Pagination token for next page */
  next?: string | null;
  /** Pagination token for previous page */
  prev?: string | null;
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

/** Basic workspace information */
export interface Workspace {
  /** Unique identifier for the workspace */
  id: string;
  /** Title of the workspace */
  title: string;
  /**
   * Timestamp when the workspace was created
   * @format date-time
   */
  created_at: string;
  /**
   * Timestamp when the workspace was last updated
   * @format date-time
   */
  updated_at: string;
}

/** Workspace information including member details */
export type WorkspaceWithMembers = Workspace & {
  individual_members: {
    /** List of workspace members */
    workspace_members: WorkspaceMember[];
  };
};

/** Individual workspace member information */
export interface WorkspaceMember {
  /**
   * Email address of the member
   * @format email
   */
  email: string;
  /** Unique identifier for the user */
  user_id: string;
  /**
   * Timestamp when the user was added to the workspace
   * @format date-time
   */
  created_at: string;
  /**
   * Timestamp when the user was last updated in the workspace
   * @format date-time
   */
  updated_at: string;
  /** Role assigned to the user in the workspace */
  workspace_role: WorkspaceRoles;
}

/** Workspace user information */
export interface WorkspaceUser {
  /**
   * Email address of the user
   * @format email
   */
  email: string;
  /** Unique identifier for the user */
  user_id: string;
  /**
   * Timestamp when the user was added to the workspace
   * @format date-time
   */
  created_at: string;
  /**
   * Timestamp when the user was last updated in the workspace
   * @format date-time
   */
  updated_at: string;
  /** Role assigned to the user in the workspace */
  workspace_role: WorkspaceRoles;
}

/** Array of workspace users to be created. */
export type WorkspaceUserCreate = (
  | {
      /** Unique identifier for the user (skip if email is provided) */
      user_id: string;
      /** Workspace role to assign to the user */
      workspace_role: WorkspaceRoles;
    }
  | {
      /**
       * Email address of the user (skip if user_id is provided)
       * @format email
       */
      email: string;
      /** Workspace role to assign to the user */
      workspace_role: WorkspaceRoles;
    }
)[];

/** Array of workspace user updates. */
export type WorkspaceUserUpdate = {
  /** Unique identifier for the user */
  user_id: string;
  /** New workspace role to assign to the user */
  workspace_role: WorkspaceRoles;
}[];

/** Array of workspace users to be deleted. */
export type WorkspaceUserDelete = {
  /** Unique identifier for the user */
  user_id: string;
}[];

/** Button */
type BaseFieldOptionsButton = object;

type BaseFieldOptionsButtonTypeMapping<Key, Type> = {
  type: Key;
} & Type;

import type {
  AxiosInstance,
  AxiosRequestConfig,
  HeadersDefaults,
  ResponseType,
} from 'axios';
import axios from 'axios';

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
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export enum ContentType {
  Json = 'application/json',
  FormData = 'multipart/form-data',
  UrlEncoded = 'application/x-www-form-urlencoded',
  Text = 'text/plain',
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
      baseURL: axiosConfig.baseURL || 'https://app.nocodb.com',
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
    if (typeof formItem === 'object' && formItem !== null) {
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
      ((typeof secure === 'boolean' ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = format || this.format || undefined;

    if (
      type === ContentType.FormData &&
      body &&
      body !== null &&
      typeof body === 'object'
    ) {
      body = this.createFormData(body as Record<string, unknown>);
    }

    if (
      type === ContentType.Text &&
      body &&
      body !== null &&
      typeof body !== 'string'
    ) {
      body = JSON.stringify(body);
    }

    return this.instance
      .request({
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type ? { 'Content-Type': type } : {}),
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
 * @baseUrl https://app.nocodb.com
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
     * @name BasesList
     * @summary List bases
     * @request GET:/api/v3/meta/workspaces/{workspaceId}/bases
     */
    basesList: (workspaceId: string, params: RequestParams = {}) =>
      this.request<Base[], void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/bases`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new base in a specified workspace. The request requires the workspace identifier in the path and base details in the request body.
     *
     * @tags Bases
     * @name BaseCreate
     * @summary Create base
     * @request POST:/api/v3/meta/workspaces/{workspaceId}/bases
     */
    baseCreate: (
      workspaceId: string,
      data: BaseCreate,
      params: RequestParams = {},
    ) =>
      this.request<Base, void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/bases`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Retrieve details of a specific workspace, including its members. Notes: - To include member details, use the query parameter `include[]=members`. - Workspace collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Workspace Members
     * @name WorkspaceMembersRead
     * @summary List workspace members
     * @request GET:/api/v3/meta/workspaces/{workspaceId}?include[]=members
     */
    workspaceMembersRead: (
      workspaceId: string,
      query?: {
        /**
         * Include additional data. Use 'members' to include workspace member information.
         * @example "members"
         */
        include?: 'members' | 'members'[];
      },
      params: RequestParams = {},
    ) =>
      this.request<WorkspaceWithMembers, void>({
        path: `/api/v3/meta/workspaces/${workspaceId}?include[]=members`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Add new members to a workspace. The request requires the workspace identifier in the path and member details in the request body. Notes: Workspace collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Workspace Members
     * @name WorkspaceMembersInvite
     * @summary Add workspace members
     * @request POST:/api/v3/meta/workspaces/{workspaceId}/members
     */
    workspaceMembersInvite: (
      workspaceId: string,
      data: WorkspaceUserCreate,
      params: RequestParams = {},
    ) =>
      this.request<WorkspaceUser[], void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/members`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update roles of existing workspace members. The request requires the workspace identifier in the path and member update details in the request body. Notes: Workspace collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Workspace Members
     * @name WorkspaceMembersUpdate
     * @summary Update workspace members
     * @request PATCH:/api/v3/meta/workspaces/{workspaceId}/members
     */
    workspaceMembersUpdate: (
      workspaceId: string,
      data: WorkspaceUserUpdate,
      params: RequestParams = {},
    ) =>
      this.request<WorkspaceUser[], void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/members`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Remove members from a workspace. The request requires the workspace identifier in the path and member details in the request body. Notes: Workspace collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Workspace Members
     * @name WorkspaceMembersDelete
     * @summary Delete workspace members
     * @request DELETE:/api/v3/meta/workspaces/{workspaceId}/members
     */
    workspaceMembersDelete: (
      workspaceId: string,
      data: WorkspaceUserDelete,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/workspaces/${workspaceId}/members`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Retrieve meta details of a specific base using its unique identifier.
     *
     * @tags Bases
     * @name BaseRead
     * @summary Get base meta
     * @request GET:/api/v3/meta/bases/{baseId}
     */
    baseRead: (baseId: string, params: RequestParams = {}) =>
      this.request<Base, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update properties of a specific base. You can modify fields such as the title and metadata of the base. The baseId parameter identifies the base to be updated, and the new details must be provided in the request body. At least one of title or meta must be provided.
     *
     * @tags Bases
     * @name BaseUpdate
     * @summary Update base
     * @request PATCH:/api/v3/meta/bases/{baseId}
     */
    baseUpdate: (
      baseId: string,
      data: BaseUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Base, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete a specific base using its unique identifier. Once deleted, the base and its associated data cannot be recovered.
     *
     * @tags Bases
     * @name BaseDelete
     * @summary Delete base
     * @request DELETE:/api/v3/meta/bases/{baseId}
     */
    baseDelete: (baseId: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Retrieve list of all tables within the specified base.
     *
     * @tags Tables
     * @name TablesList
     * @summary List tables
     * @request GET:/api/v3/meta/bases/{base_id}/tables
     */
    tablesList: (baseId: string, params: RequestParams = {}) =>
      this.request<TableList, void>({
        path: `/api/v3/meta/bases/${baseId}/tables`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new table within the specified base by providing the required table details in the request body.
     *
     * @tags Tables
     * @name TableCreate
     * @summary Create table
     * @request POST:/api/v3/meta/bases/{base_id}/tables
     */
    tableCreate: (
      baseId: string,
      data: TableCreate,
      params: RequestParams = {},
    ) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Retrieve the details of a specific table.
     *
     * @tags Tables
     * @name TableRead
     * @summary Get table schema
     * @request GET:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    tableRead: (tableId: string, baseId: string, params: RequestParams = {}) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the details of a specific table.
     *
     * @tags Tables
     * @name TableUpdate
     * @summary Update table
     * @request PATCH:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    tableUpdate: (
      tableId: string,
      baseId: string,
      data: TableUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Table, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete a specific table.
     *
     * @tags Tables
     * @name TableDelete
     * @summary Delete table
     * @request DELETE:/api/v3/meta/bases/{baseId}/tables/{tableId}
     */
    tableDelete: (
      tableId: string,
      baseId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Retrieve a list of all views for a specific table.
     *
     * @tags Views
     * @name ViewsList
     * @summary List views
     * @request GET:/api/v3/meta/bases/{baseId}/tables/{tableId}/views
     */
    viewsList: (baseId: string, tableId: string, params: RequestParams = {}) =>
      this.request<ViewList, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}/views`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a view for table.
     *
     * @tags Views
     * @name ViewCreate
     * @summary Create view
     * @request POST:/api/v3/meta/bases/{baseId}/tables/{tableId}/views
     */
    viewCreate: (
      baseId: string,
      tableId: string,
      data: ViewCreate,
      params: RequestParams = {},
    ) =>
      this.request<View, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}/views`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new field within the specified table.
     *
     * @tags Fields
     * @name FieldCreate
     * @summary Create field
     * @request POST:/api/v3/meta/bases/{baseId}/tables/{tableId}/fields
     */
    fieldCreate: (
      tableId: string,
      baseId: string,
      data: CreateField,
      params: RequestParams = {},
    ) =>
      this.request<CreateField, void>({
        path: `/api/v3/meta/bases/${baseId}/tables/${tableId}/fields`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Retrieve the details of a specific field.
     *
     * @tags Fields
     * @name FieldRead
     * @summary Get field
     * @request GET:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    fieldRead: (baseId: string, fieldId: string, params: RequestParams = {}) =>
      this.request<Field, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the details of a specific field.
     *
     * @tags Fields
     * @name FieldUpdate
     * @summary Update field
     * @request PATCH:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    fieldUpdate: (
      baseId: string,
      fieldId: string,
      data: FieldUpdate,
      params: RequestParams = {},
    ) =>
      this.request<CreateField, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete a specific field.
     *
     * @tags Fields
     * @name FieldDelete
     * @summary Delete field
     * @request DELETE:/api/v3/meta/bases/{baseId}/fields/{fieldId}
     */
    fieldDelete: (
      fieldId: string,
      baseId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/fields/${fieldId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Retrieve the details of a specific view.
     *
     * @tags Views
     * @name ViewRead
     * @summary Get view schema
     * @request GET:/api/v3/meta/bases/{baseId}/views/{viewId}
     */
    viewRead: (baseId: string, viewId: string, params: RequestParams = {}) =>
      this.request<View, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the details of a specific view. The request body should contain the fields to be updated. Fields not included in the request body will remain unchanged. Fields included will overwrite the existing values. There is no provision for partial updates of fields, sort or filter using this PATCH request.
     *
     * @tags Views
     * @name ViewUpdate
     * @summary Update view
     * @request PATCH:/api/v3/meta/bases/{baseId}/views/{viewId}
     */
    viewUpdate: (
      baseId: string,
      viewId: string,
      data: ViewUpdate,
      params: RequestParams = {},
    ) =>
      this.request<View, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete a specific view.
     *
     * @tags Views
     * @name ViewDelete
     * @summary Delete view
     * @request DELETE:/api/v3/meta/bases/{baseId}/views/{viewId}
     */
    viewDelete: (baseId: string, viewId: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Retrieve a list of all filters and groups for a specific view.
     *
     * @tags View Filters
     * @name ViewFiltersList
     * @summary List view filters
     * @request GET:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    viewFiltersList: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<FilterListResponse, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new filter or filter-group for a specific view.
     *
     * @tags View Filters
     * @name ViewFilterCreate
     * @summary Create filter
     * @request POST:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    viewFilterCreate: (
      baseId: string,
      viewId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update the details of an existing filter or group.
     *
     * @tags View Filters
     * @name ViewFilterUpdate
     * @summary Update filter
     * @request PATCH:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    viewFilterUpdate: (
      baseId: string,
      filterId: string,
      viewId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete an existing filter or filter-group.
     *
     * @tags View Filters
     * @name ViewFilterDelete
     * @summary Delete filter
     * @request DELETE:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    viewFilterDelete: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Replace filters for a specific view. All the existing filters will be overwritten with the new filters specified in this request.
     *
     * @tags View Filters
     * @name ViewFilterReplace
     * @summary Replace filter
     * @request PUT:/api/v3/meta/bases/{baseId}/views/{viewId}/filters
     */
    viewFilterReplace: (
      viewId: string,
      baseId: string,
      data: FilterCreateUpdate,
      params: RequestParams = {},
    ) =>
      this.request<FilterCreateUpdate, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/filters`,
        method: 'PUT',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Retrieve a list of all sorts for a specific view.
     *
     * @tags View Sorts
     * @name ViewSortsList
     * @summary List view sorts
     * @request GET:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    viewSortsList: (
      baseId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<SortListResponse, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new sort for a specific view.
     *
     * @tags View Sorts
     * @name ViewSortCreate
     * @summary Add sort
     * @request POST:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    viewSortCreate: (
      baseId: string,
      viewId: string,
      data: SortCreate,
      params: RequestParams = {},
    ) =>
      this.request<Sort, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete an existing sort.
     *
     * @tags View Sorts
     * @name ViewSortDelete
     * @summary Delete sort
     * @request DELETE:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    viewSortDelete: (
      baseId: string,
      sortId: string,
      viewId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Update the details of an existing sort.
     *
     * @tags View Sorts
     * @name ViewSortUpdate
     * @summary Update sort
     * @request PATCH:/api/v3/meta/bases/{baseId}/views/{viewId}/sorts
     */
    viewSortUpdate: (
      baseId: string,
      sortId: string,
      viewId: string,
      data: SortUpdate,
      params: RequestParams = {},
    ) =>
      this.request<Sort, void>({
        path: `/api/v3/meta/bases/${baseId}/views/${viewId}/sorts`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Retrieve all details of a specific base, including its members. Notes: Base collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Base Members
     * @name BaseMembersList
     * @summary List base members
     * @request GET:/api/v3/meta/bases/{baseId}?include[]=members
     */
    baseMembersList: (baseId: string, params: RequestParams = {}) =>
      this.request<BaseWithMembers, void>({
        path: `/api/v3/meta/bases/${baseId}?include[]=members`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Invite new members to a specific base using their User ID or Email address. Notes: Base collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Base Members
     * @name BaseMembersInvite
     * @summary Invite base members
     * @request POST:/api/v3/meta/bases/{base_id}/members
     */
    baseMembersInvite: (
      baseId: string,
      data: BaseMemberCreate,
      params: RequestParams = {},
    ) =>
      this.request<BaseMember[], void>({
        path: `/api/v3/meta/bases/${baseId}/members`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update roles for existing members in a base. Notes: Base collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Base Members
     * @name BaseMembersUpdate
     * @summary Update base members
     * @request PATCH:/api/v3/meta/bases/{base_id}/members
     */
    baseMembersUpdate: (
      baseId: string,
      data: BaseMemberUpdate,
      params: RequestParams = {},
    ) =>
      this.request<BaseMember[], void>({
        path: `/api/v3/meta/bases/${baseId}/members`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Remove members from a specific base using their IDs. Notes: Base collaboration APIs are available only with self-hosted Enterprise plans and cloud-hosted Business+ plans.
     *
     * @tags Base Members
     * @name BaseMembersDelete
     * @summary Delete base members
     * @request DELETE:/api/v3/meta/bases/{base_id}/members
     */
    baseMembersDelete: (
      baseId: string,
      data: BaseMemberDelete,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/v3/meta/bases/${baseId}/members`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve records from a specified table. You can customize the response by applying various query parameters for filtering, sorting, and formatting. **Pagination**: The response is paginated by default, with the first page being returned initially. The response includes the following additional information in the `pageInfo` JSON block: - **next**: Contains the URL to retrieve the next page of records. For example, `"https://app.nocodb.com/api/v3/tables/medhonywr18cysz/records?page=2"` points to the next page of records. - If there are no more records available (you are on the last page), this attribute will be _null_. The `pageInfo` attribute is particularly valuable when working with large datasets divided into multiple pages. It provides the necessary URL to seamlessly fetch subsequent pages, enabling efficient navigation through the dataset.
     *
     * @tags Table Records
     * @name DbDataTableRowList
     * @summary List Table Records
     * @request GET:/api/v3/data/{baseId}/{tableId}/records
     */
    dbDataTableRowList: (
      baseId: string,
      tableId: string,
      query?: {
        /**
         * Allows you to specify the fields that you wish to include from the linked records in your API response. By default, only Primary Key and associated display value field is included.
         *
         * Example: `fields=["field1","field2"]` or `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         */
        fields?: string[] | string;
        /**
         * Allows you to specify the fields by which you want to sort the records in your API response. Accepts either an array of sort objects or a single sort object.
         *
         * Each sort object must have a 'field' property specifying the field name and a 'direction' property with value 'asc' or 'desc'.
         *
         * Example: `sort=[{"direction":"asc","field":"field_name"},{"direction":"desc","field":"another_field"}]` or `sort={"direction":"asc","field":"field_name"}`
         *
         * If `viewId` query parameter is also included, the sort included here will take precedence over any sorting configuration defined in the view.
         */
        sort?:
          | {
              direction: 'asc' | 'desc';
              field: string;
            }[]
          | {
              direction: 'asc' | 'desc';
              field: string;
            };
        /**
         * Enables you to define specific conditions for filtering records in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.
         *
         * Example: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'.
         *
         * You can also use other comparison operators like 'neq' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * If `viewId` query parameter is also included, then the filters included here will be applied over the filtering configuration defined in the view.
         *
         * Please remember to maintain the specified format, for further information on this please see [the documentation](https://nocodb.com/docs/product-docs/developer-resources/rest-apis#v3-where-query-parameter)
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
         * Example: `pageSize=100` will constrain your response to the first 100 records in the dataset.
         * @min 1
         */
        pageSize?: number;
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
        DataListResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/records`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows the creation of new records within a specified table. Records to be inserted are input as an array of key-value pair objects, where each key corresponds to a field name. Ensure that all the required fields are included in the payload, with exceptions for fields designated as auto-increment or those having default values. Certain read-only field types will be disregarded if included in the request. These field types include Look Up, Roll Up, Formula, Created By, Updated By, Created At, Updated At, Button, Barcode and QR Code. For **Attachment** field types, this API cannot be used. Instead, utilize the storage APIs for managing attachments. Support for attachment fields in the record update API will be added soon.
     *
     * @tags Table Records
     * @name DbDataTableRowCreate
     * @summary Create Table Records
     * @request POST:/api/v3/data/{baseId}/{tableId}/records
     */
    dbDataTableRowCreate: (
      baseId: string,
      tableId: string,
      data: DataInsertRequestV3 | DataInsertRequestV3[],
      params: RequestParams = {},
    ) =>
      this.request<
        DataInsertResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/records`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to update records within a specified table by their Record ID. The request payload should contain the Record ID and the fields that need to be updated. Certain read-only field types will be disregarded if included in the request. These field types include Look Up, Roll Up, Formula, Created By, Updated By, Created At, Updated At, Button, Barcode and QR Code. For **Attachment** field types, this API cannot be used. Instead, utilize the storage APIs for managing attachments. Support for attachment fields in the record update API will be added soon.
     *
     * @tags Table Records
     * @name DbDataTableRowUpdate
     * @summary Update Table Records
     * @request PATCH:/api/v3/data/{baseId}/{tableId}/records
     */
    dbDataTableRowUpdate: (
      baseId: string,
      tableId: string,
      data: DataUpdateRequestV3 | DataUpdateRequestV3[],
      params: RequestParams = {},
    ) =>
      this.request<
        DataUpdateResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/records`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows the deletion of records within a specified table by Record ID. The request should include the Record ID of the record(s) to be deleted.
     *
     * @tags Table Records
     * @name DbDataTableRowDelete
     * @summary Delete Table Records
     * @request DELETE:/api/v3/data/{baseId}/{tableId}/records
     */
    dbDataTableRowDelete: (
      baseId: string,
      tableId: string,
      data: DataDeleteRequestV3 | DataDeleteRequestV3[],
      params: RequestParams = {},
    ) =>
      this.request<
        DataDeleteResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/records`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve a single record identified by Record-ID, serving as unique identifier for the record from a specified table.
     *
     * @tags Table Records
     * @name DbDataTableRowRead
     * @summary Read Table Record
     * @request GET:/api/v3/data/{baseId}/{tableId}/records/{recordId}
     */
    dbDataTableRowRead: (
      baseId: string,
      tableId: string,
      recordId: string,
      query?: {
        /**
         * Allows you to specify the fields that you wish to include from the linked records in your API response. By default, only Primary Key and associated display value field is included.
         *
         * Example: `fields=["field1","field2"]` or `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         */
        fields?: string[] | string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        DataReadResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/records/${recordId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to upload an attachment (base64 encoded) to a specific cell in a table. The attachment data includes content type, base64 encoded file, and filename.
     *
     * @tags Table Records
     * @name DbDataTableRowAttachmentUpload
     * @summary Upload Attachment to Cell
     * @request POST:/api/v3/data/{baseId}/{modelId}/records/{recordId}/fields/{fieldId}/upload
     */
    dbDataTableRowAttachmentUpload: (
      baseId: string,
      modelId: string,
      recordId: string,
      fieldId: string,
      data: {
        /** Content type of the file (e.g., image/png, application/pdf). */
        contentType: string;
        /** Base64 encoded file content. */
        file: string;
        /** Original filename of the attachment. */
        filename: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        DataReadResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${modelId}/records/${recordId}/fields/${fieldId}/upload`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve the total number of records from a specified table or a view. You can narrow down search results by applying `where` query parameter
     *
     * @tags Table Records
     * @name DbDataTableRowCount
     * @summary Count Table Records
     * @request GET:/api/v3/data/{baseId}/{tableId}/count
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
         * You can also use other comparison operators like 'neq' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * If `viewId` query parameter is also included, then the filters included here will be applied over the filtering configuration defined in the view.
         *
         * Please remember to maintain the specified format, for further information on this please see [the documentation](https://nocodb.com/docs/product-docs/developer-resources/rest-apis#v3-where-query-parameter)
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
        path: `/api/v3/data/${baseId}/${tableId}/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to retrieve list of linked records for a specific `Link to another record field` and `Record ID`. The response is an array of objects containing Primary Key and its corresponding display value.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedList
     * @summary List Linked Records
     * @request GET:/api/v3/data/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
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
         * Example: `fields=["field1","field2"]` or `fields=field1,field2` will include only 'field1' and 'field2' in the API response.
         */
        fields?: string[] | string;
        /**
         * Allows you to specify the fields by which you want to sort the records in your API response. Accepts either an array of sort objects or a single sort object.
         *
         * Each sort object must have a 'field' property specifying the field name and a 'direction' property with value 'asc' or 'desc'.
         *
         * Example: `sort=[{"direction":"asc","field":"field_name"},{"direction":"desc","field":"another_field"}]` or `sort={"direction":"asc","field":"field_name"}`
         *
         * If `viewId` query parameter is also included, the sort included here will take precedence over any sorting configuration defined in the view.
         */
        sort?:
          | {
              direction: 'asc' | 'desc';
              field: string;
            }[]
          | {
              direction: 'asc' | 'desc';
              field: string;
            };
        /**
         * Enables you to define specific conditions for filtering linked records in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.
         *
         * Example: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter linked records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'.
         *
         * You can also use other comparison operators like 'neq' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.
         *
         * Please remember to maintain the specified format, for further information on this please see [the documentation](https://nocodb.com/docs/product-docs/developer-resources/rest-apis#v3-where-query-parameter)
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
         * Example: `pageSize=100` will constrain your response to the first 100 linked records in the dataset.
         * @min 1
         */
        pageSize?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        DataListResponseV3,
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to link records to a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for linking purposes. Note that any existing links, if present, will be unaffected during this operation.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedLink
     * @summary Link Records
     * @request POST:/api/v3/data/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
     */
    dbDataTableRowNestedLink: (
      tableId: string,
      linkFieldId: string,
      recordId: string,
      baseId: string,
      data:
        | {
            /**
             * Unique identifier for the record
             * @example "33"
             */
            id: string;
          }
        | {
            /**
             * Unique identifier for the record
             * @example "22"
             */
            id: string;
          }[],
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /**
           * Indicates whether the linking operation was successful
           * @example true
           */
          success: boolean;
        },
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description This API endpoint allows you to unlink records from a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for unlinking purposes. Note that, - duplicated record-ids will be ignored. - non-existent record-ids will be ignored.
     *
     * @tags Linked Records
     * @name DbDataTableRowNestedUnlink
     * @summary Unlink Records
     * @request DELETE:/api/v3/data/{baseId}/{tableId}/links/{linkFieldId}/{recordId}
     */
    dbDataTableRowNestedUnlink: (
      tableId: string,
      linkFieldId: string,
      recordId: string,
      baseId: string,
      data:
        | {
            /**
             * Unique identifier for the record
             * @example "33"
             */
            id: string;
          }
        | {
            /**
             * Unique identifier for the record
             * @example "33"
             */
            id: string;
          }[],
      params: RequestParams = {},
    ) =>
      this.request<
        {
          /**
           * Indicates whether the unlink operation was successful
           * @example true
           */
          success: boolean;
        },
        {
          /** @example "BadRequest [Error]: <ERROR MESSAGE>" */
          msg: string;
        }
      >({
        path: `/api/v3/data/${baseId}/${tableId}/links/${linkFieldId}/${recordId}`,
        method: 'DELETE',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
}
