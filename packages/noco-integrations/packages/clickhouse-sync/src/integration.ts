import {
  DataObjectStream,
  SyncIntegration,
  UITypes,
} from '@noco-integrations/core';
import type { ClickHouseClient } from '@clickhouse/client';
import type {
  AuthResponse,
  CustomSyncPayload,
  CustomSyncRecord,
  CustomSyncSchema,
  SyncAbstractType,
  TARGET_TABLES,
} from '@noco-integrations/core';

class ClickHouseSyncIntegration extends SyncIntegration<CustomSyncPayload> {
  public async getDestinationSchema(
    auth: AuthResponse<ClickHouseClient>,
  ): Promise<CustomSyncSchema> {
    if (
      this.config.custom_schema &&
      this.config.tables &&
      this.config.tables.length ===
        Object.keys(this.config.custom_schema).length &&
      Object.keys(this.config.custom_schema).every((table) =>
        this.config.tables.includes(table),
      )
    ) {
      return this.config.custom_schema;
    }

    const client = auth;

    const schema: CustomSyncSchema = {};

    for (const table of this.config.tables) {
      const columns: {
        title: string;
        uidt: UITypes;
        abstractType: SyncAbstractType;
      }[] = [];

      // Query ClickHouse system.columns for table schema
      const tableSchemaQuery = `
        SELECT 
          name as column_name,
          type as data_type,
          position
        FROM system.columns 
        WHERE database = '${this.config.database}' 
        AND table = '${table}'
        ORDER BY position
      `;

      const result = await client.query({
        query: tableSchemaQuery,
        format: 'JSONEachRow',
      });

      const tableSchema = await result.json() as Array<{
        column_name: string;
        data_type: string;
        position: number;
      }>;

      for (const column of tableSchema) {
        const { uidt, abstractType } = this.autoDetectType(column.data_type);

        columns.push({
          title: column.column_name,
          uidt,
          abstractType,
        });
      }

      // Get primary key information from system.tables
      const primaryKeyQuery = `
        SELECT primary_key
        FROM system.tables 
        WHERE database = '${this.config.database}' 
        AND name = '${table}'
      `;

      const pkResult = await client.query({
        query: primaryKeyQuery,
        format: 'JSONEachRow',
      });

      const primaryKeyData = await pkResult.json() as Array<{
        primary_key: string;
      }>;

      // Parse primary key - ClickHouse stores it as a string like "id" or "id, name"
      const primaryKeys = primaryKeyData.length > 0 && primaryKeyData[0].primary_key
        ? primaryKeyData[0].primary_key.split(',').map(key => key.trim())
        : [];

      schema[table] = {
        title: table,
        columns,
        relations: [],
        systemFields: {
          primaryKey: primaryKeys,
        },
      };
    }

    return schema;
  }

  public async fetchData(
    auth: AuthResponse<ClickHouseClient>,
    args: {
      targetTables?: (TARGET_TABLES | string)[];
      targetTableIncrementalValues?: Record<
        TARGET_TABLES | string,
        string | number
      >;
    },
  ): Promise<DataObjectStream<CustomSyncRecord>> {
    const client = auth;
    const stream = new DataObjectStream<CustomSyncRecord>();

    try {
      // Ensure we have schema information
      const schema =
        this.config.custom_schema || (await this.getDestinationSchema(auth));

      // Get tables to sync
      const targetTables = args.targetTables || [];
      const incrementalValues = args.targetTableIncrementalValues || {};

      // Process each table
      for (const tableName of targetTables) {
        const tableSchema = schema[tableName as string];
        if (!tableSchema) {
          console.warn(`Schema not found for table: ${tableName}`);
          continue;
        }

        // Get column information from schema
        const columnNames = tableSchema.columns.map((col) => col.title);

        // Build query
        let query = `SELECT ${columnNames.join(', ')} FROM \`${this.config.database}\`.\`${tableName}\``;

        // Apply incremental filter if available
        const incrementalKey = this.getIncrementalKey(tableName as string);
        const incrementalValue = incrementalValues[tableName];

        if (incrementalKey && incrementalValue) {
          query += ` WHERE \`${incrementalKey}\` > ${incrementalValue}`;
        }

        // Execute query and stream results
        const result = await client.query({
          query,
          format: 'JSONEachRow',
        });

        const rows = await result.json() as Array<any>;

        for (const row of rows) {
          const recordId = this.generateRecordId(tableName as string, row);

          // Format data according to schema
          const { data, links } = this.formatData(tableName as string, row);

          stream.push({
            targetTable: tableName as string,
            recordId,
            data,
            links,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data from ClickHouse:', error);
      stream.emit('error', error);
    } finally {
      stream.push(null); // End the stream
    }

    return stream;
  }

  /**
   * Generate a unique record ID based on primary keys or fallback
   */
  private generateRecordId(tableName: string, row: any): string {
    const primaryKeys =
      this.config.custom_schema?.[tableName]?.systemFields?.primaryKey;

    if (primaryKeys && primaryKeys.length > 0) {
      return primaryKeys
        .sort()
        .map((pk) => `${row[pk]}`)
        .join('_');
    }

    throw new Error('No primary keys found for table: ' + tableName);
  }

  /**
   * Format data from ClickHouse to NocoDB format
   */
  public formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
  ): {
    data: CustomSyncRecord;
    links?: Record<string, string[] | null>;
  } {
    // Format the record with required SyncRecord fields
    const formattedData: CustomSyncRecord = {
      // Avoid raw data for custom schemas
      RemoteRaw: null,
    };

    const tableSchema = this.config.custom_schema?.[targetTable];

    // Use schema to determine date fields if available
    if (tableSchema) {
      // If the table has system fields defined, use them
      const systemFields = tableSchema.systemFields;
      if (systemFields) {
        // Add any system field mappings as needed
        // This is similar to the postgres implementation but adapted for ClickHouse
      }

      // Convert specific ClickHouse types if needed
      for (const [key, value] of Object.entries(data)) {
        const column = tableSchema.columns.find(col => col.title === key);
        if (column) {
          // Handle date/datetime conversions for ClickHouse
          if (column.abstractType === 'date' || column.abstractType === 'datetime') {
            formattedData[key] = value as string | null;
          } else {
            formattedData[key] = value as string | number | boolean | null;
          }
        }
      }
    }

    return {
      data: formattedData,
    };
  }

  /**
   * Get the incremental key for a table (used for incremental syncing)
   */
  public getIncrementalKey(targetTable: TARGET_TABLES | string): string | null {
    const tableSchema = this.config.custom_schema?.[targetTable];
    if (!tableSchema) return null;

    // Look for common incremental field patterns
    const incrementalCandidates = ['updated_at', 'created_at', 'timestamp', 'id'];
    
    for (const candidate of incrementalCandidates) {
      const column = tableSchema.columns.find(col => col.title === candidate);
      if (column && (column.abstractType === 'datetime' || column.abstractType === 'number')) {
        return candidate;
      }
    }

    return null;
  }

  public async fetchOptions(auth: AuthResponse<ClickHouseClient>, key: string) {
    const client = auth;

    switch (key) {
      case 'databases': {
        // Get list of databases
        const dbResult = await client.query({
          query: 'SHOW DATABASES',
          format: 'JSONEachRow',
        });
        
        const databases = await dbResult.json() as Array<{ name: string }>;
        
        return databases
          .filter(db => !['system', 'information_schema', 'INFORMATION_SCHEMA'].includes(db.name))
          .map(db => ({
            label: db.name,
            value: db.name,
          }));
      }

      case 'tables': {
        if (!this.config.database) {
          return [];
        }

        // Get list of tables in the selected database
        const tablesResult = await client.query({
          query: `SHOW TABLES FROM \`${this.config.database}\``,
          format: 'JSONEachRow',
        });
        
        const tables = await tablesResult.json() as Array<{ name: string }>;
        
        return tables.map(table => ({
          label: table.name,
          value: table.name,
        }));
      }

      default:
        return [];
    }
  }

  private autoDetectType(type: string): {
    uidt: UITypes;
    abstractType: SyncAbstractType;
  } {
    const normalizedType = type.toLowerCase();

    // Handle array types
    if (normalizedType.startsWith('array(')) {
      return {
        uidt: UITypes.JSON,
        abstractType: 'json' as SyncAbstractType,
      };
    }

    // Handle nullable types
    const baseType = normalizedType.replace(/nullable\(([^)]+)\)/, '$1');

    // Integer types
    if (baseType.match(/^(u?int\d+|tinyint|smallint|mediumint|bigint)$/)) {
      return {
        uidt: UITypes.Number,
        abstractType: 'number' as SyncAbstractType,
      };
    }

    // Float types
    if (baseType.match(/^(float\d*|double|decimal(\(\d+,\s*\d+\))?)$/)) {
      return {
        uidt: UITypes.Decimal,
        abstractType: 'number' as SyncAbstractType,
      };
    }

    // String types
    if (baseType.match(/^(string|fixedstring(\(\d+\))?|varchar(\(\d+\))?|char(\(\d+\))?)$/)) {
      return {
        uidt: UITypes.SingleLineText,
        abstractType: 'string' as SyncAbstractType,
      };
    }

    // Date types
    if (baseType === 'date' || baseType === 'date32') {
      return {
        uidt: UITypes.Date,
        abstractType: 'date' as SyncAbstractType,
      };
    }

    // DateTime types
    if (baseType.match(/^datetime(\d+)?(\([^)]*\))?$/)) {
      return {
        uidt: UITypes.DateTime,
        abstractType: 'datetime' as SyncAbstractType,
      };
    }

    // Boolean
    if (baseType === 'bool' || baseType === 'boolean') {
      return {
        uidt: UITypes.Checkbox,
        abstractType: 'boolean' as SyncAbstractType,
      };
    }

    // UUID
    if (baseType === 'uuid') {
      return {
        uidt: UITypes.SingleLineText,
        abstractType: 'string' as SyncAbstractType,
      };
    }

    // JSON
    if (baseType === 'json') {
      return {
        uidt: UITypes.JSON,
        abstractType: 'json' as SyncAbstractType,
      };
    }

    // IP types
    if (baseType === 'ipv4' || baseType === 'ipv6') {
      return {
        uidt: UITypes.SingleLineText,
        abstractType: 'string' as SyncAbstractType,
      };
    }

    // Default fallback
    return {
      uidt: UITypes.SingleLineText,
      abstractType: 'string' as SyncAbstractType,
    };
  }
}

export default ClickHouseSyncIntegration; 