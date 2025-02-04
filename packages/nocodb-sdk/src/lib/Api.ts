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
 * Workspace roles for the user.
 */
export enum WorkspaceRolesV3Type {
  WorkspaceLevelOwner = 'workspace-level-owner',
  WorkspaceLevelCreator = 'workspace-level-creator',
  WorkspaceLevelEditor = 'workspace-level-editor',
  WorkspaceLevelViewer = 'workspace-level-viewer',
  WorkspaceLevelCommenter = 'workspace-level-commenter',
  WorkspaceLevelNoAccess = 'workspace-level-no-access',
}

/**
 * Base roles for the user.
 */
export enum BaseRolesV3Type {
  Owner = 'owner',
  Creator = 'creator',
  Editor = 'editor',
  Viewer = 'viewer',
  Commenter = 'commenter',
  NoAccess = 'no-access',
}

/**
 * Model for Paginated
 */
export interface PaginatedV3Type {
  /** URL to access next page */
  next?: string;
  /** URL to access previous page */
  prev?: string;
  /** URL to access current page data with next set of nested fields data */
  nestedNext?: string;
  /** URL to access current page data with previous set of nested fields data */
  nestedPrev?: string;
}

export interface SortListResponseV3Type {
  list: SortV3Type[];
}

export type FilterUpdateV3Type = {
  /** Unique identifier for the filter. */
  id: string;
} & (FilterV3Type | FilterGroupV3Type);

export type FilterCreateV3Type = FilterV3Type | FilterGroupLevel1V3Type;

export interface FilterGroupV3Type {
  /** Unique identifier for the group. */
  id: string;
  /** Parent ID of this filter-group. */
  parent_id?: string;
  /** Logical operator for combining filters in the group. */
  group_operator: 'AND' | 'OR';
  /** Nested filters or filter groups. */
  filters: (
    | FilterV3Type
    | FilterGroupV3Type
    | (FilterV3Type & FilterGroupV3Type)
  )[];
}

export interface FilterGroupLevel1V3Type {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters or nested filter groups at level 2. */
  filters: (FilterV3Type | FilterGroupLevel2V3Type)[];
}

export interface FilterGroupLevel2V3Type {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters or nested filter groups at level 3. */
  filters: (FilterV3Type | FilterGroupLevel3V3Type)[];
}

export interface FilterGroupLevel3V3Type {
  /** Logical operator for the group. */
  group_operator: 'AND' | 'OR';
  /** List of filters in this group. */
  filters: FilterV3Type[];
}

export interface FilterListResponseV3Type {
  /** List of filter groups. Initial set of filters are mapped to a default group with group-id set to **root**. */
  list: FilterGroupV3Type[];
}

export interface FilterV3Type {
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

export type FieldUpdateV3Type = FieldBaseV3Type &
  (
    | {
        type?: 'LongText';
        options?: FieldOptionsLongTextV3Type;
      }
    | {
        type?: 'PhoneNumber' | 'URL' | 'Email';
        options?: FieldOptionsPhoneNumberV3Type;
      }
    | {
        type?: 'Number' | 'Decimal';
        options?: FieldOptionsNumberV3Type;
      }
    | {
        type?: 'JSON';
      }
    | {
        type?: 'Currency';
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrencyV3Type;
      }
    | {
        type?: 'Percent';
        options?: FieldOptionsPercentV3Type;
      }
    | {
        type?: 'Duration';
        options?: FieldOptionsDurationV3Type;
      }
    | {
        type?: 'Date' | 'DateTime' | 'Time';
        options?: FieldOptionsDateTimeV3Type;
      }
    | {
        type?: 'SingleSelect' | 'MultiSelect';
        options?: FieldOptionsSelectV3Type;
      }
    | {
        type?: 'Rating' | 'Checkbox';
        options?: FieldOptionsRatingV3Type;
      }
    | {
        type?: 'Barcode';
        options?: FieldOptionsBarcodeV3Type;
      }
    | {
        type?: 'Formula';
        options?: FieldOptionsFormulaV3Type;
      }
    | {
        type?: 'User';
        options?: FieldOptionsUserV3Type;
      }
    | {
        type?: 'Lookup';
        options?: FieldOptionsLookupV3Type;
      }
    | {
        type?: 'Links';
        options?: FieldOptionsLinksV3Type;
      }
    | {
        type?: 'LinkToAnotherRecord';
        options?: FieldOptionsLinkToAnotherRecordV3Type;
      }
  );

export type FilterCreateUpdateV3Type = FilterV3Type | FilterGroupV3Type;

export type FieldV3Type = FieldBaseV3Type &
  (
    | {
        type?: 'LongText';
        options?: FieldOptionsLongTextV3Type;
      }
    | {
        type?: 'PhoneNumber' | 'URL' | 'Email';
        options?: FieldOptionsPhoneNumberV3Type;
      }
    | {
        type?: 'Number' | 'Decimal';
        options?: FieldOptionsNumberV3Type;
      }
    | {
        type?: 'JSON';
      }
    | {
        type?: 'Currency';
        /** Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD` */
        options?: FieldOptionsCurrencyV3Type;
      }
    | {
        type?: 'Percent';
        options?: FieldOptionsPercentV3Type;
      }
    | {
        type?: 'Duration';
        options?: FieldOptionsDurationV3Type;
      }
    | {
        type?: 'Date' | 'DateTime' | 'Time';
        options?: FieldOptionsDateTimeV3Type;
      }
    | {
        type?: 'SingleSelect' | 'MultiSelect';
        options?: FieldOptionsSelectV3Type;
      }
    | {
        type?: 'Rating' | 'Checkbox';
        options?: FieldOptionsRatingV3Type;
      }
    | {
        type?: 'Barcode';
        options?: FieldOptionsBarcodeV3Type;
      }
    | {
        type?: 'Formula';
        options?: FieldOptionsFormulaV3Type;
      }
    | {
        type?: 'User';
        options?: FieldOptionsUserV3Type;
      }
    | {
        type?: 'Lookup';
        options?: FieldOptionsLookupV3Type;
      }
    | {
        type?: 'Links';
        options?: FieldOptionsLinksV3Type;
      }
    | {
        type?: 'LinkToAnotherRecord';
        options?: FieldOptionsLinkToAnotherRecordV3Type;
      }
  );

export interface FieldOptionsLinkToAnotherRecordV3Type {
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

export interface FieldOptionsLinksV3Type {
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

export type FieldOptionsButtonV3Type = any;

export interface FieldOptionsRollupV3Type {
  /** Linked field ID. */
  link_field_id: string;
  /** Rollup field ID in the linked table. */
  linked_table_rollup_field_id: string;
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

export interface FieldOptionsLookupV3Type {
  /** Linked field ID. Can be of type Links or LinkToAnotherRecord */
  link_field_id: string;
  /** Lookup field ID in the linked table. */
  linked_table_lookup_field_id: string;
}

export interface FieldOptionsUserV3Type {
  /** Allow selecting multiple users. */
  allow_multiple_users?: boolean;
}

export interface FieldOptionsFormulaV3Type {
  /** Formula expression. */
  formula?: string;
}

export interface FieldOptionsBarcodeV3Type {
  /** Barcode format (e.g., CODE128). */
  format?: string;
  /** Field ID that contains the value. */
  value_field_id?: string;
}

export interface FieldOptionsCheckboxV3Type {
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

export interface FieldOptionsRatingV3Type {
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

export interface FieldOptionsSelectV3Type {
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

export interface FieldOptionsTimeV3Type {
  /**
   * Time format. Supported options are listed below
   * - `HH:mm`
   * - `HH:mm:ss`
   * - `HH:mm:ss.SSS`
   */
  time_format?: string;
  /** Use 12-hour time format. */
  '12hr_format'?: boolean;
}

export interface FieldOptionsDateV3Type {
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

export interface FieldOptionsDateTimeV3Type {
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
}

export interface FieldOptionsDurationV3Type {
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

export interface FieldOptionsPercentV3Type {
  /**
   * Number of decimal places allowed.
   * @min 0
   * @max 5
   */
  precision?: number;
  /** Display as a progress bar. */
  show_as_progress?: boolean;
}

/**
 * Currency settings for this column. Locale defaults to `en-US` and currency code defaults to `USD`
 */
export interface FieldOptionsCurrencyV3Type {
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

export interface FieldOptionsDecimalV3Type {
  /**
   * Decimal field precision. Defaults to 0
   * @min 0
   * @max 5
   */
  precision?: number;
}

export interface FieldOptionsNumberV3Type {
  /** Show thousand separator on the UI. */
  locale_string?: boolean;
}

export interface FieldOptionsEmailV3Type {
  /** Enable validation for Email. */
  validation?: boolean;
}

export interface FieldOptionsURLV3Type {
  /** Enable validation for URL. */
  validation?: boolean;
}

export interface FieldOptionsPhoneNumberV3Type {
  /** Enable validation for phone numbers. */
  validation?: boolean;
}

export interface FieldOptionsLongTextV3Type {
  /** Enable rich text formatting. */
  rich_text?: boolean;
  /** Enable text generation for this field using NocoAI. */
  generate_text_using_ai?: boolean;
}

/**
 * GRID View
 */
export type ViewV3Type = (
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
        sort?: 'asc' | 'desc';
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
  view_type?: 'GRID' | 'GALLERY' | 'KANBAN' | 'CALENDAR' | 'FORM';
  /** Lock type of the view. */
  lock_type?: 'COLLABARATIVE' | 'LOCKED' | 'PERSONAL';
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
  filters?: FilterV3Type[];
  /** Sort options for the view. */
  sorts?: SortV3Type[];
};

export interface ViewSummaryV3Type {
  /**
   * Unique identifier for the view.
   * @format uuid
   */
  id?: string;
  /** Name of the view. */
  title?: string;
  /** Type of the view. */
  view_type?: 'GRID' | 'GALLERY' | 'KANBAN' | 'CALENDAR' | 'FORM';
}

export interface SortUpdateV3Type {
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

export interface SortCreateV3Type {
  /**
   * Identifier for the field being sorted.
   * @format uuid
   */
  field_id: string;
  /** Sorting direction, either 'asc' (ascending) or 'desc' (descending). */
  direction: 'asc' | 'desc';
}

export interface SortV3Type {
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
  direction: 'asc' | 'desc';
}

export type TableUpdateV3Type = {
  /** New title of the table. */
  title?: string;
  /** Description of the table. */
  description?: string;
  /** Unique identifier for the display field of the table. The type of the field should be one of the allowed types for display field. */
  display_field_id?: string;
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  meta?: TableMetaReqV3Type;
};

export interface TableMetaReqV3Type {
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  icon?: string;
}

export type BaseUserDeleteV3Type = {
  /** Unique identifier for the user. */
  id?: string;
  /**
   * Email address of the user.
   * @format email
   */
  email?: string;
}[];

/**
 * Array of user updates.
 */
export type BaseUserUpdateV3Type = {
  /** Unique identifier for the user. Used as a primary identifier if provided. */
  id?: string;
  /**
   * Email address of the user. Used as a primary identifier if 'id' is not provided.
   * @format email
   */
  email?: string;
  /** Base roles for the user. */
  base_role: BaseRolesV3Type;
}[];

/**
 * Array of users to be created.
 */
export type BaseUserCreateV3Type = {
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
  base_role: BaseRolesV3Type;
}[];

export interface BaseUserListV3Type {
  list?: BaseUserV3Type[];
}

export type BaseUserDeleteRequestV3Type = any;

export interface BaseUserV3Type {
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
  base_role: BaseRolesV3Type;
  /** Workspace roles for the user. */
  workspace_role: WorkspaceRolesV3Type;
  /** Unique identifier for the workspace. */
  workspace_id: string;
}

export interface TableV3Type {
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
  fields: CreateFieldV3Type[];
  /** List of views associated with this table. */
  views: ViewSummaryV3Type[];
}

export interface FieldBaseV3Type {
  /** Field identifier. */
  id?: string;
  /** Field name. */
  title: string;
  /** Field type. */
  type: string;
  /** Default value for the field. Applicable for SingleLineText, LongText, PhoneNumber, URL, Email, Number, Decimal, Currency, Percent, Duration, Date, DateTime, Time, SingleSelect, MultiSelect, Rating, Checkbox, User and JSON fields. */
  default_value?: string;
  /** Field description. */
  description?: string;
}

export type CreateFieldV3Type = FieldBaseV3Type;

export type FieldOptionsV3Type = any;

export interface TableCreateV3Type {
  /** Title of the table. */
  title: string;
  /** Description of the table. */
  description?: string | null;
  meta?: TableMetaV3Type;
  /** Unique identifier for the data source. Include this information only if the table being created is part of a data source. */
  source_id?: string;
  fields?: CreateFieldV3Type[];
}

export interface TableMetaV3Type {
  /** Icon prefix to the table name that needs to be displayed in-lieu of the default table icon. */
  icon?: string;
}

export interface TableListV3Type {
  list: {
    /** Unique identifier for the table. */
    id: string;
    /** Title of the table. */
    title: string;
    /** Description of the table. */
    description?: string | null;
    meta?: TableMetaV3Type;
    /** Unique identifier for the base to which this table belongs to. */
    base_id: string;
    /** Unique identifier for the data source. This information will be included only if the table is associated with an external data source. */
    source_id?: string;
    /** Unique identifier for the workspace to which this base belongs to. */
    workspace_id: string;
  }[];
}

export interface BaseUpdateV3Type {
  /** Title of the base. */
  title?: string;
  meta?: BaseMetaReqV3Type;
}

export interface BaseCreateV3Type {
  /** Title of the base. */
  title: string;
  meta?: BaseMetaReqV3Type;
}

export interface BaseMetaReqV3Type {
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

export interface BaseMetaResV3Type {
  /**
   * Specifies the color of the base icon using a hexadecimal color code (e.g., `#36BFFF`)
   * @pattern ^#[0-9A-Fa-f]{6}$
   */
  icon_color?: string;
}

export interface BaseV3Type {
  /** Unique identifier for the base. */
  id: string;
  /** Title of the base. */
  title: string;
  meta: BaseMetaResV3Type;
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
  /** The name of the attachment file name */
  fileName?: string;
}

/**
 * Model for Attachment Response
 */
export type AttachmentResType = {
  /** The mimetype of the attachment */
  mimetype?: string;
  /** The attachment stored path */
  path?: string;
  /** The size of the attachment */
  size?: number;
  /** The title of the attachment used in UI */
  title?: string;
  /** The attachment stored url */
  url?: string;
  /** Attachment signedPath will allow to access attachment directly */
  signedPath?: string;
  /** Attachment signedUrl will allow to access attachment directly */
  signedUrl?: string;
} | null;

/**
 * Model for File Request
 */
export interface FileReqType {
  /** The mimetype of the file */
  mimetype?: string;
  /** The name of the input used to upload the file */
  fieldname?: string;
  /** The original name of the file */
  originalname?: string;
  /** The size of the file */
  size?: number;
  /** The encoding of the file */
  encoding?: string;
  /** An buffer array containing the file content */
  buffer?: any;
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
   * The display name of user performing the action
   * @example NocoDB
   */
  display_name?: string;
  /**
   * IP address from the user
   * @example ::ffff:127.0.0.1
   */
  ip?: string;
  /**
   * Source ID in where action is performed
   * @example ds_3l9qx8xqksenrl
   */
  source_id?: string;
  /**
   * Base ID in where action is performed
   * @example p_9sx43moxhqtjm3
   */
  base_id?: string;
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
    | 'CREATE'
    | 'RENAME'
    | 'IMPORT_FROM_ZIP'
    | 'EXPORT_TO_FS'
    | 'EXPORT_TO_ZIP'
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
  /** Version of the audit */
  version?: number;
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
 * Model for Source
 */
export interface SourceType {
  /** Source Name */
  alias?: StringOrNullType;
  /** Integration Name */
  integration_title?: StringOrNullType;
  /** Integration Id */
  fk_integration_id?: StringOrNullType;
  /** Source Configuration */
  config?: any;
  /** Is this source enabled */
  enabled?: BoolType;
  /** Unique Source ID */
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
  /** Is the data source minimal db */
  is_local?: BoolType;
  /** Is the data source schema readonly */
  is_schema_readonly?: BoolType;
  /** Is the data source data readonly */
  is_data_readonly?: BoolType;
  /**
   * The order of the list of sources
   * @example 1
   */
  order?: number;
  /** The base ID that this source belongs to */
  base_id?: string;
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
    | 'sqlite3'
    | 'databricks';
}

/**
 * Model for Integration
 */
export interface IntegrationType {
  /** Source Name - Default BASE will be null by default */
  title?: StringOrNullType;
  /** Source Configuration */
  config?: any;
  /** Is this Intgration enabled */
  enabled?: BoolType;
  /** Unique Integration ID */
  id?: string;
  /** Unique Workspace ID */
  fk_workspace_id?: string;
  /**
   * The order of the list of sources
   * @example 1
   */
  order?: number;
  /** The base ID that this source belongs to */
  base_id?: string;
  /** Model for Bool */
  is_private?: BoolType;
  /** Model for Bool */
  is_default?: BoolType;
  /** Integration Type */
  type?: IntegrationsType;
  /**
   * DB Type
   * @example mysql2
   */
  sub_type?: string;
  /**
   * DB Type
   * @example mysql2
   */
  created_by?: string;
}

/**
 * Model for Source List
 */
export interface BaseListType {
  /** List of source objects */
  list: SourceType[];
  /** Paginated Info */
  pageInfo: PaginatedType;
}

/**
 * Model for Source Request
 */
export interface BaseReqType {
  /**
   * Source Name - Default BASE will be null by default
   * @example My Source
   */
  alias?: string;
  /** Source Configuration */
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
  /** Is the data source minimal db */
  is_local?: boolean;
  /** Is the data source schema readonly */
  is_schema_readonly?: BoolType;
  /** Is the data source data readonly */
  is_data_readonly?: BoolType;
  /** DB Type */
  type?:
    | 'mssql'
    | 'mysql'
    | 'mysql2'
    | 'oracledb'
    | 'pg'
    | 'snowflake'
    | 'sqlite3'
    | 'databricks';
  fk_integration_id?: string;
}

/**
 * Integration Type
 */
export enum IntegrationsType {
  Database = 'database',
  Ai = 'ai',
  Communication = 'communication',
  SpreadSheet = 'spread-sheet',
  ProjectManagement = 'project-management',
  Crm = 'crm',
  Marketing = 'marketing',
  Ats = 'ats',
  Development = 'development',
  Finance = 'finance',
  Ticketing = 'ticketing',
  Storage = 'storage',
  Others = 'others',
}

/**
 * Model for Integration Request
 */
export interface IntegrationReqType {
  /**
   * Integration Name - Default BASE will be null by default
   * @example Integration
   */
  title: string;
  /** Source Configuration */
  config: any;
  /** Integration metas */
  meta?: any;
  /** Integration Type */
  type: IntegrationsType;
  /** Sub Type */
  sub_type?: string;
  /** ID of integration to be copied from. Used in Copy Integration. */
  copy_from_id?: StringOrNullType;
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
  /** Column Description */
  description?: TextOrNullType;
  /**
   * Source ID that this column belongs to
   * @example ds_krsappzu9f8vmo
   */
  source_id?: string;
  /** Column Comment */
  cc?: string;
  /** Column Default */
  cdf?: StringOrNullOrBooleanOrNumberType;
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
    | 'CreatedTime'
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
    | 'QrCode'
    | 'Links'
    | 'User'
    | 'CreatedBy'
    | 'LastModifiedBy'
    | 'AI'
    | 'Order';
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
  | ButtonColumnReqType
  | FormulaColumnReqType
  | LinkToAnotherColumnReqType
  | LookupColumnReqType
  | NormalColumnRequestType
  | RollupColumnReqType
  | (ButtonColumnReqType &
      FormulaColumnReqType &
      LinkToAnotherColumnReqType &
      LookupColumnReqType &
      NormalColumnRequestType &
      RollupColumnReqType)
) & {
  column_name?: string;
  /** Model for TextOrNull */
  description?: TextOrNullType;
  /** Column order in a specific view */
  column_order?: {
    order?: number;
    view_id?: string;
  };
  title: string;
  view_id?: string;
};

/**
 * Model for Comment Request
 */
export interface CommentReqType {
  /**
   * Description for the target row
   * @example This is the comment for the row
   */
  comment?: string;
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
  comment?: string;
  /**
   * Foreign Key to Model
   * @example md_ehn5izr99m7d45
   */
  fk_model_id?: string;
}

/**
 * Model for Filter
 */
export interface FilterType {
  /** Unqiue Source ID */
  source_id?: string;
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
    | 'null'
    | null
    | (
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
        | ('null' & null)
      );
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
  /** Foreign Key to parent column */
  fk_parent_column_id?: StringOrNullType;
  /** Foreign Key to Column */
  fk_column_id?: StringOrNullType;
  /** Foreign Key to Hook */
  fk_hook_id?: StringOrNullType;
  /** Foreign Key to Model */
  fk_model_id?: IdType;
  /** Foreign Key to parent group. */
  fk_parent_id?: StringOrNullType;
  /** Foreign Key to View */
  fk_view_id?: StringOrNullType;
  /** Foreign Key to dynamic value Column */
  fk_value_col_id?: StringOrNullType;
  /** Foreign Key to Link Column */
  fk_link_col_id?: StringOrNullType;
  /** Unique ID */
  id?: IdType;
  /** Is this filter grouped? */
  is_group?: boolean | number | null;
  /** Logical Operator */
  logical_op?: 'and' | 'not' | 'or';
  /** Unique Base ID */
  base_id?: string;
  /** The filter value. Can be NULL for some operators. */
  value?: any;
  /**
   * The order of the filter
   * @example 1
   */
  order?: number;
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
    | 'null'
    | null
    | (
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
        | ('null' & null)
      );
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
  fk_column_id?: StringOrNullType;
  /** Belong to which filter ID */
  fk_parent_id?: StringOrNullType;
  /** Is this filter grouped? */
  is_group?: BoolType;
  /** Logical Operator */
  logical_op?: 'and' | 'not' | 'or';
  /** The filter value. Can be NULL for some operators. */
  value?: any;
}

export interface FollowerType {
  fk_follower_id?: string;
}

/**
 * Model for Form
 */
export interface FormType {
  /** Unique ID */
  id?: IdType;
  /** Banner Image URL */
  banner_image_url?: AttachmentResType;
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
   * Source ID
   * @example md_rsu68aqjsbyqtl
   */
  source_id?: string;
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
  /** Logo URL */
  logo_url?: AttachmentResType;
  /** Meta Info for this view */
  meta?: MetaType;
  /** The numbers of seconds to redirect after form submission */
  redirect_after_secs?: StringOrNullType;
  /** URL to redirect after submission */
  redirect_url?: TextOrNullType;
  /** Show `Blank Form` after 5 seconds */
  show_blank_form?: BoolType;
  /**
   * The subheading of the form
   * @example My Form Subheading
   */
  subheading?: TextOrNullType;
  /** Show `Submit Another Form` button */
  submit_another_form?: BoolType;
  /** Custom message after the form is successfully submitted */
  success_msg?: TextOrNullType;
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
  /** Banner Image URL */
  banner_image_url?: AttachmentReqType | null;
  /** Email to sned after form is submitted */
  email?: StringOrNullType;
  /**
   * The heading of the form
   * @example My Form
   */
  heading?: string;
  /** Logo URL */
  logo_url?: AttachmentReqType | null;
  /** Meta Info for this view */
  meta?: MetaType;
  /** The numbers of seconds to redirect after form submission */
  redirect_after_secs?: StringOrNullType;
  /** URL to redirect after submission */
  redirect_url?: TextOrNullType;
  /** Show `Blank Form` after 5 seconds */
  show_blank_form?: BoolType;
  /**
   * The subheading of the form
   * @example My Form Subheading
   */
  subheading?: TextOrNullType;
  /** Show `Submit Another Form` button */
  submit_another_form?: BoolType;
  /** Custom message after the form is successfully submitted */
  success_msg?: TextOrNullType;
}

/**
 * Model for Form Column
 */
export interface FormColumnType {
  /** Unique ID */
  id?: IdType;
  /** Form Column Description */
  description?: TextOrNullType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: IdType;
  /** Form Column Help Text (Not in use) */
  help?: TextOrNullType;
  /** Form Column Label */
  label?: TextOrNullType;
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
  /** Form Column Description */
  description?: TextOrNullType;
  /** Form Column Help Text (Not in use) */
  help?: TextOrNullType;
  /** Form Column Label */
  label?: TextOrNullType;
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
  /** Error Message */
  error?: string;
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
  /** Unique ID */
  id?: IdType;
}

/**
 * Model for Button
 */
export interface ButtonType {
  /** Unique ID */
  id?: IdType;
  /** Whether button is webhook or url */
  type?: ButtonActionsType;
  /** Label of Button */
  label?: string;
  /** Button Theme */
  theme?: 'solid' | 'text' | 'light';
  /** Button color */
  color?:
    | 'brand'
    | 'red'
    | 'green'
    | 'maroon'
    | 'blue'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'yellow'
    | 'gray';
  /** Button Icon */
  icon?: string;
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
  /** Parsed Formula Tree */
  parsed_tree?: object;
  /** Webhook ID */
  fk_webhook_id?: IdType;
  /** Script ID */
  fk_script_id?: IdType;
  /** Foreign Key to Column */
  fk_column_id?: IdType;
  /** Comma separated column ids to be updated with the generated value */
  output_column_ids?: string;
  /** Foreign key to AI integration */
  fk_integration_id?: string;
  /** AI model */
  model?: string;
}

/**
 * Model for Button Column Request
 */
export interface ButtonColumnReqType {
  /** Formula Title */
  title?: string;
  /** UI Data Type */
  uidt?: 'Formula';
  /** Whether button is webhook or url */
  type?: ButtonActionsType;
  /** Button Theme */
  theme?: 'solid' | 'text' | 'light';
  /** Button color */
  color?:
    | 'brand'
    | 'red'
    | 'green'
    | 'maroon'
    | 'blue'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'yellow'
    | 'gray';
  /** Label of Button */
  label?: string;
  /** Button Icon */
  icon?: string;
  /** Webhook ID */
  fk_webhook_id?: IdType;
  /** Formula with column ID replaced */
  formula?: string;
  /** Original Formula inputted in UI */
  formula_raw?: string;
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
  fk_cover_image_col_id?: StringOrNullType;
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
  /** Base ID */
  base_id?: IdType;
  /** Source ID */
  source_id?: IdType;
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
  /** Base ID */
  base_id?: IdType;
  /** Source ID */
  source_id?: IdType;
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
  /** Base ID */
  base_id?: IdType;
  /** Source ID */
  source_id?: IdType;
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
  /** Group By */
  group_by?: BoolType;
  /**
   * Group By Order
   * @example 1
   */
  group_by_order?: number;
  /**
   * Group By Sort
   * @example asc
   */
  group_by_sort?: StringOrNullType;
  /**
   * Aggregation Type
   * @example sum
   */
  aggregation?: StringOrNullType;
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
  /** Group By */
  group_by?: BoolType;
  /**
   * Group By Order
   * @example 1
   */
  group_by_order?: number;
  /**
   * Group By Sort
   * @example asc
   */
  group_by_sort?: StringOrNullType;
  /**
   * Aggregation
   * @example sum
   */
  aggregation?: StringOrNullType;
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
  event?: 'after' | 'before' | 'manual';
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
  operation?:
    | 'insert'
    | 'update'
    | 'delete'
    | 'bulkInsert'
    | 'bulkUpdate'
    | 'bulkDelete'
    | 'trigger';
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
  event: 'after' | 'before' | 'manual';
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
  operation:
    | 'insert'
    | 'update'
    | 'delete'
    | 'bulkInsert'
    | 'bulkUpdate'
    | 'bulkDelete'
    | 'trigger';
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
   * Unique Source ID
   * @example ds_jxuewivwbxeum2
   */
  source_id?: string;
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
  event?: 'after' | 'before' | 'manual';
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
  operation?:
    | 'insert'
    | 'update'
    | 'delete'
    | 'bulkInsert'
    | 'bulkUpdate'
    | 'bulkDelete'
    | 'trigger';
  /**
   * Hook Payload
   * @example {"method":"POST","body":"{{ json data }}","headers":[{}],"parameters":[{}],"auth":"","path":"https://webhook.site/6eb45ce5-b611-4be1-8b96-c2965755662b"}
   */
  payload?: string;
  /**
   * Base ID
   * @example p_tbhl1hnycvhe5l
   */
  base_id?: string;
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
  fk_cover_image_col_id?: StringOrNullType;
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
  source_id?: IdType;
  /** Base ID */
  base_id?: IdType;
  /** Base ID */
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
 * Model for Calendar
 */
export interface CalendarType {
  /** Unique ID */
  id?: IdType;
  /** View ID */
  fk_view_id?: IdType;
  /** Cover Image Column ID */
  fk_cover_image_col_id?: StringOrNullType;
  /** Calendar Columns */
  columns?: CalendarColumnType[];
  /** Calendar Date Range */
  calendar_range?: CalendarRangeType[];
  /** Meta Info for Kanban */
  meta?: MetaType;
  /**
   * Kanban Title
   * @example My Kanban
   */
  title?: string;
}

/**
 * Model for Calendar Column
 */
export interface CalendarColumnType {
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
  source_id?: IdType;
  /** Base ID */
  base_id?: IdType;
  /** Base ID */
  title?: string;
  /** Is this column shown? */
  show?: BoolType;
  /** Is this column shown as bold? */
  bold?: BoolType;
  /** Is this column shown as italic? */
  italic?: BoolType;
  /** Is this column shown underlines? */
  underline?: BoolType;
  /**
   * Column Order
   * @example 1
   */
  order?: number;
}

/**
 * Model for Calendar Date Range
 */
export interface CalendarRangeType {
  /** Foreign Key to Column */
  fk_from_column_id?: IdType;
  /** Foreign Key to View */
  fk_view_id?: StringOrNullType;
  /** Base ID */
  label?: string;
}

/**
 * Model for Calendar Update Request
 */
export interface CalendarUpdateReqType {
  /** Foreign Key to Cover Image Column */
  fk_cover_image_col_id?: StringOrNullType;
  /**
   * Calendar Title
   * @example Calendar 01
   */
  title?: string;
  /** Calendar Columns */
  calendar_range?: CalendarRangeType[];
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
  /** Foreign Key to child view */
  childViewId?: IdOrNullType;
  /** Foreign Key to chhild column */
  childId: IdType;
  /** Foreign Key to parent column */
  parentId: IdType;
  /** The title of the virtual column */
  title: string;
  /** The type of the relationship */
  type: 'bt' | 'hm' | 'mm' | 'oo';
  /** Abstract type of the relationship */
  uidt: 'LinkToAnotherRecord' | 'Links';
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
  fk_relation_view_id?: string;
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
   * The ID of the source that this view belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  source_id?: string;
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
   * The ID of the base that this view belongs to
   * @example p_xm3thidrblw4n7
   */
  base_id?: string;
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
   * The ID of the source that this map column belongs to
   * @example ds_g4ccx6e77h1dmi
   */
  source_id?: string;
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
   * The ID of the base that this map column belongs to
   * @example p_xm3thidrblw4n7
   */
  base_id?: string;
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
  source_id?: string;
  /** Model for Bool */
  disabled?: BoolType;
  fk_model_id?: string;
  fk_view_id?: string;
  /** Unique ID */
  id?: IdType;
  base_id?: string;
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
  cdf?: StringOrNullOrBooleanOrNumberType;
  /** Column Name */
  column_name?: string;
  /** Model for StringOrNull */
  csn?: StringOrNullType;
  /** Data Type */
  dt?: string;
  /** Data Type Extra */
  dtx?: StringOrNullType;
  /** Data Type Extra Precision */
  dtxp?: string | number | null;
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
  title: string;
  /** UI Data Type */
  uidt?:
    | 'Attachment'
    | 'AutoNumber'
    | 'Barcode'
    | 'Button'
    | 'Checkbox'
    | 'Collaborator'
    | 'Count'
    | 'CreatedTime'
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
    | 'QrCode'
    | 'Links'
    | 'User'
    | 'CreatedBy'
    | 'LastModifiedBy'
    | 'AI'
    | 'Order';
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
  /** Roles for the base user */
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
   * The current offset and it will be present only when the page is not included
   * @example 1
   */
  offset?: number;
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
  input?: string | null;
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
 * Model for Base
 */
export interface BaseType {
  /** List of source models */
  sources?: SourceType[];
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Is the base deleted */
  deleted?: BoolType;
  /**
   * Base Description
   * @example This is my base description
   */
  description?: string;
  /**
   * Unique Base ID
   * @example p_124hhlkbeasewh
   */
  id?: string;
  /**
   * Workspace ID
   * @example ws_123456
   */
  fk_workspace_id?: string;
  /** Model for Bool */
  is_meta?: BoolType;
  /** Meta Info such as theme colors */
  meta?: MetaType;
  /** The order in base list */
  order?: number;
  /**
   * Base prefix. Used in XCDB only.
   * @example nc_vm5q__
   */
  prefix?: string;
  type?: 'database' | 'documentation' | 'dashboard';
  /** List of linked Database Projects that this base has access to (only used in Dashboard bases so far) */
  linked_db_projects?: BaseType[];
  status?: string;
  /**
   * Base Title
   * @example my-base
   */
  title?: string;
  /** ID of custom url */
  fk_custom_url_id?: StringOrNullType;
}

/**
 * Model for Base List
 */
export interface ProjectListType {
  /** List of Base Models */
  list: BaseType[];
  /** Pagination Info */
  pageInfo: PaginatedType;
}

/**
 * Model for Base Request
 */
export interface ProjectReqType {
  /** Array of Bases */
  sources?: BaseReqType[];
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /**
   * Base Description
   * @example This is my base description
   */
  description?: string;
  /**
   * Base Title
   * @example My Base
   */
  title: string;
  /**
   * Base Status
   * @example locked
   */
  status?: StringOrNullType;
  type?: 'database' | 'documentation' | 'dashboard';
  /** List of Linked Database Base IDs (only used for Dashboard Projects so far) */
  linked_db_project_ids?: string[];
  /** Base Meta */
  meta?: MetaType;
}

/**
 * Model for Base Update Request
 */
export interface ProjectUpdateReqType {
  /**
   * Primary Theme Color
   * @example #24716E
   */
  color?: string;
  /** Base Meta */
  meta?: MetaType;
  /**
   * Base Title
   * @example My Base
   */
  title?: string;
  /**
   * Base Status
   * @example locked
   */
  status?: StringOrNullType;
  /** List of Linked Database Base IDs (only used for Dashboard Projects so far) */
  linked_db_project_ids?: string[];
  /**
   * The order of the list of projects.
   * @min 0
   * @example 1
   */
  order?: number;
}

/**
 * Model for Base User Request
 */
export interface ProjectUserReqType {
  /** Base User Email */
  email: string;
  /** Base User Role */
  roles:
    | 'no-access'
    | 'commenter'
    | 'editor'
    | 'guest'
    | 'owner'
    | 'viewer'
    | 'creator';
}

/**
 * Model for Base User Request
 */
export interface ProjectUserUpdateReqType {
  /**
   * Base User Email
   * @format email
   */
  email?: string;
  /** Base User Role */
  roles:
    | 'no-access'
    | 'commenter'
    | 'editor'
    | 'guest'
    | 'owner'
    | 'viewer'
    | 'creator';
}

/**
 * Model for Base User Meta Request
 */
export interface ProjectUserMetaReqType {
  /** Star Base */
  starred?: BoolType;
  /**
   * The order among the bases
   * @example 1
   */
  order?: number;
  /** Model for Bool */
  hidden?: BoolType;
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
    | 'sum'
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
   * Source ID
   * @example ds_3l9qx8xqksenrl
   */
  source_id?: string;
  /**
   * Sort direction
   * @example desc
   */
  direction?: 'asc' | 'desc' | 'count-desc' | 'count-asc';
  /** @example 1 */
  order?: number;
  /**
   * Base ID
   * @example p_9sx43moxhqtjm3
   */
  base_id?: string;
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
 * Model for TextOrNull
 */
export type TextOrNullType = string | null;

/**
 * Model for CalendarRangeOrNull
 * @example [{"id":"kvc_2skkg5mi1eb37f","fk_from_column_id":"cl_hzos4ghyncqi4k","fk_to_column_id":"cl_hzos4ghyncqi4k","fk_view_id":"vw_wqs4zheuo5lgdy","label":"string"}]
 */
export type CalendarRangeOrNullType = null | CalendarRangeType[];

/**
 * Model for StringOrNull
 */
export type StringOrNullType = string | null;

/**
 * Model for StringOrNullOrBooleanOrNumber
 */
export type StringOrNullOrBooleanOrNumberType =
  | string
  | null
  | boolean
  | number;

/**
 * Model for IdOrNull
 */
export type IdOrNullType = IdType | null;

/**
 * Model for Table
 */
export interface TableType {
  /** Unique Source ID */
  source_id?: string;
  /** The columns included in this table */
  columns?: ColumnType[];
  /** Column Models grouped by IDs */
  columnsById?: Record<string, any>;
  /** Hash of columns */
  columnsHash?: string;
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
  /** Unique Base ID */
  base_id?: string;
  /** Table Description */
  description?: TextOrNullType;
  /** Table Name. Prefix will be added for XCDB bases. */
  table_name?: string;
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
  /** Table description */
  description?: TextOrNullType;
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
  table_name?: string;
  /**
   * Table title
   * @example My Table
   */
  title: string;
}

/**
 * Model for User
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
  /** Access token version */
  token_version?: string;
  /** Meta data for user */
  meta?: MetaType;
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
  /** The base roles of the user */
  base_roles?: any;
  /** The workspace roles of the user */
  workspace_roles?: any;
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
  /** Unique Source ID */
  source_id?: IdType;
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
  /** View Description */
  description?: TextOrNullType;
  /** Password for protecting the view */
  password?: StringOrNullType;
  /** Unique Base ID */
  base_id?: IdType;
  /** If this view is shown? */
  show: BoolType;
  /** Should show system fields in this view? */
  show_system_fields?: BoolType;
  /** Is this view default view for the model? */
  is_default?: BoolType;
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
    | CalendarType
    | (FormType & GalleryType & GridType & KanbanType & MapType & CalendarType);
  /** ID of view owner user */
  owned_by?: IdType;
  /** ID of custom url */
  fk_custom_url_id?: StringOrNullType;
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
  /** Calendar Range or Null */
  calendar_range?: CalendarRangeOrNullType;
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
   * Description of the view.
   * @example This is a grid view.
   */
  description?: TextOrNullType;
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
  /** ID of view owner user */
  owned_by?: IdType;
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

export interface WebhookType {
  id?: string;
  title?: string;
  type?: string;
}

export interface ProjectInviteEventType {
  /** The ID of the user who receives the base invite */
  fk_user_id: string;
  /** The type of event, which should be set to 'PROJECT_INVITE' */
  type: string;
  body: {
    /** The ID of the base being invited to */
    base: {
      /** The ID of the base being invited to */
      id: string;
      /** The title of the base being invited to */
      title: string;
      /** The type of the base being invited to */
      type: string;
    };
    user: {
      /** The ID of the user who invited to the base */
      id: string;
      /** The email address of the user who invited to the base */
      email: string;
      /** The display name of the user who invited to the base */
      display_name?: string;
    };
  };
}

export interface WelcomeEventType {
  /** The ID of the user receiving the welcome message */
  fk_user_id: string;
  /** The type of event, which should be set to 'WELCOME' */
  type: string;
  /** An empty object */
  body: object;
}

export type NotificationType = {
  /** Unique ID */
  id?: IdType;
  /** Whether the notification has been read by the user */
  is_read?: boolean;
  /** Whether the notification has been deleted by the user */
  is_deleted?: boolean;
  /** Type of notification */
  type?: string;
  updated_at?: any;
  created_at?: any;
} & (ProjectInviteEventType | WelcomeEventType);

/**
 * Model for Notification List
 */
export interface NotificationListType {
  /** List of notification objects */
  list: NotificationType[];
  /** Model for Paginated */
  pageInfo: PaginatedType;
}

export interface NotificationUpdateType {
  is_read?: boolean;
}

export interface UserFieldRecordType {
  id: string;
  display_name?: string;
  email: string;
  deleted?: boolean;
  /** Meta data for user */
  meta?: MetaType;
}

export type NestedListCopyPasteOrDeleteAllReqType = {
  operation: 'copy' | 'paste' | 'deleteAll';
  rowId: string;
  columnId: string;
  fk_related_model_id: string;
}[];

/**
 * Model for Kanban Column Request
 */
export interface KanbanColumnReqType {
  /** Title */
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
 * Model for Gallery Column Request
 */
export interface GalleryColumnReqType {
  /** Show */
  show?: BoolType;
  /**
   * Order
   * @example 1
   */
  order?: number;
}

/**
 * Model for Calendar Column Request
 */
export interface CalendarColumnReqType {
  /** Is this column shown? */
  show?: BoolType;
  /** Is this column shown as bold? */
  bold?: BoolType;
  /** Is this column shown as italic? */
  italic?: BoolType;
  /** Is this column shown underlines? */
  underline?: BoolType;
  /**
   * Column Order
   * @example 1
   */
  order?: number;
}

export interface ErrorReportReqType {
  errors?: {
    message?: string;
    stack?: string;
  }[];
  extra?: object;
}

/**
 * Model for Comment
 */
export interface CommentType {
  /** Unique ID */
  id?: IdType;
  /**
   * Row ID
   * @example rec0Adp9PMG9o7uJy
   */
  row_id?: string;
  /**
   * Comment
   * @example This is a comment
   */
  comment?: string;
  /**
   * Created By User ID
   * @example usr0Adp9PMG9o7uJy
   */
  created_by?: IdType;
  /**
   * Created By User Email
   * @example xxx@nocodb.com
   */
  created_by_email?: string;
  /**
   * Resolved By User ID
   * @example usr0Adp9PMG9o7uJy
   */
  resolved_by?: IdType;
  /**
   * Resolved By User Email
   * @example xxx@nocodb.com
   */
  resolved_by_email?: string;
  /**
   * Parent Comment ID
   * @example cmt043cx4r30343ff
   */
  parent_comment_id?: IdType;
  /**
   * Source ID
   * @example src0Adp9PMG9o7uJy
   */
  source_id?: IdType;
  /**
   * Base ID
   * @example bas0Adp9PMG9o7uJy
   */
  base_id?: IdType;
  /**
   * Model ID
   * @example mod0Adp9PMG9o7uJy
   */
  fk_model_id?: IdType;
  /**
   * Created At
   * @example 2020-05-20T12:00:00.000000Z
   */
  created_at?: string;
  /**
   * Updated At
   * @example 2020-05-20T12:00:00.000000Z
   */
  updated_at?: string;
  /** Whether the comment has been deleted by the user or not */
  is_deleted?: boolean;
}

/**
 * Model for User Comment Notification Preference
 */
export interface UserCommentNotificationPreferenceType {
  /** Unique ID */
  id?: IdType;
  /** User ID */
  row_id?: string;
  /** User ID */
  user_id?: IdType;
  /**
   * Source ID
   * @example src0Adp9PMG9o7uJy
   */
  source_id?: IdType;
  /**
   * Base ID
   * @example bas0Adp9PMG9o7uJy
   */
  base_id?: IdType;
  /**
   * Model ID
   * @example mod0Adp9PMG9o7uJy
   */
  fk_model_id?: IdType;
  /** Is Read */
  preference?: 'ALL_COMMENTS' | 'ONLY_MENTIONS';
  /** Created At */
  created_at?: string;
  /** Updated At */
  updated_at?: string;
}

/**
 * Model for Comment Reactions
 */
export interface CommentReactionsType {
  /** Unique ID */
  id?: IdType;
  /** Row ID */
  row_id?: string;
  /** Comment ID */
  comment_id?: IdType;
  /** Reaction */
  reaction?: string;
  /** User ID */
  user_id?: IdType;
  /**
   * Source ID
   * @example src0Adp9PMG9o7uJy
   */
  source_id?: IdType;
  /**
   * Base ID
   * @example bas0Adp9PMG9o7uJy
   */
  base_id?: IdType;
  /**
   * Model ID
   * @example mod0Adp9PMG9o7uJy
   */
  fk_model_id?: IdType;
  /** Created At */
  created_at?: string;
  /** Updated At */
  updated_at?: string;
}

export interface ExtensionType {
  /** Unique ID */
  id?: IdType;
  /** Unique Base ID */
  base_id?: IdType;
  /** Unique User ID */
  fk_user_id?: IdType;
  /** Extension ID */
  extension_id?: string;
  /** Extension Title */
  title?: string;
  /** Key Value Store for the extension */
  kv_store?: MetaType;
  /** Meta data for the extension */
  meta?: MetaType;
  /** Order of the extension */
  order?: number;
}

/**
 * Model for Snapshot
 */
export interface SnapshotType {
  /** Unique ID */
  id?: IdType;
  /** Title of the Snapshot */
  title?: string;
  /** Foreign Key to Base */
  base_id?: IdType;
  /** Foreign Key to Snapshot Base */
  snapshot_base_id?: IdType;
  /** Foreign Key to Workspace */
  fk_workspace_id?: IdType;
  /**
   * Date of creation
   * @format date
   */
  created_at?: string;
  /** User ID of the creator */
  created_by?: IdType;
  /** Status of the Snapshot */
  status?: string;
}

export interface ExtensionReqType {
  /** Unique Base ID */
  base_id?: IdType;
  /** Extension Title */
  title?: string;
  /** Extension ID */
  extension_id?: string;
  /** Key Value Store for the extension */
  kv_store?: MetaType;
  /** Meta data for the extension */
  meta?: MetaType;
  /** Order of the extension */
  order?: number;
}

export interface AIRecordType {
  /** Value */
  value?: string;
  /** Last Modified By User ID */
  lastModifiedBy?: IdType;
  /** Last Modified Time */
  lastModifiedTime?: string;
  /** Is any referenced value updated? */
  isStale?: boolean;
}

export enum ButtonActionsType {
  Webhook = 'webhook',
  Url = 'url',
  Ai = 'ai',
  Script = 'script',
}

/**
 * Model for Custom Url
 */
export interface CustomUrlType {
  /** Id associated to the Custom url */
  id?: string;
  /** Workspace ID */
  fk_workspace_id?: string;
  /** Base ID */
  base_id?: string;
  /** Model ID */
  fk_model_id?: string;
  /** View ID */
  view_id?: string;
  /** Original url used for redirection purpose */
  original_path?: string;
  /** Custom url path */
  custom_path?: string;
}

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
      baseURL: axiosConfig.baseURL || 'http://localhost:8080',
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
    params2?: AxiosRequestConfig
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
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      const propertyContent: any[] =
        property instanceof Array ? property : [property];

      for (const formItem of propertyContent) {
        const isFileType = formItem instanceof Blob || formItem instanceof File;
        formData.append(
          key,
          isFileType ? formItem : this.stringifyFormItem(formItem)
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
          ...(type && type !== ContentType.FormData
            ? { 'Content-Type': type }
            : {}),
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
  userProfile = {
    /**
     * @description Update User Profile
     *
     * @tags User profile
     * @name Update
     * @summary Update User Profile
     * @request PATCH:/api/v1/user/profile
     * @response `200` `UserType`
     */
    update: (data: UserType, params: RequestParams = {}) =>
      this.request<UserType, any>({
        path: `/api/v1/user/profile`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
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
        /** Pass base id to get base specific roles along with user info */
        base_id?: IdType;
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
 * @description Creates a new refresh token and JWT auth token for the user. The refresh token is sent as a cookie, while the JWT auth token is included in the response body.
 * 
 * @tags Auth
 * @name TokenRefresh
 * @summary Refresh Token
 * @request POST:/api/v1/auth/token/refresh
 * @response `200` `{
  \**
   * New JWT auth token for user
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
           * New JWT auth token for user
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
 * @description List all users in the given base.
 * 
 * @tags Auth
 * @name BaseUserList
 * @summary List Base Users
 * @request GET:/api/v1/db/meta/projects/{baseId}/users
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
    baseUserList: (baseId: IdType, params: RequestParams = {}) =>
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
        path: `/api/v1/db/meta/projects/${baseId}/users`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a user and add it to the given base
 * 
 * @tags Auth
 * @name BaseUserAdd
 * @summary Create Base User
 * @request POST:/api/v1/db/meta/projects/{baseId}/users
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
    baseUserAdd: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/users`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Update a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Auth
 * @name BaseUserUpdate
 * @summary Update Base User
 * @request PATCH:/api/v1/db/meta/projects/{baseId}/users/{userId}
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
    baseUserUpdate: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/users/${userId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete a given user in a given base. Exclusive for Super Admin. Access with API Tokens will be blocked.
 * 
 * @tags Auth
 * @name BaseUserRemove
 * @summary Delete Base User
 * @request DELETE:/api/v1/db/meta/projects/{baseId}/users/{userId}
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
    baseUserRemove: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/users/${userId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Resend Invitation to a specific user
 * 
 * @tags Auth
 * @name BaseUserResendInvite
 * @summary Resend User Invitation
 * @request POST:/api/v1/db/meta/projects/{baseId}/users/{userId}/resend-invite
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
    baseUserResendInvite: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/users/${userId}/resend-invite`,
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
 * @request DELETE:/api/v1/tokens/{tokenId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (tokenId: string, params: RequestParams = {}) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/tokens/${tokenId}`,
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
  base = {
    /**
 * @description Get info such as node version, arch, platform, is docker, rootdb and package version of a given base
 * 
 * @tags Base
 * @name MetaGet
 * @summary Get Base info
 * @request GET:/api/v1/db/meta/projects/{baseId}/info
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
   * Is base on rootdb
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
    metaGet: (baseId: IdType, params: RequestParams = {}) =>
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
           * Is base on rootdb
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
        path: `/api/v1/db/meta/projects/${baseId}/info`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Hide / show views based on user role
 * 
 * @tags Base
 * @name ModelVisibilityList
 * @summary Get UI ACL
 * @request GET:/api/v1/db/meta/projects/{baseId}/visibility-rules
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    modelVisibilityList: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/visibility-rules`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Hide / show views based on user role
 * 
 * @tags Base
 * @name ModelVisibilitySet
 * @summary Create UI ACL
 * @request POST:/api/v1/db/meta/projects/{baseId}/visibility-rules
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
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/visibility-rules`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description List all base meta data
 * 
 * @tags Base
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
 * @description Create a new base
 * 
 * @tags Base
 * @name Create
 * @summary Create Base
 * @request POST:/api/v1/db/meta/projects/
 * @response `200` `BaseType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      data: ProjectReqType & {
        /** If true, the base will us an external database else it will use the root database */
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
        path: `/api/v1/db/meta/projects/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Duplicate a base
 * 
 * @tags Base
 * @name SourceDuplicate
 * @summary Duplicate Base Source
 * @request POST:/api/v1/db/meta/duplicate/{baseId}/{sourceId}
 * @response `200` `{
  name?: string,
  id?: string,
  base_id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sourceDuplicate: (
      baseId: IdType,
      data: {
        options?: {
          excludeData?: boolean;
          excludeViews?: boolean;
          excludeHooks?: boolean;
        };
        base?: object;
      },
      sourceId?: IdType,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          name?: string;
          id?: string;
          base_id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/duplicate/${baseId}/${sourceId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Duplicate a base
 * 
 * @tags Base
 * @name Duplicate
 * @summary Duplicate Base
 * @request POST:/api/v1/db/meta/duplicate/{baseId}
 * @response `200` `{
  name?: string,
  id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    duplicate: (
      baseId: IdType,
      data: {
        options?: {
          excludeData?: boolean;
          excludeViews?: boolean;
          excludeHooks?: boolean;
        };
        base?: object;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          name?: string;
          id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/duplicate/${baseId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the info of a given base
 * 
 * @tags Base
 * @name Read
 * @summary Get Base
 * @request GET:/api/v1/db/meta/projects/{baseId}
 * @response `200` `BaseType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        BaseType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the given base
 * 
 * @tags Base
 * @name Delete
 * @summary Delete Base
 * @request DELETE:/api/v1/db/meta/projects/{baseId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the given base
 * 
 * @tags Base
 * @name Update
 * @summary Update Base
 * @request PATCH:/api/v1/db/meta/projects/{baseId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Base
     * @name UserMetaUpdate
     * @summary Base user meta update
     * @request PATCH:/api/v1/db/meta/projects/{baseId}/user
     * @response `200` `void` OK
     */
    userMetaUpdate: (
      baseId: string,
      data: ProjectUserMetaReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${baseId}/user`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
 * @description Get Base Shared Base
 * 
 * @tags Base
 * @name SharedBaseGet
 * @summary Get Base Shared Base
 * @request GET:/api/v1/db/meta/projects/{baseId}/shared
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
  \** ID of custom url *\
  fk_custom_url_id?: StringOrNullType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseGet: (baseId: IdType, params: RequestParams = {}) =>
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
          /** ID of custom url */
          fk_custom_url_id?: StringOrNullType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/shared`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete Base Shared Base
 * 
 * @tags Base
 * @name SharedBaseDisable
 * @summary Delete Base Shared Base
 * @request DELETE:/api/v1/db/meta/projects/{baseId}/shared
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseDisable: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/shared`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create Base Shared Base
 * 
 * @tags Base
 * @name SharedBaseCreate
 * @summary Create Base Shared Base
 * @request POST:/api/v1/db/meta/projects/{baseId}/shared
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
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/shared`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Update Base Shared Base
 * 
 * @tags Base
 * @name SharedBaseUpdate
 * @summary Update Base Shared Base
 * @request PATCH:/api/v1/db/meta/projects/{baseId}/shared
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
  \** ID of custom url *\
  fk_custom_url_id?: StringOrNullType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseUpdate: (
      baseId: IdType,
      data: SharedBaseReqType & {
        /** Custom url path */
        custom_url_path?: StringOrNullType;
      },
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
          /** ID of custom url */
          fk_custom_url_id?: StringOrNullType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/shared`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Calculate the Base Cost
 * 
 * @tags Base
 * @name Cost
 * @summary Base Cost
 * @request GET:/api/v1/db/meta/projects/{baseId}/cost
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    cost: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/cost`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Duplicate a shared base
 * 
 * @tags Base
 * @name DuplicateShared
 * @summary Duplicate Shared Base
 * @request POST:/api/v2/meta/duplicate/{workspaceId}/shared/{sharedBaseId}
 * @response `200` `{
  name?: string,
  id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    duplicateShared: (
      workspaceId: IdType,
      sharedBaseId: any,
      data: {
        options?: {
          excludeData?: boolean;
          excludeViews?: boolean;
        };
        base?: object;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          name?: string;
          id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/meta/duplicate/${workspaceId}/shared/${sharedBaseId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Synchronise the meta data difference between NC_DB and external data sources 
 * 
 * @tags Base
 * @name MetaDiffSync
 * @summary Sync Meta
 * @request POST:/api/v1/db/meta/projects/{baseId}/meta-diff
 * @response `200` `{
  \** @example The meta has been synchronized successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffSync: (baseId: IdType, params: RequestParams = {}) =>
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
        path: `/api/v1/db/meta/projects/${baseId}/meta-diff`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the meta data difference between NC_DB and external data sources 
 * 
 * @tags Base
 * @name MetaDiffGet
 * @summary Meta Diff
 * @request GET:/api/v1/db/meta/projects/{baseId}/meta-diff
 * @response `200` `({
  \**
   * Table Name
   * @example Table 1
   *\
  table_name?: string,
  \**
   * Source ID
   * @example ds_rrplkgy0pq1f3c
   *\
  source_id?: string,
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
    metaDiffGet: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /**
           * Table Name
           * @example Table 1
           */
          table_name?: string;
          /**
           * Source ID
           * @example ds_rrplkgy0pq1f3c
           */
          source_id?: string;
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
        path: `/api/v1/db/meta/projects/${baseId}/meta-diff`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Check if a base contains empty and null filters. Used in `Show NULL and EMPTY in Filter` in Base Setting.
 * 
 * @tags Base
 * @name HasEmptyOrNullFilters
 * @summary List Empty & Null Filter
 * @request GET:/api/v1/db/meta/projects/{baseId}/has-empty-or-null-filters
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    hasEmptyOrNullFilters: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/has-empty-or-null-filters`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description List all audit data in the given base
 * 
 * @tags Base
 * @name AuditList
 * @summary List Audits in Base
 * @request GET:/api/v1/db/meta/projects/{baseId}/audits
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
      baseId: IdType,
      query?: {
        /** @min 0 */
        offset?: number;
        /** @min 1 */
        limit?: number;
        sourceId?: string;
        orderBy?: {
          /**
           * Sort direction
           * @example desc
           */
          created_at?: 'asc' | 'desc';
          /**
           * Sort direction
           * @example desc
           */
          user?: 'asc' | 'desc';
        };
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
        path: `/api/v1/db/meta/projects/${baseId}/audits`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  source = {
    /**
 * @description Get the source details of a given base
 * 
 * @tags Source
 * @name Read
 * @summary Get Source
 * @request GET:/api/v1/db/meta/projects/{baseId}/bases/{sourceId}
 * @response `200` `SourceType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (baseId: IdType, sourceId: string, params: RequestParams = {}) =>
      this.request<
        SourceType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the source details of a given base
 * 
 * @tags Source
 * @name Delete
 * @summary Delete Source
 * @request DELETE:/api/v1/db/meta/projects/{baseId}/bases/{sourceId}
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (baseId: IdType, sourceId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the source details of a given base
 * 
 * @tags Source
 * @name Update
 * @summary Update Source
 * @request PATCH:/api/v1/db/meta/projects/{baseId}/bases/{sourceId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      baseId: IdType,
      sourceId: string,
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
        path: `/api/v1/db/meta/projects/${baseId}/bases/${sourceId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get base source list
 * 
 * @tags Source
 * @name List
 * @summary List Sources
 * @request GET:/api/v1/db/meta/projects/{baseId}/bases/
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/bases/`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new source on a given base
 * 
 * @tags Source
 * @name Create
 * @summary Create Source
 * @request POST:/api/v1/db/meta/projects/{baseId}/bases/
 * @response `200` `SourceType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      baseId: IdType,
      data: SourceType & {
        external?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        SourceType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/bases/`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Source
     * @name ShareErd
     * @summary share ERD view
     * @request POST:/api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd
     * @response `200` `SourceType` OK
     */
    shareErd: (baseId: string, sourceId: string, params: RequestParams = {}) =>
      this.request<SourceType, any>({
        path: `/api/v1/db/meta/projects/${baseId}/bases/${sourceId}/share/erd`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
     * No description
     *
     * @tags Source
     * @name DisableShareErd
     * @request DELETE:/api/v1/db/meta/projects/{baseId}/bases/{sourceId}/share/erd
     * @response `200` `void` OK
     */
    disableShareErd: (
      baseId: string,
      sourceId: string,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/db/meta/projects/${baseId}/bases/${sourceId}/share/erd`,
        method: 'DELETE',
        ...params,
      }),

    /**
 * @description List all tables in a given Base and Source
 * 
 * @tags Source
 * @name TableList
 * @summary List Tables
 * @request GET:/api/v1/db/meta/projects/{baseId}/{sourceId}/tables
 * @response `200` `TableListType`
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    tableList: (
      baseId: IdType,
      sourceId: string,
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
        path: `/api/v1/db/meta/projects/${baseId}/${sourceId}/tables`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
 * @description Create a new table in a given Base and Source
 * 
 * @tags Source
 * @name TableCreate
 * @summary Create Table
 * @request POST:/api/v1/db/meta/projects/{baseId}/{sourceId}/tables
 * @response `200` `TableType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    tableCreate: (
      baseId: IdType,
      sourceId: string,
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
        path: `/api/v1/db/meta/projects/${baseId}/${sourceId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Synchronise the meta data difference between NC_DB and external data sources in a given Source
 * 
 * @tags Source
 * @name MetaDiffSync
 * @summary Synchronise Source Meta
 * @request POST:/api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}
 * @response `200` `{
  \** @example The source meta has been synchronized successfully *\
  msg?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    metaDiffSync: (
      baseId: IdType,
      sourceId: string,
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** @example The source meta has been synchronized successfully */
          msg?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/meta-diff/${sourceId}`,
        method: 'POST',
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the meta data difference between NC_DB and external data sources in a given Source
 * 
 * @tags Source
 * @name MetaDiffGet
 * @summary Source Meta Diff
 * @request GET:/api/v1/db/meta/projects/{baseId}/meta-diff/{sourceId}
 * @response `200` `({
  \**
   * Table Name
   * @example Table 1
   *\
  table_name?: string,
  \**
   * Source ID
   * @example ds_rrplkgy0pq1f3c
   *\
  source_id?: string,
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
      baseId: IdType,
      sourceId: string,
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
           * Source ID
           * @example ds_rrplkgy0pq1f3c
           */
          source_id?: string;
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
        path: `/api/v1/db/meta/projects/${baseId}/meta-diff/${sourceId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),
  };
  dbTable = {
    /**
 * @description Create a new table in a given base
 * 
 * @tags DB Table
 * @name Create
 * @summary Create Table
 * @request POST:/api/v1/db/meta/projects/{baseId}/tables
 * @response `200` `TableType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (baseId: IdType, data: TableReqType, params: RequestParams = {}) =>
      this.request<
        TableType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/tables`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description List all tables in a given base
 * 
 * @tags DB Table
 * @name List
 * @summary List Tables
 * @request GET:/api/v1/db/meta/projects/{baseId}/tables
 * @response `200` `TableListType`
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/tables`,
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
         * Table description
         * @example Table for storing User Information
         */
        description?: TextOrNullType;
        /**
         * Base ID
         * @example p_124hhlkbeasewh
         */
        base_id?: string;
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
 * @description Duplicate a table
 * 
 * @tags DB Table
 * @name Duplicate
 * @summary Duplicate Table
 * @request POST:/api/v1/db/meta/duplicate/{baseId}/table/{tableId}
 * @response `200` `{
  name?: string,
  id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    duplicate: (
      baseId: IdType,
      tableId: IdType,
      data: {
        options?: {
          excludeData?: boolean;
          excludeViews?: boolean;
          excludeHooks?: boolean;
          /** New table title */
          title?: string;
        };
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          name?: string;
          id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/duplicate/${baseId}/table/${tableId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Duplicate a column
 * 
 * @tags DB Table
 * @name DuplicateColumn
 * @summary Duplicate Column
 * @request POST:/api/v1/db/meta/duplicate/{baseId}/column/{columnId}
 * @response `200` `{
  name?: string,
  id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    duplicateColumn: (
      baseId: IdType,
      columnId: IdType,
      data: {
        options?: {
          excludeData?: boolean;
        };
        extra?: object;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          name?: string;
          id?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/duplicate/${baseId}/column/${columnId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
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

    /**
 * @description Get columns hash for table
 * 
 * @tags DB Table Column
 * @name Hash
 * @summary Get columns hash for table
 * @request GET:/api/v1/db/meta/tables/{tableId}/columns/hash
 * @response `200` `{
  \** Columns hash *\
  hash?: string,

}` OK
 */
    hash: (tableId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          /** Columns hash */
          hash?: string;
        },
        any
      >({
        path: `/api/v1/db/meta/tables/${tableId}/columns/hash`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Bulk create-update-delete columns
 * 
 * @tags DB Table Column
 * @name Bulk
 * @summary Bulk create-update-delete columns
 * @request POST:/api/v1/db/meta/tables/{tableId}/columns/bulk
 * @response `200` `{
  failedOps?: (any)[],

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulk: (
      tableId: IdType,
      data: {
        /** Columns hash */
        hash?: string;
        ops?: any[];
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          failedOps?: any[];
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/tables/${tableId}/columns/bulk`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
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

    /**
 * @description Create a new Calendar View
 * 
 * @tags DB View
 * @name CalendarCreate
 * @summary Create Calendar View
 * @request POST:/api/v1/db/meta/tables/{tableId}/calendars
 * @response `200` `ViewType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    calendarCreate: (
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
        path: `/api/v1/db/meta/tables/${tableId}/calendars`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the Calendar View data with Calendar ID
 * 
 * @tags DB View
 * @name CalendarUpdate
 * @summary Update Calendar View
 * @request PATCH:/api/v1/db/meta/calendars/{calendarViewId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    calendarUpdate: (
      calendarViewId: string,
      data: CalendarUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/calendars/${calendarViewId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the Calendar View data by Calendar ID
 * 
 * @tags DB View
 * @name CalendarRead
 * @summary Get Calendar View
 * @request GET:/api/v1/db/meta/calendars/{calendarViewId}
 * @response `200` `CalendarType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    calendarRead: (calendarViewId: string, params: RequestParams = {}) =>
      this.request<
        CalendarType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/calendars/${calendarViewId}`,
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
      data: SharedViewReqType & {
        /** Custom url path */
        custom_url_path?: StringOrNullType;
      },
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
    read: (
      viewId: string,
      query?: {
        includeAllFilters?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FilterListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/views/${viewId}/filters`,
        method: 'GET',
        query: query,
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
    list: (
      hookId: IdType,
      query?: {
        /** @min 1 */
        limit?: number;
        /** @min 0 */
        offset?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        HookLogListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/hooks/${hookId}/logs`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  dbTableRow = {
    /**
 * @description List all table rows in a given table and base
 * 
 * @tags DB Table Row
 * @name List
 * @summary List Table Rows
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}
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
      baseName: string,
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
        /** Comma separated list of pks */
        pks?: string;
        /** Get hidden columns on List Api */
        getHiddenColumns?: string;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new row in a given table and base.
 * 
 * @tags DB Table Row
 * @name Create
 * @summary Create Table Row
 * @request POST:/api/v1/db/data/{orgs}/{baseName}/{tableName}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      orgs: string,
      baseName: string,
      tableName: string,
      data: object,
      query?: {
        before?: string;
        undo?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}`,
        method: 'POST',
        query: query,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/find-one
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    findOne: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/find-one`,
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
     * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/groupby
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    groupBy: (
      orgs: string,
      baseName: string,
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
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/groupby`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/group/{columnId}
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    groupedDataList: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/group/${columnId}`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (
      orgs: string,
      baseName: string,
      tableName: string,
      rowId: any,
      query?: {
        /** To get Hidden Columns */
        getHiddenColumn?: boolean;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Update the Table Row
 * 
 * @tags DB Table Row
 * @name Update
 * @summary Update Table Row
 * @request PATCH:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      orgs: string,
      baseName: string,
      tableName: string,
      rowId: any,
      data: object,
      query?: {
        /** To get Hidden Columns */
        getHiddenColumn?: boolean;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}`,
        method: 'PATCH',
        query: query,
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
 * @request DELETE:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (
      orgs: string,
      baseName: string,
      tableName: string,
      rowId: any,
      query?: {
        /** To get Hidden Columns */
        getHiddenColumn?: boolean;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}`,
        method: 'DELETE',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description check row with provided primary key exists or not
 * 
 * @tags DB Table Row
 * @name Exist
 * @summary Does Table Row Exist
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/exist
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    exist: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}/exist`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Bulk upsert table rows in one go.
 * 
 * @tags DB Table Row
 * @name BulkUpsert
 * @summary Bulk Upsert Table Rows
 * @request POST:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/upsert
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkUpsert: (
      orgs: string,
      baseName: string,
      tableName: string,
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        any[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}/upsert`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Bulk insert table rows in one go.
 * 
 * @tags DB Table Row
 * @name BulkCreate
 * @summary Bulk Insert Table Rows
 * @request POST:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}
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
      baseName: string,
      tableName: string,
      data: object[],
      query?: {
        undo?: string;
      },
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
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}`,
        method: 'POST',
        query: query,
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
 * @request PATCH:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}
 * @response `200` `(number)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkUpdate: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}`,
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
 * @request DELETE:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}
 * @response `200` `(number)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkDelete: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}`,
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
 * @request PATCH:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkUpdateAll: (
      orgs: string,
      baseName: string,
      tableName: string,
      data: object,
      query?: {
        where?: string;
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}/all`,
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
 * @request DELETE:/api/v1/db/data/bulk/{orgs}/{baseName}/{tableName}/all
 * @response `200` `(object)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    bulkDeleteAll: (
      orgs: string,
      baseName: string,
      tableName: string,
      query?: {
        where?: string;
        viewId?: string;
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
        path: `/api/v1/db/data/bulk/${orgs}/${baseName}/${tableName}/all`,
        method: 'DELETE',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Export Table View Rows by CSV or Excel
 * 
 * @tags DB Table Row
 * @name CsvExport
 * @summary Export Table View Rows
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/export/{type}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    csvExport: (
      orgs: string,
      baseName: string,
      tableName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/export/${type}`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    nestedList: (
      orgs: string,
      baseName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt' | 'oo',
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
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}/${relationType}/${columnName}`,
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
 * @request POST:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
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
      baseName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt' | 'oo',
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}/${relationType}/${columnName}/${refRowId}`,
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
 * @request DELETE:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/{refRowId}
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
      baseName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt' | 'oo',
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}/${relationType}/${columnName}/${refRowId}`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/{rowId}/{relationType}/{columnName}/exclude
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    nestedChildrenExcludedList: (
      orgs: string,
      baseName: string,
      tableName: string,
      rowId: any,
      relationType: 'mm' | 'hm' | 'bt' | 'oo',
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
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/${rowId}/${relationType}/${columnName}/exclude`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/group/{columnId}
 * @response `200` `(any)[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    groupedDataList: (
      orgs: IdType,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/group/${columnId}`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}
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
      baseName: string,
      tableName: string,
      viewName: string,
      query?: {
        fields?: any[];
        sort?: any[];
        where?: string;
        /** Query params for nested data */
        nested?: any;
        offset?: number;
        getHiddenColumns?: boolean;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}`,
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
 * @request POST:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      orgs: string,
      baseName: string,
      tableName: string,
      viewName: string,
      data: object,
      query?: {
        before?: string;
        undo?: string;
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}`,
        method: 'POST',
        query: query,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/find-one
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    findOne: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/find-one`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get the table view rows grouped by the given query
 * 
 * @tags DB View Row
 * @name GroupBy
 * @summary Group By Table View Row
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/groupby
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    groupBy: (
      orgs: string,
      baseName: string,
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
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/groupby`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/count
 * @response `200` `{
  count?: number,

}` OK
 */
    count: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/count`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/${rowId}`,
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
 * @request PATCH:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/${rowId}`,
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
 * @request DELETE:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/${rowId}`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/{rowId}/exist
 * @response `201` `number` Created
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    exist: (
      orgs: string,
      baseName: string,
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
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/${rowId}/exist`,
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
 * @request GET:/api/v1/db/data/{orgs}/{baseName}/{tableName}/views/{viewName}/export/{type}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    export: (
      orgs: string,
      baseName: string,
      tableName: string,
      viewName: string,
      type: 'csv' | 'excel',
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/data/${orgs}/${baseName}/${tableName}/views/${viewName}/export/${type}`,
        method: 'GET',
        wrapped: true,
        ...params,
      }),
  };
  dbCalendarViewRow = {
    /**
     * @description List all rows in Calendar View of a Table
     *
     * @tags DB Calendar View Row
     * @name List
     * @summary List rows in Calendar View of a Table
     * @request GET:/api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}
     */
    list: (
      orgs: string,
      baseName: string,
      tableName: string,
      viewName: string,
      query: {
        from_date: string;
        to_date: string;
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
        path: `/api/v1/db/calendar-data/${orgs}/${baseName}/${tableName}/views/${viewName}`,
        method: 'GET',
        query: query,
        ...params,
      }),

    /**
     * @description List all rows in Calendar View of a Table
     *
     * @tags DB Calendar View Row
     * @name PublicDataCalendarRowList
     * @summary List rows in Calendar View of a Table
     * @request GET:/api/v1/db/public/calendar-view/{sharedViewUuid}
     */
    publicDataCalendarRowList: (
      sharedViewUuid: string,
      query: {
        from_date: string;
        to_date: string;
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
        path: `/api/v1/db/public/calendar-view/${sharedViewUuid}`,
        method: 'GET',
        query: query,
        ...params,
      }),
  };
  api = {
    /**
     * No description
     *
     * @name ResponsesApi
     * @request RESPONSES:/api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}
     */
    responsesApi: (
      orgs: string,
      baseName: string,
      tableName: string,
      viewName: string,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v1/db/calendar-data/${orgs}/${baseName}/${tableName}/views/${viewName}`,
        method: 'RESPONSES',
        ...params,
      }),

    /**
     * No description
     *
     * @name ResponsesApi2
     * @request RESPONSES:/api/v1/db/public/calendar-view/{sharedViewUuid}
     * @originalName responsesApi
     * @duplicate
     */
    responsesApi2: (sharedViewUuid: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/public/calendar-view/${sharedViewUuid}`,
        method: 'RESPONSES',
        ...params,
      }),
  };
  dbCalendarViewRowCount = {
    /**
 * @description Get the count of table view rows grouped by the dates
 * 
 * @tags DB Calendar View Row Count
 * @name DbCalendarViewRowCount
 * @summary Count of Records in Dates in Calendar View
 * @request GET:/api/v1/db/calendar-data/{orgs}/{baseName}/{tableName}/views/{viewName}/countByDate/
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dbCalendarViewRowCount: (
      orgs: string,
      baseName: string,
      tableName: string,
      viewName: string,
      query: {
        from_date: string;
        to_date: string;
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
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/calendar-data/${orgs}/${baseName}/${tableName}/views/${viewName}/countByDate/`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  public = {
    /**
 * No description
 * 
 * @tags Public
 * @name DataCalendarRowCount
 * @summary Count of Records in Dates in Calendar View
 * @request GET:/api/v1/db/public/calendar-view/{sharedViewUuid}/countByDate
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataCalendarRowCount: (
      sharedViewUuid: string,
      query: {
        from_date: string;
        to_date: string;
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
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/public/calendar-view/${sharedViewUuid}/countByDate`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Count how many rows in the given Table View
 * 
 * @tags Public
 * @name DbViewRowCount
 * @summary Count Table View Rows
 * @request GET:/api/v2/public/shared-view/{sharedViewUuid}/count
 * @response `200` `{
  count?: number,

}` OK
 */
    dbViewRowCount: (
      sharedViewUuid: string,
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
        path: `/api/v2/public/shared-view/${sharedViewUuid}/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Read bulk data from a given table with provided filters
 * 
 * @tags Public
 * @name DataTableBulkDataList
 * @summary Read Shared View Bulk Data List
 * @request POST:/api/v2/public/shared-view/{sharedViewUuid}/bulk/dataList
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataTableBulkDataList: (
      sharedViewUuid: string,
      data: object[],
      query?: {
        /** Extra filtering */
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
        path: `/api/v2/public/shared-view/${sharedViewUuid}/bulk/dataList`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Read bulk group data from a given table with provided filters
 * 
 * @tags Public
 * @name DataTableBulkGroup
 * @summary Read Shared View Bulk Group Data
 * @request POST:/api/v2/public/shared-view/{sharedViewUuid}/bulk/group
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataTableBulkGroup: (
      sharedViewUuid: string,
      data: object[],
      query?: {
        /** Extra filtering */
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
        path: `/api/v2/public/shared-view/${sharedViewUuid}/bulk/group`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Read aggregated data from a given table
 * 
 * @tags Public
 * @name DataTableAggregate
 * @summary Read Shared View Aggregated Data
 * @request GET:/api/v2/public/shared-view/{sharedViewUuid}/aggregate
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataTableAggregate: (
      sharedViewUuid: string,
      query?: {
        /** Extra filtering */
        where?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
        /** List of fields to be aggregated */
        aggregation?: object[];
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
        path: `/api/v2/public/shared-view/${sharedViewUuid}/aggregate`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Download attachment from a shared view
 * 
 * @tags Public
 * @name DataAttachmentDownload
 * @summary Get Shared View Attachment
 * @request GET:/api/v2/public/shared-view/{sharedViewUuid}/downloadAttachment/{columnId}/{rowId}
 * @response `200` `{
  \** URL to download the attachment *\
  url?: string,
  \** Path to download the attachment *\
  path?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataAttachmentDownload: (
      sharedViewUuid: string,
      columnId: IdType,
      rowId: any,
      query?: {
        /** URL or Path of the attachment */
        urlOrPath?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** URL to download the attachment */
          url?: string;
          /** Path to download the attachment */
          path?: string;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/public/shared-view/${sharedViewUuid}/downloadAttachment/${columnId}/${rowId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

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
        /** Comma separated list of pks */
        pks?: string;
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
      data: any,
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
        type: ContentType.FormData,
        format: 'json',
        ...params,
      }),

    /**
 * @description List all shared view rows grouped by a column
 * 
 * @tags Public
 * @name DataGroupBy
 * @summary List Shared View Rows
 * @request GET:/api/v1/db/public/shared-view/{sharedViewUuid}/groupby
 * @response `200` `SharedViewListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dataGroupBy: (
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
        /** Columns to group by */
        column_name?: string;
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
        path: `/api/v1/db/public/shared-view/${sharedViewUuid}/groupby`,
        method: 'GET',
        query: query,
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
      relationType: 'mm' | 'hm' | 'bt' | 'oo',
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
 * @response `200` `FieldOptionsButtonV3Type` OK
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
        FieldOptionsButtonV3Type,
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
 * @response `200` `FieldOptionsButtonV3Type` OK
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
        FieldOptionsButtonV3Type,
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
 * @description Get Share Source Meta
 * 
 * @tags Public
 * @name SharedBaseGet
 * @summary Get Share Source Meta
 * @request GET:/api/v1/db/public/shared-base/{sharedBaseUuid}/meta
 * @response `200` `{
  \** Base ID *\
  base_id?: string,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    sharedBaseGet: (sharedBaseUuid: string, params: RequestParams = {}) =>
      this.request<
        {
          /** Base ID */
          base_id?: string;
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
  source_id?: string,
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
          source_id?: string;
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

    /**
     * No description
     *
     * @tags Public
     * @name SharedErdMetaGet
     * @request GET:/api/v1/db/public/shared-erd/{sharedErdUuid}/meta
     */
    sharedErdMetaGet: (sharedErdUuid: string, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/db/public/shared-erd/${sharedErdUuid}/meta`,
        method: 'GET',
        ...params,
      }),
  };
  dbDataTableBulkList = {
    /**
 * @description Read bulk data from a given table with given filters
 * 
 * @tags DB Data Table Bulk List
 * @name DbDataTableBulkList
 * @summary Read Bulk Data
 * @request POST:/api/v2/tables/{tableId}/bulk/dataList
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dbDataTableBulkList: (
      tableId: string,
      query: {
        /** View ID is required */
        viewId: string;
        /** Extra filtering */
        where?: string;
      },
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/bulk/dataList`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  dbDataTableBulkGroupList = {
    /**
 * @description Read bulk group data from a given table with given filters
 * 
 * @tags DB Data Table Bulk Group List
 * @name DbDataTableBulkGroupList
 * @summary Read Bulk Group Data
 * @request POST:/api/v2/tables/{tableId}/bulk/group
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dbDataTableBulkGroupList: (
      tableId: string,
      query: {
        /** View ID is required */
        viewId: string;
      },
      data: object[],
      params: RequestParams = {}
    ) =>
      this.request<
        object,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/bulk/group`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  utils = {
    /**
 * @description List all audits
 * 
 * @tags Utils
 * @name AuditList
 * @summary List Audits
 * @request GET:/api/v1/db/meta/audits
 * @response `200` `{
  list: (AuditType)[],
  \** Pagination Info *\
  pageInfo?: PaginatedType,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    auditList: (
      query: {
        /** @min 0 */
        offset?: number;
        /** @min 1 */
        limit?: number;
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
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          list: AuditType[];
          /** Pagination Info */
          pageInfo?: PaginatedType;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/audits`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description List all comments
 * 
 * @tags Utils
 * @name CommentList
 * @summary List Comments
 * @request GET:/api/v1/db/meta/comments
 * @response `200` `{
  list: (CommentType)[],

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
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          list: CommentType[];
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/comments`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new comment in a row.
 * 
 * @tags Utils
 * @name CommentRow
 * @summary Comment Rows
 * @request POST:/api/v1/db/meta/comments
 * @response `200` `CommentType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    commentRow: (data: CommentReqType, params: RequestParams = {}) =>
      this.request<
        CommentType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/comments`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update comment
     *
     * @tags Utils
     * @name CommentUpdate
     * @summary Update Comment
     * @request PATCH:/api/v1/db/meta/comment/{commentId}/
     * @response `200` `number` OK
     */
    commentUpdate: (
      commentId: string,
      data: CommentUpdateReqType,
      params: RequestParams = {}
    ) =>
      this.request<number, any>({
        path: `/api/v1/db/meta/comment/${commentId}/`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete comment
     *
     * @tags Utils
     * @name CommentDelete
     * @summary Delete Comment
     * @request DELETE:/api/v1/db/meta/comment/{commentId}/
     * @response `200` `number` OK
     */
    commentDelete: (commentId: string, data: any, params: RequestParams = {}) =>
      this.request<number, any>({
        path: `/api/v1/db/meta/comment/${commentId}/`,
        method: 'DELETE',
        body: data,
        format: 'json',
        ...params,
      }),

    /**
 * @description Return the number of comments in the given query.
 * 
 * @tags Utils
 * @name CommentCount
 * @summary Count Comments
 * @request GET:/api/v1/db/meta/comments/count
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
        path: `/api/v1/db/meta/comments/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description List all audit data in the given project
 * 
 * @tags Utils
 * @name ProjectAuditList
 * @summary List Audits in Project
 * @request GET:/api/v1/db/meta/projects/audits
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
    projectAuditList: (
      query?: {
        /** @min 0 */
        offset?: number;
        /** @min 1 */
        limit?: number;
        orderBy?: {
          /**
           * Sort direction
           * @example desc
           */
          created_at?: 'asc' | 'desc';
          /**
           * Sort direction
           * @example desc
           */
          user?: 'asc' | 'desc';
        };
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
        path: `/api/v1/db/meta/projects/audits`,
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
          | 'sqlite3'
          | 'databricks';
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
  client?: "mssql" | "mysql" | "mysql2" | "oracledb" | "pg" | "snowflake" | "sqlite3" | "databricks",
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
            | 'sqlite3'
            | 'databricks';
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
  baseHasAdmin?: boolean,
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
  errorReportingEnabled?: boolean,
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
          baseHasAdmin?: boolean;
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
          errorReportingEnabled?: boolean;
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
     * @description Error Reporting
     *
     * @tags Utils, Internal
     * @name ErrorReport
     * @summary Error Reporting
     * @request POST:/api/v1/error-reporting
     */
    errorReport: (data: any, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/v1/error-reporting`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
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
 * No description
 * 
 * @tags Utils
 * @name Feed
 * @summary Get Feed
 * @request GET:/api/v2/feed
 * @response `200` `({
  Id?: string,
  Description?: string,
  Tags?: string,
  Images?: (object)[],
  Url?: string,
  "Published Time"?: string,

})[]` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    feed: (
      query?: {
        type?: 'all' | 'github' | 'youtube' | 'cloud';
        per_page?: number;
        page?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          Id?: string;
          Description?: string;
          Tags?: string;
          Images?: object[];
          Url?: string;
          'Published Time'?: string;
        }[],
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/feed`,
        method: 'GET',
        query: query,
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
  baseCount?: number,
  bases?: ({
  tableCount?: {
  \** Table Count *\
  table?: number,
  \** View Count *\
  view?: number,

},
  \** External Base *\
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
  \** Calendar Count *\
  calendarCount?: number,
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
  \** Shared Calendar Count *\
  sharedCalendarCount?: number,
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
  \** Total base user Count *\
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
          baseCount?: number;
          bases?: {
            tableCount?: {
              /** Table Count */
              table?: number;
              /** View Count */
              view?: number;
            };
            /** External Base */
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
              /** Calendar Count */
              calendarCount?: number;
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
              /** Shared Calendar Count */
              sharedCalendarCount?: number;
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
            /** Total base user Count */
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

    /**
     * @description Get dynamic command palette suggestions based on scope
     *
     * @tags Utils
     * @name CommandPalette
     * @summary Get command palette suggestions
     * @request POST:/api/v1/command_palette
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    commandPalette: (data: any, params: RequestParams = {}) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v1/command_palette`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
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
      operation:
        | 'insert'
        | 'update'
        | 'delete'
        | 'bulkInsert'
        | 'bulkUpdate'
        | 'bulkDelete',
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

    /**
 * @description Trigger the manual WebHook
 * 
 * @tags DB Table Webhook
 * @name Trigger
 * @summary Trigger Manual Hook
 * @request POST:/api/v2/meta/hooks/{hookId}/trigger/{rowId}
 * @response `200` `void` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    trigger: (hookId: IdType, rowId: IdType, params: RequestParams = {}) =>
      this.request<
        void,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/meta/hooks/${hookId}/trigger/${rowId}`,
        method: 'POST',
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
 * @description List all webhook plugins
 * 
 * @tags Plugin
 * @name WebhookList
 * @summary Webhook List Plugins
 * @request GET:/api/v1/db/meta/plugins/webhook
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
    webhookList: (params: RequestParams = {}) =>
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
        path: `/api/v1/db/meta/plugins/webhook`,
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
 * @request GET:/api/v1/db/meta/plugins/{pluginId}/status
 * @response `200` `boolean` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    status: (pluginId: string, params: RequestParams = {}) =>
      this.request<
        boolean,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/plugins/${pluginId}/status`,
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
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    test: (data: PluginTestReqType, params: RequestParams = {}) =>
      this.request<
        FieldOptionsButtonV3Type,
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
 * @response `200` `FieldOptionsButtonV3Type` OK
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
        FieldOptionsButtonV3Type,
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
 * @description List API Tokens in the given base
 * 
 * @tags API Token
 * @name List
 * @summary List API Tokens in Base
 * @request GET:/api/v1/db/meta/projects/{baseId}/api-tokens
 * @response `200` `ApiTokenListType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    list: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        ApiTokenListType,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/api-tokens`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
 * @description Create API Token in a base
 * 
 * @tags API Token
 * @name Create
 * @summary Create API Token
 * @request POST:/api/v1/db/meta/projects/{baseId}/api-tokens
 * @response `200` `ApiTokenType` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      baseId: IdType,
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
        path: `/api/v1/db/meta/projects/${baseId}/api-tokens`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Delete the given API Token in base
 * 
 * @tags API Token
 * @name Delete
 * @summary Delete API Token
 * @request DELETE:/api/v1/db/meta/projects/{baseId}/api-tokens/{tokenId}
 * @response `200` `number` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (baseId: IdType, tokenId: string, params: RequestParams = {}) =>
      this.request<
        number,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v1/db/meta/projects/${baseId}/api-tokens/${tokenId}`,
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
        /**
         * The scope of the attachment
         * @example workspacePics
         */
        scope?: 'workspacePics' | 'profilePics' | 'organizationPics';
      },
      data: {
        files: FileReqType[];
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
        /**
         * Target File Path
         * @example download/noco/jango_fett/Table1/attachment/c7z_UF8sZBgJUxMjpN.jpg
         */
        path: string;
        /**
         * The scope of the attachment
         * @example workspacePics
         */
        scope?: 'workspacePics' | 'profilePics' | 'organizationPics';
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
  notification = {
    /**
     * @description Poll notifications
     *
     * @tags Notification
     * @name Poll
     * @summary Notification Poll
     * @request GET:/api/v1/notifications/poll
     * @response `200` `object` OK
     */
    poll: (params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v1/notifications/poll`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description List notifications
     *
     * @tags Notification
     * @name List
     * @summary Notification list
     * @request GET:/api/v1/notifications
     * @response `200` `NotificationListType` OK
     */
    list: (
      query?: {
        is_read?: boolean;
        limit?: number;
        offset?: number;
      },
      params: RequestParams = {}
    ) =>
      this.request<NotificationListType, any>({
        path: `/api/v1/notifications`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Notificattion update
     *
     * @tags Notification
     * @name Update
     * @summary Notification update
     * @request PATCH:/api/v1/notifications/{notificationId}
     * @response `200` `void` OK
     */
    update: (
      notificationId: string,
      data: NotificationUpdateType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v1/notifications/${notificationId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete notification
     *
     * @tags Notification
     * @name Delete
     * @summary Delete notification
     * @request DELETE:/api/v1/notifications/{notificationId}
     * @response `200` `void` OK
     */
    delete: (notificationId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/notifications/${notificationId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Mark all notifications as read
     *
     * @tags Notification
     * @name MarkAllAsRead
     * @summary Mark all notifications as read
     * @request POST:/api/v1/notifications/mark-all-read
     * @response `200` `void` OK
     */
    markAllAsRead: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/notifications/mark-all-read`,
        method: 'POST',
        ...params,
      }),
  };
  dbDataTableAggregate = {
    /**
 * @description Read aggregated data from a given table
 * 
 * @tags DB Data Table Aggregate
 * @name DbDataTableAggregate
 * @summary Read Aggregated Data
 * @request GET:/api/v2/tables/{tableId}/aggregate
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    dbDataTableAggregate: (
      tableId: string,
      query: {
        /** View ID is required */
        viewId: string;
        /** List of fields to be aggregated */
        aggregation?: object[];
        /** Extra filtering */
        where?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
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
        path: `/api/v2/tables/${tableId}/aggregate`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
  dbDataTableRow = {
    /**
 * @description List all table rows in a given table
 * 
 * @tags DB Data Table Row
 * @name List
 * @summary List Table Rows
 * @request GET:/api/v2/tables/{tableId}/records
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
      tableId: string,
      query?: {
        /** View ID */
        viewId?: string;
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
        /** Comma separated list of pks */
        pks?: string;
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
        path: `/api/v2/tables/${tableId}/records`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new row in a given table and base.
 * 
 * @tags DB Data Table Row
 * @name Create
 * @summary Create Table Rows
 * @request POST:/api/v2/tables/{tableId}/records
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    create: (
      tableId: string,
      data: object | object[],
      query?: {
        /** View ID */
        viewId?: string;
        before?: string;
        undo?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/records`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new row in a given table and base.
 * 
 * @tags DB Data Table Row
 * @name Update
 * @summary Update Table Rows
 * @request PATCH:/api/v2/tables/{tableId}/records
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    update: (
      tableId: string,
      data: object | object[],
      query?: {
        /** View ID */
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/records`,
        method: 'PATCH',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new row in a given table and base.
 * 
 * @tags DB Data Table Row
 * @name Delete
 * @summary Delete Table Rows
 * @request DELETE:/api/v2/tables/{tableId}/records
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    delete: (
      tableId: string,
      data: object | object[],
      query?: {
        /** View ID */
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/records`,
        method: 'DELETE',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Get table row in a given table
 * 
 * @tags DB Data Table Row
 * @name Read
 * @summary Read Table Row
 * @request GET:/api/v2/tables/{tableId}/records/{rowId}
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    read: (
      tableId: string,
      rowId: string,
      query?: {
        /** View ID */
        viewId?: string;
        /** Which fields to be shown */
        fields?: any[];
        /**
         * Offset in rows
         * @min 0
         */
        offset?: number;
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
        path: `/api/v2/tables/${tableId}/records/${rowId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Move the table row to new position
 * 
 * @tags DB Data Table Row
 * @name Move
 * @summary Move Table Row
 * @request POST:/api/v2/tables/{tableId}/records/{rowId}/move
 * @response `200` `object` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    move: (
      tableId: string,
      rowId: string,
      query?: {
        /** The row ID before which the row should be moved */
        before?: string;
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
        path: `/api/v2/tables/${tableId}/records/${rowId}/move`,
        method: 'POST',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Count of rows in a given table
 * 
 * @tags DB Data Table Row
 * @name Count
 * @summary Table Rows Count
 * @request GET:/api/v2/tables/{tableId}/records/count
 * @response `200` `{
  count?: number,

}` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    count: (
      tableId: string,
      query?: {
        /** View ID */
        viewId?: string;
        /** Which fields to be shown */
        fields?: any[];
        /** Extra filtering */
        where?: string;
        /** Used for multiple filter queries */
        filterArrJson?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          count?: number;
        },
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/records/count`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Linked rows in a given Links/LinkToAnotherRecord column
 * 
 * @tags DB Data Table Row
 * @name NestedList
 * @summary Get Nested Relations Rows
 * @request GET:/api/v2/tables/{tableId}/links/{columnId}/records/{rowId}
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
    nestedList: (
      tableId: string,
      columnId: string,
      rowId: string,
      query?: {
        /** View ID */
        viewId?: string;
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
        path: `/api/v2/tables/${tableId}/links/${columnId}/records/${rowId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a link with the row.
 * 
 * @tags DB Data Table Row
 * @name NestedLink
 * @summary Create Nested Relations Rows
 * @request POST:/api/v2/tables/{tableId}/links/{columnId}/records/{rowId}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    nestedLink: (
      tableId: string,
      columnId: string,
      rowId: string,
      data: object | object[],
      query?: {
        /** View ID */
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/links/${columnId}/records/${rowId}`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Create a new row in a given table and base.
 * 
 * @tags DB Data Table Row
 * @name NestedUnlink
 * @summary Delete Nested Relations Rows
 * @request DELETE:/api/v2/tables/{tableId}/links/{columnId}/records/{rowId}
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    nestedUnlink: (
      tableId: string,
      columnId: string,
      rowId: string,
      data: object | object[],
      query?: {
        /** View ID */
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/links/${columnId}/records/${rowId}`,
        method: 'DELETE',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
 * @description Download attachment from a given row
 * 
 * @tags DB Data Table Row
 * @name AttachmentDownload
 * @summary Download Attachment
 * @request GET:/api/v2/downloadAttachment/{modelId}/{columnId}/{rowId}
 * @response `200` `{
  \** URL to download attachment *\
  url?: string,
  \** Path to download attachment *\
  path?: string,

}` OK
 */
    attachmentDownload: (
      modelId: string,
      columnId: string,
      rowId: string,
      query?: {
        /** URL or Path of the attachment */
        urlOrPath?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        {
          /** URL to download attachment */
          url?: string;
          /** Path to download attachment */
          path?: string;
        },
        any
      >({
        path: `/api/v2/downloadAttachment/${modelId}/${columnId}/${rowId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
 * @description Copy links from the one cell and paste them into another cell or delete all records from cell
 * 
 * @tags DB Data Table Row
 * @name NestedListCopyPasteOrDeleteAll
 * @summary Copy paste or deleteAll nested link
 * @request POST:/api/v2/tables/{tableId}/links/{columnId}/records
 * @response `200` `FieldOptionsButtonV3Type` OK
 * @response `400` `{
  \** @example BadRequest [Error]: <ERROR MESSAGE> *\
  msg: string,

}`
 */
    nestedListCopyPasteOrDeleteAll: (
      tableId: string,
      columnId: string,
      data: NestedListCopyPasteOrDeleteAllReqType,
      query?: {
        /** View ID */
        viewId?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<
        FieldOptionsButtonV3Type,
        {
          /** @example BadRequest [Error]: <ERROR MESSAGE> */
          msg: string;
        }
      >({
        path: `/api/v2/tables/${tableId}/links/${columnId}/records`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  extensions = {
    /**
 * @description Get all extensions for a given base
 * 
 * @tags Extensions
 * @name List
 * @summary Get Extensions
 * @request GET:/api/v2/extensions/{baseId}
 * @response `200` `{
  list?: (object)[],

}` OK
 */
    list: (baseId: IdType, params: RequestParams = {}) =>
      this.request<
        {
          list?: object[];
        },
        any
      >({
        path: `/api/v2/extensions/${baseId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Create a new extension for a given base
     *
     * @tags Extensions
     * @name Create
     * @summary Create Extension
     * @request POST:/api/v2/extensions/{baseId}
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    create: (baseId: IdType, data: object, params: RequestParams = {}) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/extensions/${baseId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Get extension details
     *
     * @tags Extensions
     * @name Read
     * @summary Get Extension
     * @request GET:/api/v2/extensions/{extensionId}
     * @response `200` `object` OK
     */
    read: (extensionId: IdType, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v2/extensions/${extensionId}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Update extension details
     *
     * @tags Extensions
     * @name Update
     * @summary Update Extension
     * @request PATCH:/api/v2/extensions/{extensionId}
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    update: (extensionId: IdType, data: object, params: RequestParams = {}) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/extensions/${extensionId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Delete extension
     *
     * @tags Extensions
     * @name Delete
     * @summary Delete Extension
     * @request DELETE:/api/v2/extensions/{extensionId}
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    delete: (extensionId: IdType, params: RequestParams = {}) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/extensions/${extensionId}`,
        method: 'DELETE',
        format: 'json',
        ...params,
      }),
  };
  jobs = {
    /**
     * @description Listen for job events
     *
     * @tags Jobs
     * @name Listen
     * @summary Jobs Listen
     * @request POST:/jobs/listen
     */
    listen: (data: object, params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/jobs/listen`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get list of jobs for a given base for the user
     *
     * @tags Jobs
     * @name List
     * @summary Get Jobs
     * @request POST:/api/v2/jobs/{baseId}
     */
    list: (
      baseId: IdType,
      data: {
        job?: string;
        status?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v2/jobs/${baseId}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  export = {
    /**
     * @description Trigger export as job
     *
     * @tags Export
     * @name Data
     * @summary Trigger export as job
     * @request POST:/api/v2/export/{viewId}/{exportAs}
     */
    data: (
      viewId: IdType,
      exportAs: 'csv',
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<any, any>({
        path: `/api/v2/export/${viewId}/${exportAs}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  ai = {
    /**
     * @description AI Utils
     *
     * @tags Ai
     * @name Utils
     * @summary AI Utils
     * @request POST:/api/v2/ai/bases/{baseId}/utils
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    utils: (
      baseId: IdType,
      data: {
        operation?: string;
        input: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/ai/bases/${baseId}/utils`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description AI Schema
     *
     * @tags Ai
     * @name Schema
     * @summary AI Schema
     * @request POST:/api/v2/ai/bases/{baseId}/schema
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    schema: (
      baseId: IdType,
      data: {
        operation?: string;
        input: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/ai/bases/${baseId}/schema`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description AI Schema
     *
     * @tags Ai
     * @name SchemaCreate
     * @summary AI Schema
     * @request POST:/api/v2/ai/workspaces/{workspaceId}/bases
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    schemaCreate: (
      workspaceId: IdType,
      data: {
        operation?: string;
        input: any;
      },
      params: RequestParams = {}
    ) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/ai/workspaces/${workspaceId}/bases`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Generate AI data for specified rows
     *
     * @tags Ai
     * @name DataGenerate
     * @summary Generate AI Data
     * @request POST:/api/v2/ai/tables/{modelId}/rows/generate
     * @response `200` `(any)[]` OK
     */
    dataGenerate: (
      modelId: string,
      data: {
        rowIds: string[];
        column?:
          | string
          | {
              title: string;
              prompt_raw: string;
              fk_integration_id: string;
              uidt: string;
              model?: string;
              output_column_ids?: string;
            };
        preview?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<any[], any>({
        path: `/api/v2/ai/tables/${modelId}/rows/generate`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Fill AI data for specified rows
     *
     * @tags Ai
     * @name DataFill
     * @summary Fill AI Data
     * @request POST:/api/v2/ai/tables/{modelId}/rows/fill
     * @response `200` `(any)[]` OK
     */
    dataFill: (
      modelId: string,
      data: {
        rows?: any[];
        numRows: number;
        generateIds: string[];
      },
      params: RequestParams = {}
    ) =>
      this.request<any[], any>({
        path: `/api/v2/ai/tables/${modelId}/rows/fill`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Extract AI data from the input
     *
     * @tags Ai
     * @name DataExtract
     * @summary Extract Data using AI
     * @request POST:/api/v2/ai/tables/{modelId}/extract
     * @response `200` `(any)[]` OK
     */
    dataExtract: (
      modelId: string,
      data: {
        input: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<any[], any>({
        path: `/api/v2/ai/tables/${modelId}/extract`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  integration = {
    /**
     * @description List integrations
     *
     * @tags Integration
     * @name List
     * @summary List integrations
     * @request GET:/api/v2/meta/integrations
     * @response `200` `FieldOptionsButtonV3Type` OK
     */
    list: (
      query?: {
        /** Integration Type */
        type?: IntegrationsType;
        includeDatabaseInfo?: boolean;
        limit?: number;
        offset?: number;
        baseId?: string;
        query?: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<FieldOptionsButtonV3Type, any>({
        path: `/api/v2/meta/integrations`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Create integration
     *
     * @tags Integration
     * @name Create
     * @summary Create integration
     * @request POST:/api/v2/meta/integrations
     * @response `200` `IntegrationType` OK
     */
    create: (data: IntegrationReqType, params: RequestParams = {}) =>
      this.request<IntegrationType, any>({
        path: `/api/v2/meta/integrations`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Read integration
     *
     * @tags Integration
     * @name Read
     * @summary Read integration
     * @request GET:/api/v2/meta/integrations/{integrationId}
     * @response `200` `IntegrationType` OK
     */
    read: (
      integrationId: string,
      query?: {
        includeConfig?: boolean;
        includeSources?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<IntegrationType, any>({
        path: `/api/v2/meta/integrations/${integrationId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),

    /**
     * @description Update integration
     *
     * @tags Integration
     * @name Update
     * @summary Update integration
     * @request PATCH:/api/v2/meta/integrations/{integrationId}
     * @response `200` `void` OK
     */
    update: (
      integrationId: string,
      data: IntegrationReqType,
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v2/meta/integrations/${integrationId}`,
        method: 'PATCH',
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Delete integration
     *
     * @tags Integration
     * @name Delete
     * @summary Delete integration
     * @request DELETE:/api/v2/meta/integrations/{integrationId}
     * @response `200` `void` OK
     */
    delete: (integrationId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v2/meta/integrations/${integrationId}`,
        method: 'DELETE',
        ...params,
      }),

    /**
     * @description Set integration as category default
     *
     * @tags Integration
     * @name SetDefault
     * @summary Set integration as category default
     * @request PATCH:/api/v2/meta/integrations/{integrationId}/default
     * @response `200` `void` OK
     */
    setDefault: (integrationId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v2/meta/integrations/${integrationId}/default`,
        method: 'PATCH',
        ...params,
      }),

    /**
     * @description Store integration
     *
     * @tags Integration
     * @name Store
     * @summary Store integration
     * @request POST:/api/v2/integrations/:integrationId/store
     * @response `200` `void` OK
     */
    store: (
      integrationId: string,
      data:
        | {
            op: 'list';
            limit: number;
            offset: number;
          }
        | {
            op: 'get';
          }
        | {
            op: 'sum';
            fields: string[];
          },
      params: RequestParams = {}
    ) =>
      this.request<void, any>({
        path: `/api/v2/integrations/${integrationId}/store`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        ...params,
      }),
  };
  integrations = {
    /**
     * @description List available integrations
     *
     * @tags Integrations
     * @name List
     * @summary Integration List
     * @request GET:/api/v2/integrations
     * @response `200` `object` OK
     */
    list: (params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v2/integrations`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Get info for integration
     *
     * @tags Integrations
     * @name Info
     * @summary Get Integration Info
     * @request GET:/api/v2/integrations/:type/:subType
     * @response `200` `object` OK
     */
    info: (type: string, subType: string, params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/api/v2/integrations/${type}/${subType}`,
        method: 'GET',
        format: 'json',
        ...params,
      }),

    /**
     * @description Call exposed integration endpoint
     *
     * @tags Integrations
     * @name Endpoint
     * @summary Call exposed integration endpoint
     * @request POST:/api/v2/integrations/:integrationId/:endpoint
     * @response `200` `object` OK
     */
    endpoint: (
      integrationId: string,
      endpoint: string,
      data: object,
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/api/v2/integrations/${integrationId}/${endpoint}`,
        method: 'POST',
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  action = {
    /**
     * @description Trigger a button action
     *
     * @tags Action
     * @name TriggerButton
     * @summary Trigger a button action
     * @request POST:/api/v2/tables/:tableId/button/:fieldId
     * @response `200` `object` OK
     */
    triggerButton: (
      tableId: string,
      fieldId: string,
      data: {
        customRows?: any[];
        rowIds?: string[];
        customField?: object;
      },
      query?: {
        /** Trigger AI action with custom record data provided in request body as rows */
        passThrough?: boolean;
      },
      params: RequestParams = {}
    ) =>
      this.request<object, any>({
        path: `/api/v2/tables/${tableId}/button/${fieldId}`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),
  };
  internal = {
    /**
     * @description Trigger an internal operation
     *
     * @tags Internal
     * @name PostOperation
     * @summary Trigger an internal operation
     * @request POST:/api/v2/internal/:workspaceId/:baseId
     * @response `200` `Record<string, any>` OK
     */
    postOperation: (
      workspaceId: string,
      baseId: string,
      query: {
        /** Operation to trigger */
        operation: string;
      },
      data: Record<string, any>,
      params: RequestParams = {}
    ) =>
      this.request<Record<string, any>, any>({
        path: `/api/v2/internal/${workspaceId}/${baseId}`,
        method: 'POST',
        query: query,
        body: data,
        type: ContentType.Json,
        format: 'json',
        ...params,
      }),

    /**
     * @description Trigger an internal operation
     *
     * @tags Internal
     * @name GetOperation
     * @summary Trigger an internal operation
     * @request GET:/api/v2/internal/:workspaceId/:baseId
     * @response `200` `Record<string, any>` OK
     */
    getOperation: (
      workspaceId: string,
      baseId: string,
      query: {
        /** Operation to trigger */
        operation: string;
      },
      params: RequestParams = {}
    ) =>
      this.request<Record<string, any>, any>({
        path: `/api/v2/internal/${workspaceId}/${baseId}`,
        method: 'GET',
        query: query,
        format: 'json',
        ...params,
      }),
  };
}
