import { UITypes, isVirtualCol } from 'nocodb-sdk'

export class TypeGenerator {
  private initialCode = `
declare let console: {
  log(...args: Array<unknown>): void
  warn(...args: Array<unknown>): void
  error(...args: Array<unknown>): void
}

/**
 * Configuration options for button inputs
 * @template T The type of value that the button will return when selected
 */
declare interface ButtonOption<T = string> {
   /**
    * The label to display on the button
    */
    label: string;
    
    /**
     * The value to return when the button is selected
     */
    
    value?: T;
    
    /**
     * The variant of the button
     * @default "default"
     * Possible values: "default", "danger", "primary", "secondary"
     */
    variant?: "default" | "danger" | "primary" | "secondary";
}

/**
* Raw binary data object
*/
declare interface NcBlob {
 /** Size in bytes */
 readonly size: number;
 
 /** MIME type */
 readonly type: string;
 
 /** Extract portion of blob data */
 slice(start?: number, end?: number, contentType?: string): Blob;
}

/**
* File system file object
* @extends NcBlob
*/
declare interface NcFile extends NcBlob {
 /** Last modified timestamp */
 readonly lastModified: number;
 
 /** File name with extension */
 readonly name: string;
}

declare function remoteFetchAsync(
  url: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    body?: string | null
  },
): Promise<any>

declare const output: {
  text: (message: string | number | boolean | null, type?: 'log' | 'error' | 'warning') => void
  markdown: (content: string) => void
  table: (data: any[] | object) => void
  clear: () => void
  inspect: (data: unknown) => void
}

declare interface Collaborator {
  /**
   * The user ID of the collaborator.
   */
  readonly id: string

  /**
   * The name of the collaborator. Could be \`null\` if the user's account doesn't yet have a name.
   */
  readonly name: string

  /**
   * The email address of the user collaborator
   */
  readonly email: string
}

declare interface NocoDBRecord {
  /**
   * The unique identifier for this record.
   * For single primary key tables, this is the primary key value.
   * For composite primary keys, this is the concatenated values with "___" separator.
   */
  readonly id: string

  /**
   * The primary display value for this record.
   * Returns undefined if no primary value field is configured.
   */
  readonly name: string

  /**
   * Gets a specific cell value in this record.
   * The value format depends on the field type.
   *
   * @param fieldOrIdOrName - The field ID or name or Field to get the value for
   * @throws {Error} If the field is not found or not included in the query
   */
  getCellValue(fieldOrIdOrName: Field | string): any
  /**
   * Gets a specific cell value in this record, formatted as a string.
   * Special handling is provided for:
   * - User fields (returns display_name or email)
   * - Button fields (returns label)
   * - Other object values (returns toString())
   *
   * @param fieldOrIdOrName - The field ID or name to get the value for
   * @returns Empty string if value is null/undefined, string representation otherwise
   * @throws {Error} If the field is not found or not included in the query
   */
  getCellValueAsString(fieldOrIdOrName: Field | string): string
}

/**
 * Result set from a record query
 */
declare interface RecordQueryResult {
  /**
   * Array of record IDs in this result set
   */
  readonly recordIds: ReadonlyArray<string>

  /**
   * Array of records in this result set
   */
  readonly records: ReadonlyArray<Record<string, unknown>>

  /**
   * Whether there are more records available to load
   */
  readonly hasMoreRecords: boolean

  /**
   * Total number of records matching the query
   */
  readonly totalRecords: number

  /**
   * Current page number (0-based)
   */
  readonly currentPage: number

  /**
   * Number of records per page
   */
  readonly pageSize: number

  /**
   * Get a specific record from the result set by ID
   *
   * @param recordId - ID of the record to retrieve
   * @throws {Error} If record is not found in the result set
   */
  getRecord(recordId: string): NocoDBRecord

  /**
   * Load the next page of records if available
   *
   * @returns Promise resolving to updated RecordQueryResult, or null if no more records
   */
  loadMoreRecords(): Promise<RecordQueryResult | null>
}

enum UITypes {
  ID = 'ID',
  LinkToAnotherRecord = 'LinkToAnotherRecord',
  ForeignKey = 'ForeignKey',
  Lookup = 'Lookup',
  SingleLineText = 'SingleLineText',
  LongText = 'LongText',
  Attachment = 'Attachment',
  Checkbox = 'Checkbox',
  MultiSelect = 'MultiSelect',
  SingleSelect = 'SingleSelect',
  Date = 'Date',
  Year = 'Year',
  Time = 'Time',
  PhoneNumber = 'PhoneNumber',
  GeoData = 'GeoData',
  Email = 'Email',
  URL = 'URL',
  Number = 'Number',
  Decimal = 'Decimal',
  Currency = 'Currency',
  Percent = 'Percent',
  Duration = 'Duration',
  Rating = 'Rating',
  Formula = 'Formula',
  Rollup = 'Rollup',
  DateTime = 'DateTime',
  CreatedTime = 'CreatedTime',
  LastModifiedTime = 'LastModifiedTime',
  Geometry = 'Geometry',
  JSON = 'JSON',
  SpecificDBType = 'SpecificDBType',
  Barcode = 'Barcode',
  QrCode = 'QrCode',
  Button = 'Button',
  Links = 'Links',
  User = 'User',
  CreatedBy = 'CreatedBy',
  LastModifiedBy = 'LastModifiedBy',
  Order = 'Order',
}

/**
 * Type definition for field options when creating or updating fields
 */

declare type FieldOptionsWriteFormat<FieldTypeT extends UITypes> = FieldTypeT extends UITypes.Checkbox
  ? {
      /**
       * Icon to display for the checkbox
       */
      icon: 'square' | 'circle-check' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag'

      /**
       * Color of the checkbox when checked
       */
      color: string
    }
  : FieldTypeT extends UITypes.MultiSelect | UITypes.SingleSelect
  ? {
      /**
       * Available choices for single select / multi select fields
       */
      choices: Array<{
        id?: string // Optional for new choices
        title: string
        color: string
      }>
    }
  : FieldTypeT extends UITypes.LongText
  ? {
      /**
       * Whether to enable rich text formatting
       */
      rich_text: boolean
      /**
       * Whether to enable AI text generation
       */
      ai: boolean
    }
  : FieldTypeT extends UITypes.Number | UITypes.Decimal
  ? {
      /**
       * Whether to show thousands separator
       */
      locale_string: boolean
    }
  : FieldTypeT extends UITypes.Currency
  ? {
      /**
       * Locale for currency formatting
       */
      locale: string
      /**
       * Currency code (e.g., 'USD')
       */
      code:
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
        | 'ZWD'
    }
  : FieldTypeT extends UITypes.Duration
  ? {
      /**
       * Format configuration for duration
       */
      duration_format: 'h:mm' | 'h:mm:ss' | 'h:mm:ss.s' | 'h:mm:ss.ss' | 'h:mm:ss.sss'
    }
  : FieldTypeT extends UITypes.Rating
  ? {
      /**
       * Icon to display for rating
       */
      icon: 'star' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag'
      /**
       * Maximum rating value (1-10)
       */
      max_value: number
      /**
       * Color of rating icons
       */
      color: string
    }
  : FieldTypeT extends UITypes.Date
  ? {
      /**
       * Date format string
       */
      date_format: string
    }
  : FieldTypeT extends UITypes.DateTime
  ? {
      /**
       * Date format string
       */
      date_format: string
      /**
       * Time format string
       */
      time_format: string
      /**
       * Whether to use 12-hour format
       */
      ['12hr_format']: boolean
      /**
       * Timezone string
       */
      timezone: string
      /**
       * display_timezone boolean
       */
      display_timezone: boolean
      /**
       * use_same_timezone_for_all boolean
       */
       use_same_timezone_for_all: boolean
    }
  : FieldTypeT extends UITypes.Time
  ? {
      /**
       * Whether to use 12-hour format
       */
      ['12hr_format']: boolean
    }
  : FieldTypeT extends UITypes.Email | UITypes.URL | UITypes.PhoneNumber
  ? {
      /**
       * Whether to validate user inputted data
       */
      validation: boolean
    }
  : FieldTypeT extends UITypes.Percent
  ? {
      /**
       * Whether to display as progress bar
       */
      show_as_progress: boolean
    }
  : FieldTypeT extends UITypes.Barcode
  ? {
      /**
       * Barcode format type
       */
      barcode_format:
        | 'CODE128'
        | 'upc'
        | 'EAN13'
        | 'EAN8'
        | 'EAN5'
        | 'EAN2'
        | 'CODE39'
        | 'ITF14'
        | 'MSI'
        | 'PHARMACODE'
        | 'CODABAR'
      /**
       * Field ID containing barcode value
       */
      barcode_value_field_id: string
    }
  : FieldTypeT extends UITypes.QrCode
  ? {
      /**
       * Field ID containing QR code value
       */
      qrcode_value_field_id: string
    }
  : FieldTypeT extends UITypes.Formula
  ? {
      /**
       * Formula expression
       */
      formula: string
      result:
        | {
            /**
             * Result format type
             */
            type:
              | UITypes.Decimal
              | UITypes.Currency
              | UITypes.Percent
              | UITypes.Rating
              | UITypes.Email
              | UITypes.URL
              | UITypes.PhoneNumber
              | UITypes.DateTime
              | UITypes.Date
              | UITypes.Time
              | UITypes.Checkbox
            /**
             * Format configuration for result
             */
            format: FieldOptionsWriteFormat<
              NonNullable<
                Extract<
                  typeof UITypes,
                  | UITypes.Decimal
                  | UITypes.Currency
                  | UITypes.Percent
                  | UITypes.Rating
                  | UITypes.Email
                  | UITypes.URL
                  | UITypes.PhoneNumber
                  | UITypes.DateTime
                  | UITypes.Date
                  | UITypes.Time
                  | UITypes.Checkbox
                >
              >
            >
          }
        | never
    }
  : FieldTypeT extends UITypes.Lookup
  ? {
      /**
       * Field to lookup in related table
       */
      related_table_lookup_field_id: string
      /**
       * Relation field to use
       */
      related_field_id: string
    }
  : FieldTypeT extends UITypes.Rollup
  ? {
      /**
       * Field to rollup from linked table
       */
      related_table_rollup_field_id: string
      /**
       * Rollup function to apply
       */
      rollup_function: 'min' | 'max' | 'sum' | 'avg' | 'count' | 'countDistinct' | 'sumDistinct' | 'avgDistinct'
      /**
       * Relation field to use
       */
      related_field_id: string
    }
  : FieldTypeT extends UITypes.Links
  ? {
      /**
       * Type of relation (e.g., 'mm' for many-to-many)
       * mm: Many-to-Many
       * hm: Has Many
       * oo: One-to-One
       * bt: Belongs To
       */
      relation_type: 'mm' | 'hm' | 'oo' | 'bt'
      /**
       * ID of related table
       */
      related_table_id: string
      /**
       * Optional view ID for limiting record selection
       */
      limit_record_selection_view_id?: string | null
    }
  : FieldTypeT extends UITypes.LinkToAnotherRecord
  ? {
      /**
       * Type of relation (e.g., 'mm' for many-to-many)
       * mm: Many-to-Many
       * hm: Has Many
       * oo: One-to-One
       * bt: Belongs To
       */
      relation_type: 'mm' | 'hm' | 'oo' | 'bt'
      /**
       * ID of related table
       */
      related_table_id: string
      /**
       * Optional view ID for limiting record selection
       */
      limit_record_selection_view_id?: string | null
    }
  : FieldTypeT extends UITypes.Button
  ? {
      /**
       * Button icon name
       */
      icon: string

      /**
       * Button label text
       */
      label: string

      /**
       * Button color theme
       */
      color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'yellow' | 'purple' | 'gray' | 'orange' | 'pink'

      /**
       * Button visual theme
       * - solid: Filled background with white text
       * - light: Light background with colored text
       * - text: No background, only colored text
       */
      theme: 'solid' | 'light' | 'text'
    } & (
      | {
          /**
           * URL type button that opens generated URL
           */
          type: 'url'
          /**
           * Formula to generate the URL
           * The Fields can be referenced in the formula using the format {field_name}
           */
          formula: string
          model?: never
          script_id?: never
          button_hook_id?: never
          integration_id?: never
        }
      | {
          /**
           * Script type button that executes a NocoDB script
           */
          type: 'script'
          /**
           * ID of the script to execute
           */
          script_id: string
          formula?: never
          model?: never
          button_hook_id?: never
          integration_id?: never
        }
      | {
          /**
           * Webhook type button that calls configured webhook
           */
          type: 'webhook'
          /**
           * ID of the webhook to call
           */
          button_hook_id: string
          formula?: never
          model?: never
          script_id?: never
          integration_id?: never
        }
      | {
          /**
           * AI type button that generates cell values using AI
           */
          type: 'ai'
          /**
           * Model to use for AI generation
           */
          model: string
          /**
           * ID of the AI integration to use
           */
          integration_id: string

          /**
           * Prompt text for AI model
           * The Fields can be referenced in the prompt using the format {field_name}
           * Example: "Generate a description for the product {product_name}"
           */
          prompt: string
          
          /**
           * Output column IDs
           * IDs of columns where AI output should be stored
           */
          output_column_ids?: string

          script_id?: never
          button_hook_id?: never
        }
    )
  : FieldTypeT extends UITypes.User
  ? {
      /**
       * Whether multiple users can be selected
       */
      allow_multiple_users: boolean
      /**
       * Whether to notify users when added
       */
      notify_user_when_added: boolean
    }
    : FieldTypeT extends UITypes.CreatedTime 
    ? {
      /**
      * Date format string
      */
      date_format: string
      /**
      * Time format string
      */
      time_format: string
      /**
      * Whether to use 12-hour format
      */
      ['12hr_format']: boolean
      /**
       * Timezone string
       */
      timezone: string
      /**
       * display_timezone boolean
       */
      display_timezone: boolean
      /**
       * use_same_timezone_for_all boolean
       */
       use_same_timezone_for_all: boolean
    }
    : FieldTypeT extends UITypes.LastModifiedTime
    ? {
      /**
      * Date format string
      */
      date_format: string
      /**
      * Time format string
      */
      time_format: string
      /**
      * Whether to use 12-hour format
      */
      ['12hr_format']: boolean
      /**
       * Timezone string
       */
      timezone: string
      /**
       * display_timezone boolean
       */
      display_timezone: boolean
      /**
       * use_same_timezone_for_all boolean
       */
       use_same_timezone_for_all: boolean
    }
  : FieldTypeT extends
      | UITypes.Order
      | UITypes.CreatedBy
      | UITypes.LastModifiedBy
      | UITypes.JSON
      | UITypes.SpecificDBType
      | UITypes.GeoData
      | UITypes.Geometry
      | UITypes.Attachment
      | UITypes.Year
      | UITypes.SingleLineText
      | UITypes.ID
      | UITypes.ForeignKey
  ? never
  : null

/**
 * Base interface that all field types extend.
 */
declare interface BaseField {
  /**
   * The unique identifier for the field.
   */
  readonly id: string

  /**
   * The name of the field as displayed in the UI.
   */
  readonly name: string

  /**
   * The type of the field as defined in UITypes enum.
   */
  readonly type: UITypes

  /**
   * Whether this is a system field (true) or user-defined field (false).
   */
  // readonly system: boolean

  /**
   * Whether this field is the primary key. Null if not applicable.
   */
  // readonly primary_key: boolean | null

  /**
   * Whether this field is the primary value display field. Null if not applicable.
   */
  // readonly primary_value: boolean | null

  /**
   * Optional description of the field.
   */
  readonly description: string | null

  /**
   * Default value for the field if no value is provided.
   */
  readonly default_value: any

  /**
   * Configuration options specific to the field type.
   */
  readonly options: Record<string, any>
  
  /**
   * \`true\` if this field is computed, \`false\` otherwise. A field is "computed" if it's value is not
   * set by user input (e.g. autoNumber, formula, etc.).
   */
  readonly isComputed: boolean

  /**
   * Updates the options configuration for this field.
   *
   * @param options - New options configuration object. Structure depends on field type.
   * @returns Promise that resolves when update is complete
   */
  updateOptionsAsync(options: { [key: string]: unknown }): Promise<void>

  /**
   * Updates the description of this field.
   *
   * @param description - New description text, or null to remove description
   * @returns Promise that resolves when update is complete
   */
  updateDescriptionAsync(description: string | null): Promise<void>

  /**
   * Updates the display name of this field.
   *
   * @param name - New field name
   * @returns Promise that resolves when update is complete
   */
  updateNameAsync(name: string): Promise<void>
}

/**
 * Field type for primary key/ID columns.
 */
declare interface IDField extends BaseField {
  readonly type: UITypes.ID
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

/**
 * Field type for single line text input.
 */
declare interface SingleLineTextField extends BaseField {
  readonly type: UITypes.SingleLineText
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

/**
 * Field type for multi-line text input with optional rich text formatting.
 */
declare interface LongTextField extends BaseField {
  readonly type: UITypes.LongText
  readonly options: {
    /**
     * Whether rich text formatting is enabled.
     */
    rich_text: boolean
    /**
     * Whether AI text generation is enabled for this field.
     */
    ai: boolean
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.LongText>): Promise<void>
}

/**
 * Field type for multi-select dropdown input.
 */

declare interface MultiSelectField extends BaseField {
  readonly type: UITypes.MultiSelect
  readonly options: {
    /**
     * Available choices for multi select field.
     */
    choices: Array<{
      id?: string
      title: string
      color: string
    }>
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.MultiSelect>): Promise<void>
}

/**
 * Field type for single-select dropdown input.
 */

declare interface SingleSelectField extends BaseField {
  readonly type: UITypes.SingleSelect
  readonly options: {
    /**
     * Available choices for single select field.
     */
    choices: Array<{
      id?: string
      title: string
      color: string
    }>
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.SingleSelect>): Promise<void>
}

/**
 * Field type for Attachment Field.
 */
declare interface AttachmentField extends BaseField {
  readonly type: UITypes.Attachment
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface CheckboxField extends BaseField {
  readonly type: UITypes.Checkbox
  readonly options: {
    /**
     * Icon to display for the checkbox
     */
    icon: 'square' | 'circle-check' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag'

    /**
     * Color of the checkbox when checked
     */
    color: string
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Checkbox>): Promise<void>
}

declare interface DateTimeField extends BaseField {
  readonly type: UITypes.DateTime
  readonly options: {
    /**
     * Date format string
     */
    date_format: string
    /**
     * Time format string
     */
    time_format: string
    /**
     * Whether to use 12-hour format
     */
    ['12hr_format']: boolean
    /**
     * Timezone string
     */
    timezone: string
    /**
     * display_timezone boolean
     */
    display_timezone: boolean
    /**
     * use_same_timezone_for_all boolean
     */
    use_same_timezone_for_all: boolean
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.DateTime>): Promise<void>
}

declare interface DateField extends BaseField {
  readonly type: UITypes.Date
  readonly options: {
    /**
     * Date format string
     */
    date_format: string
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Date>): Promise<void>
}

declare interface TimeField extends BaseField {
  readonly type: UITypes.Time
  readonly options: {
    /**
     * Time format string
     */
    time_format: string
    /**
     * Whether to use 12-hour format
     */
    ['12hr_format']: boolean
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Time>): Promise<void>
}

declare interface UrlField extends BaseField {
  readonly type: UITypes.URL
  readonly options: {
    /**
     * Whether to validate user inputted data
     */
    validation: boolean
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.URL>): Promise<void>
}

declare interface PhoneNumberField extends BaseField {
  readonly type: UITypes.PhoneNumber
  readonly options: {
    /**
     * Whether to validate user inputted data
     */
    validation: boolean
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.PhoneNumber>): Promise<void>
}

declare interface EmailField extends BaseField {
  readonly type: UITypes.Email
  readonly options: {
    /**
     * Whether to validate user inputted data
     */
    validation: boolean
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Email>): Promise<void>
}

declare interface PercentField extends BaseField {
  readonly type: UITypes.Percent
  readonly options: {
    /**
     * Whether to display as progress bar
     */
    show_as_progress: boolean
  }
}

declare interface BarcodeField extends BaseField {
  readonly type: UITypes.Barcode
  readonly options: {
    /**
     * Barcode format type
     */
    barcode_format: 'CODE128' | 'upc' | 'EAN13' | 'EAN8' | 'EAN5' | 'EAN2' | 'CODE39' | 'ITF14' | 'MSI' | 'PHARMACODE' | 'CODABAR'
    /**
     * Field ID containing barcode value
     */
    barcode_value_field_id: string
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Barcode>): Promise<void>
}

declare interface QrCodeField extends BaseField {
  readonly type: UITypes.QrCode
  readonly options: {
    /**
     * Field ID containing QR code value
     */
    qrcode_value_field_id: string
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.QrCode>): Promise<void>
}

declare interface FormulaField extends BaseField {
  readonly type: UITypes.Formula
  readonly options: {
    /**
     * Formula expression
     */
    formula: string
    result:
      | {
          /**
           * Result format type
           */
          type:
            | UITypes.Decimal
            | UITypes.Currency
            | UITypes.Percent
            | UITypes.Rating
            | UITypes.Email
            | UITypes.URL
            | UITypes.PhoneNumber
            | UITypes.DateTime
            | UITypes.Date
            | UITypes.Time
            | UITypes.Checkbox
          /**
           * Format configuration for result
           */
          format: FieldOptionsWriteFormat<
            NonNullable<
              Extract<
                typeof UITypes,
                | UITypes.Decimal
                | UITypes.Currency
                | UITypes.Percent
                | UITypes.Rating
                | UITypes.Email
                | UITypes.URL
                | UITypes.PhoneNumber
                | UITypes.DateTime
                | UITypes.Date
                | UITypes.Time
                | UITypes.Checkbox
              >
            >
          >
        }
      | never
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Formula>): Promise<void>
}

declare interface LookupField extends BaseField {
  readonly type: UITypes.Lookup
  readonly options: {
    /**
     * Field to lookup in related table
     */
    related_table_lookup_field_id: string
    /**
     * Relation field to use
     */
    related_field_id: string
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Lookup>): Promise<void>
}

declare interface RollupField extends BaseField {
  readonly type: UITypes.Rollup
  readonly options: {
    /**
     * Field to rollup from linked table
     */
    related_table_rollup_field_id: string
    /**
     * Rollup function to apply
     */
    rollup_function: 'min' | 'max' | 'sum' | 'avg' | 'count' | 'countDistinct' | 'sumDistinct' | 'avgDistinct'
    /**
     * Relation field to use
     */
    related_field_id: string
    
    /**
     * Whether to show thousands separator
     */
    locale_string: boolean
    
    /**
     * Number of decimal places to display
     * Possible values 0 - 8
     */
     precision: number
  }
  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Rollup>): Promise<void>
}

declare interface LinksField extends BaseField {
  readonly type: UITypes.Links
  readonly options: {
    /**
     * Type of relation (e.g., 'mm' for many-to-many)
     * mm: Many-to-Many
     * hm: Has Many
     * oo: One-to-One
     * bt: Belongs To
     */
    relation_type: 'mm' | 'hm' | 'oo' | 'bt'
    /**
     * ID of related table
     */
    related_table_id: string
    /**
     * Optional view ID for limiting record selection
     */
    limit_record_selection_view_id?: string | null
  }

  updateOptionsAsync(options: never): Promise<void>
}

declare interface YearField extends BaseField {
  readonly type: UITypes.Year
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface GeoDataField extends BaseField {
  readonly type: UITypes.GeoData
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface NumberField extends BaseField {
  readonly type: UITypes.Number
  readonly options: {
    /**
     * Whether to show thousands separator
     */
    locale_string: boolean
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Number>): Promise<void>
}

declare interface DecimalField extends BaseField {
  readonly type: UITypes.Decimal
  readonly options: {
    /**
     * Whether to show thousands separator
     */
    locale_string: boolean
    
    /**
     * Number of decimal places to display
     * Possible values 0 - 8
     */
     precision: number
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Decimal>): Promise<void>
}

declare interface CurrencyField extends BaseField {
  readonly type: UITypes.Currency
  readonly options: {
    /**
     * Locale for currency formatting
     */
    locale: string
    /**
     * Currency code (e.g., 'USD')
     */
    code:
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
      | 'ZWD'
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Currency>): Promise<void>
}

declare interface DurationField extends BaseField {
  readonly type: UITypes.Duration
  readonly options: {
    /**
     * Format configuration for duration
     */
    duration_format: 'h:mm' | 'h:mm:ss' | 'h:mm:ss.s' | 'h:mm:ss.ss' | 'h:mm:ss.sss'
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Duration>): Promise<void>
}

declare interface RatingField extends BaseField {
  readonly type: UITypes.Rating
  readonly options: {
    /**
     * Icon to display for rating
     */
    icon: 'star' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag'
    /**
     * Maximum rating value (1-10)
     */
    max_value: number
    /**
     * Color of rating icons
     */
    color: string
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.Rating>): Promise<void>
}

declare interface CreatedTimeField extends BaseField {
  readonly type: UITypes.CreatedTime  
  readonly options: {
    /**
     * Date format string
     */
    date_format: string
    /**
     * Time format string
     */
    time_format: string
    /**
     * Whether to use 12-hour format
     */
    ['12hr_format']: boolean
    /**
     * Timezone string
     */
    timezone: string
    /**
     * display_timezone boolean
     */
    display_timezone: boolean
    /**
     * use_same_timezone_for_all boolean
     */
    use_same_timezone_for_all: boolean
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.CreatedTime>): Promise<void>
}

declare interface LastModifiedTimeField extends BaseField {
  readonly type: UITypes.LastModifiedTime
  readonly options: {
    /**
     * Date format string
     */
    date_format: string
    /**
     * Time format string
     */
    time_format: string
    /**
     * Whether to use 12-hour format
     */
    ['12hr_format']: boolean
    /**
     * Timezone string
     */
    timezone: string
    /**
     * display_timezone boolean
     */
    display_timezone: boolean
    /**
     * use_same_timezone_for_all boolean
     */
    use_same_timezone_for_all: boolean
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.LastModifiedTime>): Promise<void>
}

declare interface LastModifiedByField extends BaseField {
  readonly type: UITypes.LastModifiedBy
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface CreatedByField extends BaseField {
  readonly type: UITypes.CreatedBy
  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface UserField extends BaseField {
  readonly type: UITypes.User
  readonly options: {
    /**
     * Whether multiple users can be selected
     */
    allow_multiple_users: boolean
    /**
     * Whether to notify users when added
     */
    notify_user_when_added: boolean
  }

  updateOptionsAsync(options: FieldOptionsWriteFormat<UITypes.User>): Promise<void>
}

declare interface GeometryField extends BaseField {
  readonly type: UITypes.Geometry

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface JsonField extends BaseField {
  readonly type: UITypes.JSON

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface OrderField extends BaseField {
  readonly type: UITypes.Order

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface ButtonField extends BaseField {
  readonly type: UITypes.Button

  readonly options: {
    /**
     * Button icon name
     */
    icon: string

    /**
     * Button label text
     */
    label: string

    /**
     * Button color theme
     */
    color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'yellow' | 'purple' | 'gray' | 'orange' | 'pink'

    /**
     * Button visual theme
     * - solid: Filled background with white text
     * - light: Light background with colored text
     * - text: No background, only colored text
     */
    theme: 'solid' | 'light' | 'text'
  } & (
    | {
        /**
         * URL type button that opens generated URL
         */
        type: 'url'
        /**
         * Formula to generate the URL
         * The Fields can be referenced in the formula using the format {field_name}
         */
        formula: string
        model?: never
        script_id?: never
        button_hook_id?: never
        integration_id?: never
      }
    | {
        /**
         * Script type button that executes a NocoDB script
         */
        type: 'script'
        /**
         * ID of the script to execute
         */
        script_id: string
        formula?: never
        model?: never
        button_hook_id?: never
        integration_id?: never
      }
    | {
        /**
         * Webhook type button that calls configured webhook
         */
        type: 'webhook'
        /**
         * ID of the webhook to call
         */
        button_hook_id: string
        formula?: never
        model?: never
        script_id?: never
        integration_id?: never
      }
    | {
        /**
         * AI type button that generates cell values using AI
         */
        type: 'ai'
        /**
         * Model to use for AI generation
         */
        model: string
        /**
         * ID of the AI integration to use
         */
        integration_id: string

        /**
         * Prompt text for AI model
         * The Fields can be referenced in the prompt using the format {field_name}
         * Example: "Generate a description for the product {product_name}"
         */
        formula: string

        script_id?: never
        button_hook_id?: never
      }
  )

  updateOptionsAsync(options: never): Promise<void>
}

declare interface ForeignKeyField extends BaseField {
  readonly type: UITypes.ForeignKey

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface LinkToAnotherRecordField extends BaseField {
  readonly type: UITypes.LinkToAnotherRecord

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare interface SpecificDBTypeField extends BaseField {
  readonly type: UITypes.SpecificDBType

  readonly options: never

  updateOptionsAsync(options: never): Promise<void>
}

declare type Field =
  | IDField
  | SingleLineTextField
  | LongTextField
  | MultiSelectField
  | SingleSelectField
  | AttachmentField
  | CheckboxField
  | DateTimeField
  | DateField
  | TimeField
  | UrlField
  | PhoneNumberField
  | EmailField
  | PercentField
  | BarcodeField
  | QrCodeField
  | FormulaField
  | LookupField
  | RollupField
  | LinksField
  | YearField
  | GeoDataField
  | DecimalField
  | NumberField
  | CurrencyField
  | DurationField
  | RatingField
  | CreatedByField
  | LastModifiedByField
  | CreatedTimeField
  | LastModifiedTimeField
  | UserField
  | GeometryField
  | JsonField
  | OrderField
  | LinkToAnotherRecordField
  | ButtonField
  | ForeignKeyField
  | SpecificDBTypeField

declare interface View {
  /**
   * The unique ID of this view.
   */
  readonly id: string
  /**
   * The name of the view.
   */
  readonly name: string
  /**
   * Description of the view, if any.
   */
  readonly description: string | null
  /**
   * The type of the view, such as Grid, Calendar, or Kanban.
   */
  readonly type: 'grid' | 'form' | 'calendar' | 'gallery' | 'kanban'

  /**
   * Select records from the view. This action is asynchronous.
   * Always includes primary key and primary value fields in results.
   *
   * @param options - Query options including fields, sorts, and pagination
   */
  selectRecordsAsync(options?: {
    /**
     * Fields to include in results
     */
    fields?: ReadonlyArray<Field | string>
    /**
     * Sort specifications
     */
    sorts?: ReadonlyArray<{
      field: Field | string
      direction: 'asc' | 'desc'
    }>
    /**
     * Specific record IDs to fetch
     */
    recordIds?: ReadonlyArray<string>
    /**
     * Maximum records to return (default: 500)
     */
    limit?: number
    /**
     * Number of records to skip
     */
    offset?: number
  }): Promise<RecordQueryResult>

  /**
   * Select a single record from the view. This action is asynchronous.
   * Always includes primary key and primary value fields in results.
   *
   * @param recordId - ID of the record to fetch
   * @param options - Options for selecting fields
   */
  selectRecordAsync(
    recordId: any,
    options?: {
      fields?: Array<Field | string>
    },
  ): Promise<NocoDBRecord | null>
}

declare interface Table {
  /**
   * The unique ID of this table.
   */
  readonly id: string

  /**
   * The name of the table.
   */
  readonly name: string

  /**
   * The description of this table, if it has one.
   */
  readonly description: string | null

  /**
   * The fields in this table.
   */
  readonly fields: ReadonlyArray<Field>

  /**
   * The views in this table.
   */
  readonly views: ReadonlyArray<View>

  /**
   * Get a field in the table by its id or name.
   */
  getField(idOrName: string): Field | undefined

  /**
   * Get a view in the table by its id or name.
   */
  getView(idOrName: string): View | undefined
  
 /**
  * Creates a new field in the table.
  * 
  * @param options Configuration for the new field
  * @returns Promise resolving to the newly created Field
  */
  createFieldAsync<T extends UITypes>(options: {
    /**
     * The name for the new field
     */
     name: string;
  
    /**
     * The type of field to create
     */
    type: T;
  
    /**
     * Optional description for the field
     */
     description?: string | null;
  
    /**
     * Optional default value for the field
     */
     default_value?: any;
  
    /**
     * Type-specific options for the field
     */
    options?: FieldOptionsWriteFormat<T>;
  }): Promise<Field>;

  /**
   * Select records from the table. This action is asynchronous.
   * Always includes primary key and primary value fields in results.
   */
  selectRecordsAsync(options?: {
    /**
     * Fields to include in results
     */
    fields?: ReadonlyArray<Field | string>
    /**
     * Sort specifications
     */
    sorts?: ReadonlyArray<{
      field: Field | string
      direction: 'asc' | 'desc'
    }>
    /**
     * Specific record IDs to fetch
     */
    recordIds?: ReadonlyArray<string>
    /**
     * Maximum records to return (default: 500)
     */
    limit?: number
    /**
     * Number of records to skip
     */
    offset?: number
  }): Promise<RecordQueryResult>

  /**
   * Select a single record from the table. This action is asynchronous.
   * Always includes primary key and primary value fields in results.
   */
  selectRecordAsync(
    recordId: any,
    options?: {
      fields?: Array<Field | string>
    },
  ): Promise<NocoDBRecord | null>

  /**
   * Creates a new record with the specified field values.
   * Field values can be referenced by either field name or ID.
   * This action is asynchronous.
   *
   * @param data - NocoDBRecord data with field values
   * @returns ID of created record
   */
  createRecordAsync(data: { [key: string]: unknown }): Promise<string>

  /**
   * Creates multiple records with the specified field values.
   * Field values can be referenced by either field name or ID.
   * This action is asynchronous.
   *
   * @param data - Array of record data
   * @returns Array of created record IDs
   */
  createRecordsAsync(data: Array<{ [key: string]: unknown }>): Promise<string[]>

  /**
   * Updates field values for a record.
   * Field values can be referenced by either field name or ID.
   * This action is asynchronous.
   *
   * @param recordId - ID of record to update
   * @param data - New field values
   */
  updateRecordAsync(recordId: NocoDBRecord | any, data: { [key: string]: unknown }): Promise<void>

  /**
   * Updates field values for multiple records.
   * Field values can be referenced by either field name or ID.
   * This action is asynchronous.
   *
   * @param records - Array of record updates
   */
  updateRecordsAsync(records: Array<{id: string; fields: {[key: string]: unknown}}>): Promise<void>;
  
  /**
   * Delete multiple records.
   * This action is asynchronous.
   *
   * @param ids - Array of ids
   */
  deleteRecordsAsync(records: Array<string | NocoDBRecord>): Promise<void>;
  
    /**
   * Delete a record.
   * This action is asynchronous.
   *
   * @param recordIdorRecord - Id or Record
   */
  deleteRecordAsync(recordIdorRecord: string | NocoDBRecord): Promise<void>;
}

/**
 * Interface representing the current context within NocoDB.
 * Provides information about active selections and context.
 */
declare interface Cursor {
  /**
   * The ID of the currently active base.
   * This is always available as scripts run within a base context.
   */
  readonly activeBaseId: string

  /**
   * The ID of the currently active table, if any.
   * Will be null if not executed as actions in a button.
   */
  readonly activeTableId: string | null

  /**
   * The ID of the currently active view, if any.
   * Will be null if not executed as actions in a button.
   */
  readonly activeViewId: string | null

  /**
   * The currently selected row data, if any.
   * Will be null if not executed as actions in a button.
   */
  readonly row: Record<string, unknown> | null
}

/**
 * Global cursor object providing access to the current NocoDB context.
 * Use this to determine the active base, table, view, and row when scripts run.
 */
declare let cursor: Cursor

/**
 * Interface representing the current user executing the script.
 */
 
declare let session : {
/**
 * The collaborator object representing the current user.
 */
 readonly currentUser: Collaborator
 }
 
 /**
 * Updates the progress state for different elements in the grid.
 * 
 * @description
 * This function provides a way to update progress indicators at different levels:
 * - Table level: Updates progress for the entire table
 * - Row level: Updates progress for a specific row
 * - Cell level: Updates progress for a specific cell
 * 
 * @example
 * // Update table progress
 * updateProgress('table', { progress: 50, message: 'Processing...' });
 * 
 * // Update row progress
 * updateProgress('row', { 
 *   rowId: 'row-1', 
 *   progress: 75, 
 *   message: 'Validating...' 
 * });
 * 
 * // Update cell progress
 * updateProgress('cell', {
 *   rowId: 'row-1',
 *   cellId: 'cell-1',
 *   progress: 90,
 *   message: 'Loading...',
 *   icon: 'spinner'
 * });
 */

/**
 * Updates progress at the table level.
 * @param type - Must be 'table'
 * @param data.progress - Progress value between 0 and 100
 * @param [data.message] - Optional status message to display
 */
declare function updateProgress(
  type: 'table',
  data: { progress: number; message?: string }
): void;

/**
 * Updates progress for a specific row.
 * @param type - Must be 'row'
 * @param data.rowId - Unique identifier for the target row
 * @param data.progress - Progress value between 0 and 100
 * @param [data.message] - Optional status message to display
 */
declare function updateProgress(
  type: 'row',
  data: { rowId: string; progress: number; message?: string }
): void;

/**
 * Updates progress for a specific cell.
 * @param type - Must be 'cell'
 * @param data.rowId - Unique identifier for the parent row
 * @param data.cellId - Unique identifier for the target cell
 * @param data.progress - Progress value between 0 and 100
 * @param [data.message] - Optional status message to display
 * @param [data.icon] - Optional icon identifier to display
 */
declare function updateProgress(
  type: 'cell',
  data: { rowId: string; cellId: string; progress: number; message?: string; icon?: string }
): void;

/**
 * Resets progress states back to their initial values.
 * 
 * @description
 * This function provides a way to reset progress indicators at different levels:
 * - Table level: Resets progress for the entire table
 * - Row level: Resets progress for a specific row
 * - Cell level: Resets progress for a specific cell
 * 
 * @example
 * // Reset table progress
 * resetProgress('table');
 * 
 * // Reset row progress
 * resetProgress('row', { rowId: 'row-1' });
 * 
 * // Reset cell progress
 * resetProgress('cell', { rowId: 'row-1', cellId: 'cell-1' });
 */

/**
 * Resets progress at the table level.
 * @param type - Must be 'table'
 * @param [data] - Optional empty object for consistent API signatures
 */
declare function resetProgress(
  type: 'table',
  data?: Record<string, never>
): void;

/**
 * Resets progress for a specific row.
 * @param type - Must be 'row'
 * @param data.rowId - Unique identifier for the target row
 */
declare function resetProgress(
  type: 'row',
  data: { rowId: string }
): void;

/**
 * Resets progress for a specific cell.
 * @param type - Must be 'cell'
 * @param data.rowId - Unique identifier for the parent row
 * @param data.cellId - Unique identifier for the target cell
 */
declare function resetProgress(
  type: 'cell',
  data: { rowId: string; cellId: string }
): void;


/**
 * Collection of view-related actions for managing view state.
 */
declare const viewActions: {
  /**
   * Reloads the entire view, refreshing all data.
   * @returns A promise that resolves when the view reload is complete
   */
  reloadView: () => Promise<void>;

  /**
   * Reloads a specific row's data.
   * @param rowId - Unique identifier for the target row
   * @returns A promise that resolves when the row reload is complete
   */
  reloadRow: (rowId: string) => Promise<void>;
};


declare interface ConfigItem {}

`
  private output: string[] = []
  private indent = 0
  constructor() {
    this.output.push(this.initialCode)
  }

  private write(line = '') {
    this.output.push('  '.repeat(this.indent) + line)
  }

  private indent_in() {
    this.indent++
  }

  private indent_out() {
    this.indent--
  }

  // Helper for formatting JSDoc comments
  private formatJSDoc(lines: string[] | string) {
    if (!Array.isArray(lines)) {
      lines = [lines]
    }

    this.write('/**')
    for (const line of lines) {
      this.write(` * ${line}`)
    }
    this.write(' */')
  }

  private typeNameMap = new Map<string, string>()

  // Helper to convert strings to PascalCase
  private pascalCase(str: string, context: string): string {
    // Create a unique key combining context and original string
    const mapKey = `${context}:${str}`

    // Check if we already have a transformed version
    const existingName = this.typeNameMap.get(mapKey)
    if (existingName) {
      return existingName
    }

    // Transform the string
    const result = str
      .replace(/[^a-zA-Z0-9\s-_]/g, ' ')
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((word) => {
        const safeWord = /^\d/.test(word) ? `N${word}` : word
        return safeWord.charAt(0).toUpperCase() + safeWord.slice(1)
      })
      .join('')

    this.typeNameMap.set(mapKey, result)
    return result
  }

  private getFieldInterfaceName(type: string): string {
    const typeMap: Record<string, string> = {
      ID: 'IDField',
      LinkToAnotherRecord: 'LinkToAnotherRecordField',
      ForeignKey: 'ForeignKeyField',
      Lookup: 'LookupField',
      SingleLineText: 'SingleLineTextField',
      LongText: 'LongTextField',
      Attachment: 'AttachmentField',
      Checkbox: 'CheckboxField',
      MultiSelect: 'MultiSelectField',
      SingleSelect: 'SingleSelectField',
      Date: 'DateField',
      Year: 'YearField',
      Time: 'TimeField',
      PhoneNumber: 'PhoneNumberField',
      GeoData: 'GeoDataField',
      Email: 'EmailField',
      URL: 'UrlField',
      Number: 'NumberField',
      Decimal: 'DecimalField',
      Currency: 'CurrencyField',
      Percent: 'PercentField',
      Duration: 'DurationField',
      Rating: 'RatingField',
      Formula: 'FormulaField',
      Rollup: 'RollupField',
      DateTime: 'DateTimeField',
      CreatedTime: 'CreatedTimeField',
      LastModifiedTime: 'LastModifiedTimeField',
      Geometry: 'GeometryField',
      JSON: 'JsonField',
      SpecificDBType: 'SpecificDBTypeField',
      Barcode: 'BarcodeField',
      QrCode: 'QrCodeField',
      Button: 'ButtonField',
      Links: 'LinksField',
      User: 'UserField',
      CreatedBy: 'CreatedByField',
      LastModifiedBy: 'LastModifiedByField',
      Order: 'OrderField',
    }
    return typeMap[type] || `Field`
  }

  // Helper to get the full field type string (for extending interfaces)
  private getFieldTypeString(type: string): string {
    return `UITypes.${type}`
  }

  // Helper to check if a field is a system field
  private isSystemField(field: { system: boolean }): boolean {
    return Boolean(field.system)
  }

  private getFieldValueType(field: { type: string; options: any }): string {
    switch (field.type) {
      case UITypes.ID:
        return 'number'

      case UITypes.LinkToAnotherRecord:
        return 'Record<string, unknown>[] | Record<string, unknown>'

      case UITypes.ForeignKey:
        return 'string'

      case UITypes.Order:
        return 'number'

      case UITypes.Lookup:
        return 'Array<unknown>'

      case UITypes.SingleLineText:
      case UITypes.LongText:
      case UITypes.PhoneNumber:
      case UITypes.Email:
      case UITypes.URL:
      case UITypes.GeoData:
      case UITypes.Geometry:
      case UITypes.JSON:
      case UITypes.SpecificDBType:
      case UITypes.Barcode:
      case UITypes.QrCode:
      case UITypes.Date:
      case UITypes.Time:
      case UITypes.DateTime:
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
        return 'string'

      case UITypes.Year:
      case UITypes.Number:
      case UITypes.Decimal:
      case UITypes.Currency:
      case UITypes.Percent:
      case UITypes.Duration:
      case UITypes.Rating:
      case UITypes.Links:
        return 'number'

      case UITypes.Checkbox:
        return 'boolean'

      case UITypes.SingleSelect:
        if (field.options?.choices) {
          return field.options.choices.map((choice: any) => `'${choice.name}'`).join(' | ')
        }
        return 'string | null'

      case UITypes.MultiSelect:
        if (field.options?.choices) {
          const choiceType = field.options.choices.map((choice: any) => `'${choice.name}'`).join(' | ')
          return `Array<${choiceType}>`
        }
        return 'Array<string>'

      case UITypes.Attachment:
        return `Array<{
        url?: string;
        path?: string;
        title: string;
        mimetype: string;
        size: number;
        signedPath?: string;
        signedUrl?: string;
        thumbnails: {
          tiny: {
            signedPath: string | never
            signedUrl: string | never
          },
          small: {
            signedPath: string | never
            signedUrl: string | never
          },
          card_cover: {
            signedPath: string | never
            signedUrl: string | never
          },
        } | never
      }>`

      case UITypes.Formula:
        return 'string | number | boolean'

      case UITypes.Rollup:
        return 'number'

      case UITypes.Button:
        return `{
        label: string
        icon: string | never
      } & (
        {
          type: 'url'
          url: string
        }
        | {
          type: 'script'
          fk_script_id: string
        }
        | {
          type: 'webhook'
          button_hook_id: string
        }
      )`

      case UITypes.User:
        return field.options?.allow_multiple_users ? 'Collaborator[]' : 'Collaborator'

      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
        return 'Collaborator'

      default:
        return 'unknown'
    }
  }

  private generateFieldOptions(field: { type: keyof typeof UITypes; options: any }): string {
    switch (field.type) {
      case UITypes.SingleLineText:
      case UITypes.Attachment:
      case UITypes.ID:
      case UITypes.Year:
      case UITypes.GeoData:
      case UITypes.Geometry:
      case UITypes.JSON:
      case UITypes.Order:
      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy:
      case UITypes.ForeignKey:
      case UITypes.SpecificDBType:
        return 'never'

      case UITypes.LongText:
        return `{
        rich_text: ${Boolean(field.options?.rich_text)},
        ai: ${Boolean(field.options?.ai)}
      }`

      case UITypes.SingleSelect:
      case UITypes.MultiSelect:
        return `{
        choices: [
          ${
            field.options?.choices
              ?.map(
                (choice: any) => `{
            ${choice.id ? `id: '${choice.id}',` : ''}
            title: '${choice.title}',
            color: '${choice.color}'
          }`,
              )
              .join(',\n          ') || ''
          }
        ]
      }`

      case UITypes.Checkbox:
        return `{
        icon: ${
          field.options?.icon
            ? `'${field.options.icon}'`
            : "'square' | 'circle-check' | 'heart' | 'circle-filled' | 'thumbs-up' | 'flag'"
        },
        color: '${field.options?.color || ''}'
      }`

      case UITypes.DateTime:
      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
        return `{
        date_format: '${field.options?.date_format || ''}',
        time_format: '${field.options?.time_format || ''}',
        ['12hr_format']: ${Boolean(field.options?.['12hr_format'])},
        timezone: ${Boolean(field.options?.timezone) || 'null'},
        display_timezone: ${Boolean(field.options?.display_timezone)},
        use_same_timezone_for_all: ${Boolean(field.options?.use_same_timezone_for_all)}
      }`

      case UITypes.Date:
        return `{
        date_format: '${field.options?.date_format || ''}'
      }`

      case UITypes.Time:
        return `{
        ['12hr_format']: ${Boolean(field.options?.['12hr_format'])}
      }`

      case UITypes.Email:
      case UITypes.URL:
      case UITypes.PhoneNumber:
        return `{
        validation: ${Boolean(field.options?.validation)}
      }`

      case UITypes.Percent:
        return `{
        show_as_progress: ${Boolean(field.options?.show_as_progress)}
      }`

      case UITypes.Barcode:
        return `{
        barcode_format: '${field.options?.barcode_format || 'CODE128'}',
        barcode_value_field_id: '${field.options?.barcode_value_field_id || ''}'
      }`

      case UITypes.QrCode:
        return `{
        qrcode_value_field_id: '${field.options?.qrcode_value_field_id || ''}'
      }`

      case UITypes.Formula:
        if (!field.options?.formula) return 'null'
        return `{
        formula: '${field.options.formula}',
        result: ${
          field.options.result
            ? `{
          type: ${this.getFieldTypeString(field.options.result.type)},
          format: ${this.generateFieldOptions({
            type: field.options.result.type,
            options: field.options.result.options,
          })}
        }`
            : 'never'
        }
      }`

      case UITypes.Lookup:
        return `{
        related_table_lookup_field_id: '${field.options?.related_table_lookup_field_id || ''}',
        related_field_id: '${field.options?.related_field_id || ''}'
      }`

      case UITypes.Rollup:
        return `{
        related_table_rollup_field_id: '${field.options?.related_table_rollup_field_id || ''}',
        rollup_function: '${field.options?.rollup_function || 'count'}',
        related_field_id: '${field.options?.related_field_id || ''}'
      }`

      case UITypes.Links:
      case UITypes.LinkToAnotherRecord:
        return `{
        relation_type: '${field.options?.relation_type || 'mm'}',
        related_table_id: '${field.options?.related_table_id || ''}',
        limit_record_selection_view_id: ${
          field.options?.limit_record_selection_view_id ? `'${field.options.limit_record_selection_view_id}'` : 'null'
        }
      }`

      case UITypes.Number:
      case UITypes.Decimal:
        return `{
        locale_string: ${Boolean(field.options?.locale_string)}
      }`

      case UITypes.Currency:
        return `{
        locale: '${field.options?.locale || 'en-US'}',
        code: '${field.options?.code || 'USD'}'
      }`

      case UITypes.Duration:
        return `{
        duration_format: '${field.options?.duration_format || 'h:mm'}'
      }`

      case UITypes.Rating:
        return `{
        icon: '${field.options?.icon || 'star'}',
        max_value: ${field.options?.max_value || 5},
        color: '${field.options?.color || ''}'
      }`

      case UITypes.User:
        return `{
        allow_multiple_users: ${Boolean(field.options?.allow_multiple_users)},
        notify_user_when_added: ${Boolean(field.options?.notify_user_when_added)}
      }`
      case UITypes.Button: {
        const baseOptions = `{
        icon: '${field.options?.icon || ''}',
        label: '${field.options?.label || ''}',
        color: '${field.options?.color}',
        theme: '${field.options?.theme}'
      }`

        // Add type-specific options based on button type
        switch (field.options?.type) {
          case 'url':
            return `${baseOptions} & {
            type: 'url',
            formula: '${field.options?.formula || ''}',
            model?: never,
            script_id?: never,
            button_hook_id?: never,
            integration_id?: never
          }`

          case 'script':
            return `${baseOptions} & {
            type: 'script',
            script_id: '${field.options?.script_id || ''}',
            formula?: never,
            model?: never,
            button_hook_id?: never,
            integration_id?: never
          }`

          case 'webhook':
            return `${baseOptions} & {
            type: 'webhook',
            button_hook_id: '${field.options?.button_hook_id || ''}',
            formula?: never,
            model?: never,
            script_id?: never,
            integration_id?: never
          }`

          case 'ai':
            return `${baseOptions} & {
            type: 'ai',
            model: '${field.options?.model || ''}',
            integration_id: '${field.options?.integration_id || ''}',
            formula: '${field.options?.formula || ''}',
            script_id?: never,
            button_hook_id?: never
          }`

          default:
            return baseOptions
        }
      }
      default:
        return 'never'
    }
  }

  private generateFieldInterface(
    tableName: string,
    field: {
      id: string
      name: string
      type: any
      system: boolean
      primary_key: boolean | null
      primary_value: boolean | null
      default_value: any
      options: any
      description: string | null
    },
  ) {
    const interfaceName = `${this.pascalCase(tableName, 'table')}Table_${this.pascalCase(field.name, 'field')}Field`

    const extendInterfaceName = this.getFieldInterfaceName(field.type)

    this.write(`declare interface ${interfaceName} extends ${extendInterfaceName} {`)
    this.indent_in()

    // ID
    this.formatJSDoc('The unique identifier for the field')
    this.write(`readonly id: '${field.id}'`)

    // Name
    this.formatJSDoc('The name of the field as displayed in the UI')
    this.write(`readonly name: '${field.name}'`)

    // Type
    this.formatJSDoc('The type of the field as defined in UITypes enum')
    this.write(`readonly type: ${this.getFieldTypeString(field.type)}`)

    // isComputed
    this.formatJSDoc('Whether this field is a computed field')
    this.write(`readonly isComputed: ${isVirtualCol(field.type)}`)

    /* // System
    this.formatJSDoc('Whether this is a system field (true) or user-defined field (false)')
    this.write(`readonly system: ${field.system ?? false}`)

    // primary_key
    this.formatJSDoc('Whether this field is the primary key. Null if not applicable.')
    this.write(`readonly primary_key: ${field.primary_key}`)

    // primary_value
    this.formatJSDoc('Whether this field is the primary value display field. Null if not applicable.')
    this.write(`readonly primary_key: ${field.primary_value}`)
*/
    // Description
    this.formatJSDoc('Optional description of the field')
    this.write(`readonly description: '${field.description || ''}'`)

    // Default value
    this.formatJSDoc('Default value for the field if no value is provided')
    this.write(`readonly default_value: '${field.default_value || ''}'`)

    this.formatJSDoc([
      "The configuration options of the field. The structure of the field's options depend on the field's",
      'type. See cell values & field options for the options structure of each field',
      'type.',
    ])
    this.write(`readonly options: ${this.generateFieldOptions(field)}`)

    this.indent_out()
    this.write('}')
    this.write('')
  }

  private generateRecordInterface(
    tableName: string,
    fields: {
      id: string
      name: string
      type: keyof typeof UITypes
      system: boolean
      primary_key: boolean | null
      primary_value: boolean | null
      default_value: any
      options: any
      description: string | null
    }[],
  ) {
    const interfaceName = `${this.pascalCase(tableName, 'table')}Table_Record`
    this.write(`declare interface ${interfaceName} extends NocoDBRecord {`)
    this.indent_in()

    for (const field of fields) {
      const fieldType = this.getFieldValueType(field)
      const fieldInterfaceName = `${this.pascalCase(tableName, 'table')}Table_${this.pascalCase(field.name, 'field')}Field`

      // getCellValue by name
      this.formatJSDoc([
        'Gets a specific cell value in this record. See cell values & field options for the cell value format for each field type.',
      ])
      this.write(`getCellValue(name: '${field.name}'): ${fieldType}`)

      // getCellValue by field
      this.write(`getCellValue(field: ${fieldInterfaceName}): ${fieldType}`)

      // getCellValueAsString by name
      this.formatJSDoc(['Gets a specific cell value in this record, formatted as a `string`.'])
      this.write(`getCellValueAsString(name: '${field.name}'): string`)

      // Generic getCellValue
      this.write(`getCellValue(fieldOrIdOrName: Field | string): any`)

      // Generic getCellValueAsString
      this.write(`getCellValueAsString(fieldOrIdOrName: Field | string): string`)
    }

    this.indent_out()
    this.write('}')
    this.write('')

    this.generateRecordQueryResultInterface(tableName, fields)
  }

  private generateRecordQueryResultInterface(
    tableName: string,
    fields: {
      id: string
      name: string
      type: keyof typeof UITypes
      system: boolean
      primary_key: boolean | null
      primary_value: boolean | null
      default_value: any
      options: any
      description: string | null
    }[],
  ) {
    const recordType = `${this.pascalCase(tableName, 'table')}Table_Record`

    this.write(`declare interface ${this.pascalCase(tableName, 'table')}Table_RecordQueryResult extends RecordQueryResult {`)
    this.indent_in()

    // Records array
    this.formatJSDoc(['Array of records in this result set'])
    this.write(`readonly records: ReadonlyArray<{
      id: string;
      ${fields.map((field) => `'${field.name}'?: ${this.getFieldValueType(field)}`).join(';\n      ')}
    }>`)

    // getRecord method
    this.formatJSDoc(["Get a specific record in the query result, or throw if that record doesn't exist or was filtered", 'out.'])
    this.write(`getRecord(recordId: string): ${recordType}`)

    this.indent_out()
    this.write('}')
    this.write('')
  }

  private generateViewInterface(
    tableName: string,
    view: {
      id: string
      type: string
      name: string
      description: string | null
    },
  ) {
    const interfaceName = `${this.pascalCase(tableName, 'table')}Table_${this.pascalCase(view.name, 'view')}View`

    this.write(`declare interface ${interfaceName} extends View {`)
    this.indent_in()

    // Properties
    this.formatJSDoc(['The unique ID of this view.'])
    this.write(`readonly id: '${view.id}'`)

    this.formatJSDoc(['The name of the view.'])
    this.write(`readonly name: '${view.name}'`)

    this.formatJSDoc(['Description of the view, if any.'])
    this.write(`readonly description: ${view.description ? `'${view.description}'` : 'null'}`)

    this.formatJSDoc(['The type of the view, such as Grid, Calendar, or Kanban.'])
    this.write(`readonly type: 'grid' | 'form' | 'calendar' | 'gallery' | 'kanban'`)

    // selectRecordsAsync
    this.formatJSDoc([
      'Select records from the view. This action is asynchronous.',
      'Always includes primary key and primary value fields in results.',
      '',
      '@param options - Query options including fields, sorts, and pagination',
    ])
    this.write(`selectRecordsAsync(options?: {
    /**
     * Fields to include in results
     */
    fields?: ReadonlyArray<Field | string>
    /**
     * Sort specifications
     */
    sorts?: ReadonlyArray<{
      field: Field | string
      direction: 'asc' | 'desc'
    }>
    /**
     * Specific record IDs to fetch
     */
    recordIds?: ReadonlyArray<string>
    /**
     * Maximum records to return (default: 500)
     */
    limit?: number
    /**
     * Number of records to skip
     */
    offset?: number
  }): Promise<${this.pascalCase(tableName, 'table')}Table_RecordQueryResult>`)

    // selectRecordAsync
    this.formatJSDoc([
      'Select a single record from the view. This action is asynchronous.',
      'Always includes primary key and primary value fields in results.',
      '',
      '@param recordId - ID of the record to fetch',
      '@param options - Options for selecting fields',
    ])
    this.write(`selectRecordAsync(
    recordId: any,
    options?: {
      fields?: Array<Field | string>
    },
  ): Promise<${this.pascalCase(tableName, 'table')}Table_Record | null>`)

    this.indent_out()
    this.write('}')
    this.write('')
  }

  private generateTableInterface(table: { id: string; name: string; description: string | null; fields: any[]; views: any[] }) {
    const tableName = this.pascalCase(table.name, 'table')
    const interfaceName = `${tableName}Table`

    this.write(`declare interface ${interfaceName} extends Table {`)
    this.indent_in()

    // Properties
    this.formatJSDoc(['The ID of this table.'])
    this.write(`readonly id: '${table.id}'`)

    this.formatJSDoc(['The name of the table.'])
    this.write(`readonly name: '${table.name}'`)

    this.formatJSDoc(['The views in this table.'])
    this.write(
      `readonly views: [${table.views.map((v) => `${tableName}Table_${this.pascalCase(v.name, 'view')}View`).join(', ')}]`,
    )

    this.formatJSDoc([
      'The fields in this table. The order is arbitrary, since fields are only ordered in the context of a',
      'specific view.',
    ])
    this.write(
      `readonly fields: [${table.fields.map((f) => `${tableName}Table_${this.pascalCase(f.name, 'field')}Field`).join(', ')}]`,
    )

    this.formatJSDoc([
      'Select records from the table. This action is asynchronous: you must add `await` before each call to this method.',
    ])
    this.write(`selectRecordsAsync(options?: {
    sorts?: ReadonlyArray<{
      field: Field | string
      direction: 'asc' | 'desc'
    }>
    recordIds?: ReadonlyArray<string>
    fields?: ReadonlyArray<Field | string | null | undefined>
  }): Promise<${this.pascalCase(tableName, 'table')}Table_RecordQueryResult>`)

    // selectRecordAsync
    this.formatJSDoc([
      'Select a single record from the table. This action is asynchronous: you must add `await` before each call to this method.',
      'If the specified record cannot be found, `null` will be returned.',
    ])
    this.write(`selectRecordAsync(
    recordId: any,
    options?: {
      fields?: Array<Field | string | null | undefined>
    },
  ): Promise<${this.pascalCase(tableName, 'table')}Table_Record | null>`)

    const generateFieldKeysType = (fields: any[]) => {
      const fieldKeys = fields
        .filter((f) => !f.system)
        .map(
          (field) =>
            `['${field.name}']?: ${this.getFieldValueType(field)}
      ${field.id}?: ${this.getFieldValueType(field)}`,
        )
        .join('\n      ')

      return `{
      ${fieldKeys}
    }`
    }

    this.formatJSDoc([
      'Creates a new record with the specified field values.',
      'Field values can be referenced by either field name or ID.',
      'This action is asynchronous.',
      '',
      '@param data - Record data with field values',
      '@returns ID of created record',
    ])
    this.write(`createRecordAsync(data: ${generateFieldKeysType(table.fields)}): Promise<string>`)

    this.formatJSDoc([
      'Creates multiple records with the specified field values.',
      'Field values can be referenced by either field name or ID.',
      'This action is asynchronous.',
      '',
      '@param data - Array of record data',
      '@returns Array of created record IDs',
    ])
    this.write(`createRecordsAsync(data: Array<${generateFieldKeysType(table.fields)}>): Promise<string[]>`)

    this.formatJSDoc([
      'Updates cell values for a record.',
      'Field values can be referenced by either field name or ID.',
      'This action is asynchronous.',
      '',
      '@param recordId - ID of record to update',
      '@param data - New field values',
    ])

    this.write(
      `updateRecordAsync(recordOrRecordId:  ${this.pascalCase(
        tableName,
        'table',
      )}Table_Record | any, data: ${generateFieldKeysType(table.fields)}): Promise<void>`,
    )

    this.formatJSDoc([
      'Updates cell values for multiple records.',
      'Field values can be referenced by either field name or ID.',
      'This action is asynchronous.',
      '',
      '@param data - Array of record updates',
    ])

    this.write(`updateRecordsAsync(data: Array<{id: string, fields: ${generateFieldKeysType(table.fields)}}>): Promise<void>`)

    this.formatJSDoc([
      'Delete a record from the table.',
      'This action is asynchronous.',
      '',
      '@param recordIdOrRecord - string or Record',
    ])

    this.write(`deleteRecordAsync(recordIdOrRecord: string | ${this.pascalCase(tableName, 'table')}Table_Record): Promise<void>`)

    this.formatJSDoc([
      'Delete records from the table.',
      'This action is asynchronous.',
      '',
      '@param recordIdOrRecord - Array of string or Record',
    ])

    this.write(
      `deleteRecordsAsync(recordIdOrRecords: Array<string | ${this.pascalCase(tableName, 'table')}Table_Record>): Promise<void>`,
    )

    // getView
    this.write(`/**
   * Get a view in the table according to its id or name.
   */`)
    table.views.forEach((view) => {
      this.write(
        `getView(name: '${view.name}'): ${this.pascalCase(tableName, 'table')}Table_${this.pascalCase(view.name, 'view')}View;`,
      )
    })
    this.write(`getView(idOrName: string): View;`)

    // getField
    this.write(`/**
   * Get a field in the table according to its id or name.
   */`)
    table.fields.forEach((field) => {
      this.write(
        `getField(name: '${field.name}'): ${this.pascalCase(tableName, 'table')}Table_${this.pascalCase(
          field.name,
          'field',
        )}Field;`,
      )
    })
    this.write(`getField(idOrName: string): Field;`)

    this.indent_out()
    this.write('}')
    this.write('')
  }

  private generateBaseInterface(schema: any) {
    this.write('declare interface Base {')
    this.indent_in()

    this.formatJSDoc(['The unique ID of your base.'])
    this.write(`readonly id: '${schema.id}'`)

    this.formatJSDoc(['The name of your base.'])
    this.write(`readonly name: '${schema.name}'`)

    this.formatJSDoc('The users who have access to this base.')
    this.write(`readonly activeCollaborators: ReadonlyArray<Collaborator>`)

    this.formatJSDoc('The tables in this base.')

    const tableTypes = schema.tables.map((table: any) => `${this.pascalCase(table.name, 'table')}Table`)

    this.write(`readonly tables: [${tableTypes.join(', ')}]`)

    this.formatJSDoc('Get a table from the base according to its ID or name.')

    for (const table of schema.tables) {
      const tableType = `${this.pascalCase(table.name, 'table')}Table`
      this.write(`getTable(name: '${table.name}' | '${table.id}'): ${tableType}`)
    }
    this.write(`getTable(idOrName: string): Table`)

    this.formatJSDoc('Get a user from the base according to their ID, name, or email.')

    this.write(`getCollaborator(idOrEmailOrName: string): Collaborator`)

    for (const collab of schema.collaborators) {
      this.write(`getCollaborator(email: '${collab.email}'): Collaborator`)
      this.write(`getCollaborator(id: '${collab.id}'): Collaborator`)

      if (collab.display_name) {
        this.write(`getCollaborator(name: '${collab.display_name}'): Collaborator`)
      }
    }

    this.formatJSDoc([
      'Create a new table in the base.',
      '@param name Name of the table',
      '@param fields of the table',
      '@returns Promise resolving to the newly created Table',
    ])

    this.write(`createTableAsync(name: string, fields: Array<{`)
    this.indent_in()
    this.write(`[T in UITypes]: {`)
    this.formatJSDoc(['The name for the field'])
    this.write(`name: string;`)
    this.formatJSDoc(['The type of field to create'])
    this.write(`type: T;`)
    this.formatJSDoc(['Optional description for the field'])
    this.write(`description?: string | null;`)
    this.formatJSDoc(['Optional default value for the field'])
    this.write(`default_value?: any;`)
    this.formatJSDoc(['Type-specific options for the field'])
    this.write(`options?: FieldOptionsWriteFormat<T>;`)
    this.indent_out()
    this.write(`}`)
    this.write(`}[UITypes]>): Promise<Table>`)
    this.indent_out()

    this.write('}')
  }

  generateInputInterface(schema: any) {
    this.write(`declare var input: {`)
    this.indent_in()

    this.formatJSDoc([
      `Define settings using the input.config() method. This should only be called once, at the top of your script. `,
      `It returns the values that have been filled in by the users of your script.`,
    ])
    this.write(`config: {`)
    this.indent_in()

    this.formatJSDoc([
      `Configure the script's input form.`,
      `@param settings Settings for your script.`,
      `@param settings.title Title of your script.`,
      `@param settings.description Optional. Description of what your script does. Markdown is partially supported (e.g. for links)`,
      `@param settings.items Optional. List of items used to generate the script settings UI`,
      `@returns An object containing the configured values, keyed by their setting identifiers`,
    ])
    this.write(`(settings: {`)
    this.indent_in()
    this.write(`title: string;`)
    this.write(`description?: string;`)
    this.write(`items?: Array<ConfigItem>;`)
    this.indent_out()
    this.write(`}): any;`)

    // input.config.table
    this.formatJSDoc([
      `Defines a setting for a Table.`,
      `@param key A unique identifier for the table.`,
      `@param options Optional. Options for the table setting`,
      `@param options.label Optional. Label for the table picker.`,
      `@param options.description Optional. Description for the table picker.`,
    ])
    this.write(`table(key: string, options?: {`)
    this.indent_in()
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    // input.config.field
    this.formatJSDoc([
      `Defines a setting for a Field.`,
      `Requires that a valid parentTable has already been defined as a previous setting.`,
      `@param key A unique identifier for the field.`,
      `@param options Optional. Options for the field setting`,
      `@param options.label Optional. Label for the field picker.`,
      `@param options.description Optional. Description for the field picker.`,
      `@param options.parentTable The key for a previously-defined table setting.`,
    ])

    this.write(`field(key: string, options: {`)
    this.indent_in()
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.write(`parentTable: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    // input.config.view
    this.formatJSDoc([
      `Defines a setting for a View.`,
      `Requires that a valid parentTable has already been defined as a previous setting.`,
      `@param key A unique identifier for the view.`,
      `@param options Optional. Options for the view setting`,
      `@param options.label Optional. Label for the view picker.`,
      `@param options.description Optional. Description for the view picker.`,
      `@param options.parentTable The key for a previously-defined table setting.`,
    ])
    this.write(`view(key: string, options: {`)
    this.indent_in()
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.write(`parentTable: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    // input.config.text
    this.formatJSDoc([
      `Defines a setting for a text variable.`,
      `@param options Optional. Options for the text setting.`,
      `@param options.label Optional. Label for the text input.`,
      `@param options.description Optional. Description for the text input.`,
    ])
    this.write(`text(key: string, options?: {`)
    this.indent_in()
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    // input.config.number
    this.formatJSDoc([
      `ADefines a setting for a number variable`,
      `@param key A unique identifier for the number setting.`,
      `@param options Optional. Options for the number setting.`,
      `@param options.label Optional. Label for the number input.`,
      `@param options.description Optional. Description for the number input.`,
    ])
    this.write(`number(key: string, options?: {`)
    this.indent_in()
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    // input.config.select
    this.formatJSDoc([
      `Defines a setting for a select option.`,
      `The value returned will be the string value of the currently selected option.`,
      `@param key A unique identifier for the select setting.`,
      `@param options Options for the select setting.`,
      `@param options.label Optional. Label for the dropdown menu.`,
      `@param options.description Optional. Description for the dropdown menu.`,
      `@param options.options List of options for the dropdown menu.`,
      `@param options.options.value Returned value for a given select option. Will also be used as the option label if no label is defined.`,
      `@param options.options.label Optional. Label for a given select option.`,
    ])
    this.write(`select(key: string, options: {`)
    this.indent_in()
    this.write(`options: Array<{value: string, label?: string}>;`)
    this.write(`label?: string;`)
    this.write(`description?: string;`)
    this.indent_out()
    this.write(`}): ConfigItem;`)

    this.indent_out()
    this.write(`};`)

    // input.textAsync
    this.formatJSDoc([
      `Prompts the user to enter text.`,
      `This is an asynchronous operation that should be used with await.`,
      `@param label Label explaining what the user should enter.`,
      `@returns The text value entered by the user.`,
      '',
      `@example`,
      `let name = await input.textAsync('What is your name?');`,
      `output.text(\`Your name is \${name}.\`);`,
    ])

    this.write(`textAsync(label: string): Promise<string>;`)
    this.write()

    // input.buttonAsync
    this.formatJSDoc([
      `Prompts the user to choose from a list of string options.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Array of string options to choose from`,
      `@returns Promise resolving to the selected string option`,
    ])
    this.write(`buttonsAsync<T extends string>(label: string, options: ReadonlyArray<T>): Promise<T>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to choose from a list of button options with primitive values.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Array of button options with primitive values`,
      `@returns Promise resolving to the selected option's value`,
    ])
    this.write(`buttonsAsync<T extends string | number | boolean | null | undefined>(
    label: string, 
    options: ReadonlyArray<ButtonOption<T>>
  ): Promise<T>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to choose from a list of button options with any value type.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Array of button options`,
      `@returns Promise resolving to the selected option's value`,
    ])
    this.write(`buttonsAsync<T>(label: string, options: ReadonlyArray<ButtonOption<T>>): Promise<T>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to choose from a mixed list of string options and button options with primitive values.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Mixed array of strings and button options`,
      `@returns Promise resolving to either a string or the selected option's value`,
    ])
    this.write(`buttonsAsync<T1 extends string, T2 extends string | number | boolean | null | undefined>(
    label: string, 
    options: ReadonlyArray<T1 | ButtonOption<T2>>
  ): Promise<T1 | T2>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to choose from a mixed list of string options and button options with any value type.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Mixed array of strings and button options`,
      `@returns Promise resolving to either a string or the selected option's value`,
    ])
    this.write(`buttonsAsync<T1 extends string, T2>(
    label: string, 
    options: ReadonlyArray<T1 | ButtonOption<T2>>
  ): Promise<T1 | T2>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to choose from a mixed list of options.`,
      `@param label - A label explaining what the user is choosing`,
      `@param options - Mixed array of options`,
      `@returns Promise resolving to the selected value`,
    ])
    this.write(`buttonsAsync(label: string, options: ReadonlyArray<string | ButtonOption<any>>): Promise<any>;`)

    // input.fileAsync

    this.formatJSDoc([
      `Prompts the user to import a file.`,
      `@param label - A label explaining what file being requested`,
      `@param options - Options for file import`,
      `@param options.allowedFileTypes - Which file types can be imported (e.g. '.xlsx', 'application/json', 'image/*')`,
      `@param options.hasHeaderRow - For csv files, whether first row contains headers`,
      `@param options.useRawValues - For csv files, whether to return raw string values`,
    ])
    this.write(`fileAsync(label: string, options?: {
 /** If provided, restricts allowed file types (e.g. '.xlsx', 'application/json', 'image/*') */
 allowedFileTypes?: Array<string>;
 /** For spreadsheets, whether first row contains column headers */
 hasHeaderRow?: boolean; 
 /** For csv, whether to return raw string values vs parsed types */
 useRawValues?: boolean;
}): Promise<{
 /** The uploaded file */
 file: NcFile;
 /** Parsed contents for supported file types (.csv) */
 parsedContents: any;
}>;`)

    // input.selectAsync
    this.formatJSDoc([
      `Prompts the user to select an option from a dropdown menu.`,
      `@param label - A label explaining what the user is selecting`,
      `@param options - Array of options to choose from`,
      `@returns Promise resolving to the selected option's value`,
    ])
    this.write(`selectAsync<T extends string>(label: string, options: ReadonlyArray<T>): Promise<T>;`)
    this.write()

    this.formatJSDoc([
      `Prompts the user to select an option from a dropdown menu with custom labels and values.`,
      `@param label - A label explaining what the user is selecting`,
      `@param options - Array of options with labels and values`,
      `@returns Promise resolving to the selected option's value`,
    ])
    this.write(`selectAsync<T>(label: string, options: ReadonlyArray<{
    label: string;
    value: T;
}>): Promise<T>;`)

    // input.tableAsync

    const allTableType = schema.tables.map((table: any) => `${this.pascalCase(table.name, 'table')}Table`).join(' | ')

    this.formatJSDoc([
      `Prompts the user to select a table.`,
      `@param label - A label explaining what the user is selecting`,
      `@returns Promise<Table> Promise resolving to the selected table`,
      `@example`,
      `let table = await input.tableAsync('Select a table');`,
      `output.text(\`You selected the table \${table.name}\`);`,
    ])
    this.write(`tableAsync(label: string): Promise<${allTableType}>;`)

    this.formatJSDoc([
      `Prompts the user to select a table.`,
      `@param label - A label explaining what the user is selecting`,
      `@returns Promise<Table> Promise resolving to the selected table`,
      `@example`,
      `let table = await input.tableAsync('Select a table');`,
      `output.text(\`You selected the table \${table.name}\`);`,
    ])
    this.write(`tableAsync(label: string): Promise<Table>;`)

    // input.viewAsync
    for (const table of schema.tables) {
      const tableName = this.pascalCase(table.name, 'table')
      this.formatJSDoc([
        `Prompts the user to select a view from the ${table.name} table.`,
        `@param label - A label explaining what the user is selecting`,
        `@param tableOrTableNameOrTableId - The table, table name, or table ID to select from`,
        `@returns Promise<View> Promise resolving to the selected view`,
        `@example`,
        `let view = await input.viewAsync('Select a view');`,
        `output.text(\`You selected the view \${view.name}\`);`,
      ])

      const viewTypes = table.views
        .map((view: { name: string }) => `${tableName}Table_${this.pascalCase(view.name, 'view')}View`)
        .join(' | ')
      this.write(
        `viewAsync(label: string, tableOrTableNameOrTableId: ${tableName}Table | "${table.name}" | "${table.id}"): Promise<${viewTypes}>;`,
      )
    }

    this.formatJSDoc([
      `Prompts the user to select a view from any table.`,
      `@param label - A label explaining what the user is selecting`,
      `@param tableOrTableNameOrTableId - The table, table name, or table ID to select from`,
      `@returns Promise resolving to the selected view`,
    ])
    this.write(`viewAsync(label: string, tableOrTableNameOrTableId: Table | string): Promise<View>;`)
    this.write()

    // input.fieldAsync

    for (const table of schema.tables) {
      const tableName = this.pascalCase(table.name, 'table')
      const fieldTypes = table.fields
        .map((field: { name: string }) => `${tableName}Table_${this.pascalCase(field.name, 'field')}Field`)
        .join(' | ')

      this.formatJSDoc([
        `Prompts the user to select a field from the ${table.name} table.`,
        `@param label - A label explaining what the user is selecting`,
        `@param tableOrTableNameOrTableId - The table, table name, or table ID to select from`,
        `@returns Promise resolving to the selected field`,
      ])
      this.write(
        `fieldAsync(label: string, tableOrTableNameOrTableId: ${tableName}Table | "${table.name}" | "${table.id}"): Promise<${fieldTypes}>;`,
      )
      this.write()
    }

    this.formatJSDoc([
      `Prompts the user to select a field from any table.`,
      `@param label - A label explaining what the user is selecting`,
      `@param tableOrTableNameOrTableId - The table, table name, or table ID to select from`,
      `@returns Promise resolving to the selected field`,
    ])
    this.write(`fieldAsync(label: string, tableOrTableNameOrTableId: Table | string): Promise<Field>;`)
    this.write()

    // input.recordAsync
    // Generic Input
    this.formatJSDoc([
      `Prompts the user to select a record from any source.`,
      `@param label - A label explaining what the user is selecting`,
      `@param source - The source to select from`,
      `@param options - Additional options for record selection`,
      `@returns Promise resolving to the selected record or null`,
    ])
    this.write(`recordAsync(label: string, source: Table | View | RecordQueryResult | ReadonlyArray<Record>, options?: {`)
    this.indent_in()
    this.write(`fields?: ReadonlyArray<Field | string;`)
    this.write(`shouldAllowCreatingRecord?: boolean;`)
    this.indent_out()
    this.write(`}): Promise<Record | null>;`)

    for (const table of schema.tables) {
      const tableName = this.pascalCase(table.name, 'table')
      const fieldTypes = table.fields
        .map((field: any) => `${tableName}Table_${this.pascalCase(field.name, 'field')}Field | "${field.name}" | "${field.id}"`)
        .join(' | ')

      this.formatJSDoc([
        `Prompts the user to select a record from the ${table.name} table.`,
        `@param label - A label explaining what the user is selecting`,
        `@param source - The table to select from`,
        `@param options - Additional options for record selection`,
        `@returns Promise resolving to the selected record or null`,
      ])
      this.write(`recordAsync(label: string, source: ${tableName}Table, options?: {
   fields?: ReadonlyArray<${fieldTypes}>;
   shouldAllowCreatingRecord?: boolean;
 }): Promise<${tableName}Table_Record | null>;`)
      this.write()

      this.write(`recordAsync(label: string, source: ReadonlyArray<${tableName}Table_Record>, options?: {
   fields?: ReadonlyArray<${fieldTypes}>;
   shouldAllowCreatingRecord?: boolean;
 }): Promise<${tableName}Table_Record | null>;`)
      this.write()

      this.write(`recordAsync(label: string, source: ${tableName}Table_RecordQueryResult, options?: {
   fields?: ReadonlyArray<${fieldTypes}>;
   shouldAllowCreatingRecord?: boolean;
 }): Promise<${tableName}Table_Record | null>;`)
      this.write()

      for (const view of table.views) {
        const viewName = this.pascalCase(view.name, 'view')
        this.write(`recordAsync(label: string, source: ${tableName}Table_${viewName}View, options?: {
    fields?: ReadonlyArray<${fieldTypes}>;
    shouldAllowCreatingRecord?: boolean;
  }): Promise<${tableName}Table_Record | null>;`)
        this.write()
      }
    }

    this.indent_out()
    this.write(`}`)
  }

  generateTypes(schema: any): string {
    for (const table of schema.tables) {
      this.write(`// Field interfaces for table: ${table.name}`)
      for (const field of table.fields) {
        this.generateFieldInterface(table.name, field)
      }

      this.write(`// NocoDBRecord and RecordQueryResult interfaces for table : ${table.name}`)

      this.generateRecordInterface(table.name, table.fields)

      this.write(`// View interfaces for table: ${table.name}`)
      for (const view of table.views) {
        this.generateViewInterface(table.name, view)
      }

      this.write(`// Table interface for table: ${table.name}`)
      this.generateTableInterface(table)
    }

    this.write(`// Base Interface interface: ${schema.name}`)

    this.generateBaseInterface(schema)

    this.write('declare let base: Base')

    this.write(`// Input Interface`)

    this.generateInputInterface(schema)

    return this.output.join('\n')
  }
}
