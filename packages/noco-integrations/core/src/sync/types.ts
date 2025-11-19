import { Readable } from 'stream';
import { UITypes, TARGET_TABLES } from 'nocodb-sdk';
import { IntegrationWrapper } from '../integration';
import { AuthIntegration } from '../auth';

/**
 * Represents a data object that can be synced from an external source.
 *
 * @template T - The type of data being synced. Defaults to a record with string, number, boolean, or null values.
 *
 * @example
 * ```typescript
 * const contact: DataObject = {
 *   targetTable: TARGET_TABLES.CONTACTS,
 *   recordId: 'contact-123',
 *   data: {
 *     firstName: 'John',
 *     lastName: 'Doe',
 *     email: 'john@example.com'
 *   },
 *   links: {
 *     Account: ['account-456']
 *   }
 * };
 * ```
 */
export interface DataObject
<T = Record<string, string | number | boolean | null>,
> {
  /**
   * The target table to sync this data to.
   * Use values from TARGET_TABLES enum or custom table names for custom syncs.
   */
  targetTable: string;

  /**
   * A unique identifier for the record in the external system.
   * Used to identify and update records across sync operations.
   */
  recordId: string;

  /**
   * The data to sync to the target table.
   * Optional only when adding relationships to existing records - in that case, use an empty object.
   * All values should be primitive types (string, number, boolean, or null).
   */
  data?: T;

  /**
   * Links to other records, representing relationships between tables.
   * Key is the column name, value is an array of record IDs or null.
   *
   * @example
   * ```typescript
   * links: {
   *   Account: ['account-123', 'account-456'],
   *   Owner: ['user-789']
   * }
   * ```
   */
  links?: Record<string, SyncLinkValue>;
}

/**
 * A readable stream that emits DataObject instances in object mode.
 * Used for streaming large datasets during sync operations to avoid memory issues.
 *
 * @template T - The type of data in each DataObject. Defaults to a record with primitive values.
 *
 * @example
 * ```typescript
 * const stream = new DataObjectStream<SyncRecord>();
 *
 * // Push data to the stream
 * stream.push({
 *   targetTable: TARGET_TABLES.CONTACTS,
 *   recordId: 'contact-123',
 *   data: { firstName: 'John' }
 * });
 *
 * // End the stream
 * stream.push(null);
 *
 * // Consume the stream
 * stream.on('data', (dataObject) => {
 *   console.log('Received:', dataObject);
 * });
 * ```
 */
export class DataObjectStream
<T = Record<string, string | number | boolean | null>,
> extends Readable {
  constructor() {
    super({ objectMode: true });
  }

  /**
   * Internal method required by Readable stream.
   * No-op implementation as data is pushed externally.
   * @internal
   */
  _read(_size: number): void {
    return;
  }

  // Type-safe event listener overloads
  on(event: 'close', listener: () => void): this;
  on(event: 'data', listener: (chunk: DataObject<T>) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'pause', listener: () => void): this;
  on(event: 'readable', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /**
   * Pushes a DataObject to the stream or null to signal the end.
   *
   * @param data - The DataObject to push, or null to end the stream
   * @returns true if the stream can continue receiving data, false if it should wait for 'drain'
   */
  push(data: DataObject<T> | null): boolean {
    return super.push(data);
  }
}

/**
 * Abstract base class for integrations that sync data from external sources.
 *
 * Sync integrations are responsible for:
 * - Defining the schema of data to be synced (tables, columns, relationships)
 * - Fetching data from the external source in a streaming fashion
 * - Formatting raw data into the standard SyncRecord format
 * - Providing incremental sync capabilities
 *
 * @template T - The configuration type for this integration
 *
 * @example
 * ```typescript
 * export class SalesforceSyncIntegration extends SyncIntegration<SalesforceConfig> {
 *   async getDestinationSchema(auth: AuthIntegration<any, any>) {
 *     return auth.use(async (client) => {
 *       const metadata = await client.describeGlobal();
 *       return this.transformToSchema(metadata);
 *     });
 *   }
 *
 *   async fetchData(auth: AuthIntegration<any, any>, args) {
 *     const stream = new DataObjectStream<SyncRecord>();
 *     // Fetch and stream data...
 *     return stream;
 *   }
 * }
 * ```
 */
export abstract class SyncIntegration<T = any> extends IntegrationWrapper<T> {
  /**
   * Returns the human-readable title for this integration type.
   * Override this method to provide a custom title.
   *
   * @returns The integration title
   */
  getTitle() {
    return 'Sync Integration';
  }

  /**
   * Retrieves the schema definition for the destination tables.
   * Defines what tables, columns, and relationships will be created during sync.
   *
   * @param auth - The authenticated integration instance with automatic token refresh
   * @returns A promise resolving to either a standard SyncSchema or CustomSyncSchema
   *
   * @example
   * ```typescript
   * async getDestinationSchema(auth: AuthIntegration<any, any>) {
   *   return auth.use(async (client) => {
   *     const tables = await client.getTables();
   *     return {
   *       [TARGET_TABLES.CONTACTS]: {
   *         title: 'Contacts',
   *         columns: [...],
   *         relations: [...]
   *       }
   *     };
   *   });
   * }
   * ```
   */
  abstract getDestinationSchema(
    auth: AuthIntegration<any, any>,
  ): Promise<SyncSchema | CustomSyncSchema>;

  /**
   * Fetches data from the external source and returns it as a stream.
   * This method should handle pagination internally and emit DataObjects as they're fetched.
   *
   * Use the auth.use() method to make authenticated API calls with automatic token refresh.
   *
   * @param auth - The authenticated integration instance with automatic token refresh
   * @param args - Fetch parameters
   * @param args.targetTables - Optional array of specific tables to sync. If omitted, syncs all tables.
   * @param args.targetTableIncrementalValues - Last sync values for incremental sync (by table or namespace)
   * @returns A stream of DataObjects representing records to sync
   *
   * @example
   * ```typescript
   * async fetchData(auth: AuthIntegration<any, any>, args) {
   *   const stream = new DataObjectStream<SyncRecord>();
   *
   *   (async () => {
   *     try {
   *       const records = await auth.use(async (client) => {
   *         return client.getContacts({
   *           modifiedSince: args.targetTableIncrementalValues?.Contacts
   *         });
   *       });
   *
   *       for (const record of records) {
   *         const formatted = this.formatData(TARGET_TABLES.CONTACTS, record);
   *         stream.push({
   *           targetTable: TARGET_TABLES.CONTACTS,
   *           recordId: record.id,
   *           data: formatted.data,
   *           links: formatted.links
   *         });
   *       }
   *       stream.push(null);
   *     } catch (err) {
   *       stream.destroy(err);
   *     }
   *   })();
   *
   *   return stream;
   * }
   * ```
   */
  abstract fetchData(
    auth: AuthIntegration<any, any>,
    args: {
      targetTables?: (TARGET_TABLES | string)[];
      targetTableIncrementalValues?:
        | Record<TARGET_TABLES | string, string | number>
        | {
        // for multiple namespaces
        [key: string]: Record<TARGET_TABLES | string, string | number>;
      };
    },
  ): Promise<DataObjectStream<SyncRecord>>;

  /**
   * Transforms raw data from the external source into the standard SyncRecord format.
   *
   * This method should:
   * - Map external field names to internal field names
   * - Convert data types as needed
   * - Extract metadata like RemoteCreatedAt, RemoteUpdatedAt
   * - Store the complete raw data in RemoteRaw for reference
   * - Extract relationship links
   *
   * @param targetTable - The table this data belongs to
   * @param data - The raw data from the external source
   * @param namespace - Optional namespace for multi-tenant scenarios
   * @returns An object containing the formatted data and any relationship links
   *
   * @example
   * ```typescript
   * formatData(targetTable: string, data: any, namespace?: string) {
   *   return {
   *     data: {
   *       RemoteCreatedAt: data.CreatedDate,
   *       RemoteUpdatedAt: data.LastModifiedDate,
   *       RemoteRaw: JSON.stringify(data),
   *       RemoteNamespace: namespace,
   *       FirstName: data.FirstName,
   *       LastName: data.LastName,
   *       Email: data.Email
   *     },
   *     links: {
   *       Account: data.AccountId ? [data.AccountId] : null
   *     }
   *   };
   * }
   * ```
   */
  abstract formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
    namespace?: string,
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  };

  /**
   * Returns the field name to use for incremental sync for a given table.
   * This is typically a timestamp field like 'RemoteUpdatedAt'.
   *
   * @param targetTable - The table to get the incremental key for
   * @returns The field name to use for incremental sync, or null if incremental sync is not supported
   *
   * @example
   * ```typescript
   * getIncrementalKey(targetTable: string): string | null {
   *   // Most tables use the updated timestamp
   *   return 'RemoteUpdatedAt';
   *
   *   // Or return null for tables that don't support incremental sync
   *   // return null;
   * }
   * ```
   */
  abstract getIncrementalKey(
    targetTable: TARGET_TABLES | string,
  ): string | null;

  /**
   * Returns a list of namespaces supported by this integration.
   * Used for multi-tenant scenarios where data from multiple accounts/orgs needs to be synced.
   *
   * @returns Array of namespace identifiers. Empty array if namespaces are not supported.
   *
   * @example
   * ```typescript
   * getNamespaces(): string[] {
   *   return ['org-123', 'org-456', 'org-789'];
   * }
   * ```
   */
  getNamespaces(): string[] {
    return [];
  }

  /**
   * Fetches available options for a configuration field.
   * Used to populate dropdowns and selection fields in the UI.
   *
   * @param _auth - The authenticated integration instance
   * @param _key - The configuration field key to fetch options for
   * @returns Array of label-value pairs for the dropdown options
   *
   * @example
   * ```typescript
   * async fetchOptions(auth: AuthIntegration<any, any>, key: string) {
   *   if (key === 'pipeline') {
   *     return auth.use(async (client) => {
   *       const pipelines = await client.getPipelines();
   *       return pipelines.map(p => ({
   *         label: p.name,
   *         value: p.id
   *       }));
   *     });
   *   }
   *   return [];
   * }
   * ```
   */
  async fetchOptions(
    _auth: AuthIntegration<any, any>,
    _key: string,
  ): Promise<{
    label: string;
    value: string;
  }[] > {
  return [];
}
}

/**
 * Generic type for any record with primitive values.
 */
export type AnyRecordType = Record<string, string | number | boolean | null>;

/**
 * Configuration for custom system fields in a sync table.
 * Defines which fields serve special purposes in the sync process.
 */
export interface CustomSystemFieldsPayload {
  /**
   * Array of field names that together form the primary key.
   * Used to uniquely identify records.
   */
  primaryKey: string[];

  /**
   * Field name that stores the creation timestamp.
   * Optional - if not provided, creation time tracking is disabled.
   */
  createdAt?: string;

  /**
   * Field name that stores the last update timestamp.
   * Optional - if not provided, update time tracking is disabled.
   */
  updatedAt?: string;
}

/**
 * Abstract data types supported by sync columns.
 * Used for type mapping between external systems and NocoDB.
 */
export type SyncAbstractType =
  | 'string'    // Text values
  | 'number'    // Integer values
  | 'decimal'   // Floating point values
  | 'boolean'   // True/false values
  | 'date'      // Date only (no time)
  | 'datetime'; // Date and time

/**
 * Defines a single column in a sync table.
 * Specifies how data from the external source maps to a NocoDB column.
 */
export interface SyncColumnDefinition {
  /** Display name for the column */
  title: string;

  /** NocoDB UI type for the column (e.g., SingleLineText, Number, DateTime) */
  uidt: UITypes;

  /**
   * Database column name. If not provided, generated from title.
   * Use this to ensure consistent column naming across syncs.
   */
  column_name?: string;

  /**
   * Column-specific options (e.g., for SingleSelect/MultiSelect).
   * Defines available dropdown options.
   */
  colOptions?: {
    options: { title: string }[];
  };

  /**
   * Whether this column is the primary value (display value) for the table.
   * Only one column per table should have this set to true.
   */
  pv?: boolean;

  /**
   * Additional metadata for the column.
   */
  meta?: {
    /** Whether to enable rich text mode for LongText fields */
    richMode?: boolean;
  };

  /**
   * Abstract data type for custom sync integrations.
   * Used when uidt is not sufficient for type mapping.
   */
  abstractType?: SyncAbstractType;

  /**
   * Whether to exclude this column from the sync.
   * Useful for computed or internal fields that shouldn't be synced.
   */
  exclude?: boolean;
}

/**
 * Defines a relationship between two tables in the sync schema.
 */
export interface SyncRelation {
  /** The column name that represents this relationship in the source table */
  columnTitle: string;

  /** The target table this relationship points to */
  relatedTable: TARGET_TABLES;

  /** The column in the related table that this relationship links to (usually the primary key) */
  relatedTableColumnTitle: string;
}

/**
 * Complete definition of a table to be synced.
 * Includes columns, relationships, and system field configuration.
 */
export interface SyncTable {
  /** Display name for the table */
  title: string;

  /** Array of column definitions for this table */
  columns: SyncColumnDefinition[];

  /** Array of relationships to other tables */
  relations: SyncRelation[];

  /**
   * Optional system field configuration.
   * Defines primary key and timestamp fields for custom sync tables.
   */
  systemFields?: CustomSystemFieldsPayload;
}

/**
 * Schema definition for standard sync tables.
 * Maps TARGET_TABLES enum values to their table definitions.
 * Partial because not all standard tables need to be defined.
 */
export type SyncSchema = Partial<Record<TARGET_TABLES, SyncTable>>;

/**
 * Schema definition for custom sync tables.
 * Maps custom table names (strings) to their table definitions.
 * Used when syncing data that doesn't fit the standard TARGET_TABLES.
 */
export type CustomSyncSchema = Record<string, SyncTable>;

/**
 * Payload for custom sync operations.
 * Can include any custom fields plus an optional schema definition.
 */
export interface CustomSyncPayload {
  [key: string]: any;

  /**
   * Optional custom schema definition.
   * If provided, defines the structure of custom tables to be created.
   */
  custom_schema?: CustomSyncSchema;
}

/**
 * Wrapper type for sync values that may be null.
 * All synced values can be null to represent missing or deleted data.
 *
 * @template T - The underlying value type
 */
export type SyncValue<T> = T | null;

/**
 * Type for relationship link values.
 * An array of record IDs or null if no links exist.
 */
export type SyncLinkValue = string[] | null;

/**
 * Standard record format for synced data.
 * All sync integrations must transform their data into this format.
 *
 * Contains system fields that track the sync state and metadata,
 * plus the raw data from the external source for reference.
 */
export interface SyncRecord {
  /** Timestamp when the record was created in the external system */
  RemoteCreatedAt?: SyncValue<string>;

  /** Timestamp when the record was last updated in the external system */
  RemoteUpdatedAt?: SyncValue<string>;

  /** Timestamp when the record was deleted in the external system */
  RemoteDeletedAt?: SyncValue<string>;

  /** Whether the record has been deleted in the external system */
  RemoteDeleted?: SyncValue<boolean>;

  /**
   * Complete raw data from the external system (typically JSON stringified).
   * Stored for reference and debugging purposes.
   */
  RemoteRaw: SyncValue<string>;

  /** Timestamp when this record was last synced to NocoDB */
  RemoteSyncedAt?: SyncValue<string>;

  /** Namespace identifier for multi-tenant scenarios */
  RemoteNamespace?: SyncValue<string>;
}

/**
 * Extended sync record format for custom sync integrations.
 * Includes all standard SyncRecord fields plus any additional custom fields.
 *
 * Custom fields should follow the naming convention and use SyncValue wrapper
 * to support null values.
 *
 * @example
 * ```typescript
 * interface MyCustomRecord extends CustomSyncRecord {
 *   FirstName: SyncValue<string>;
 *   LastName: SyncValue<string>;
 *   Age: SyncValue<number>;
 *   IsActive: SyncValue<boolean>;
 * }
 * ```
 */
export interface CustomSyncRecord extends SyncRecord {
  [key: string]: SyncValue<string | number | boolean | undefined | null>;
}