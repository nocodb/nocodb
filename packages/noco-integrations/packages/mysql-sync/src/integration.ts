import {
  DataObjectStream,
  SyncIntegration,
  UITypes,
} from '@noco-integrations/core';
import type { Knex } from 'knex';
import type {
  AuthResponse,
  CustomSyncPayload,
  CustomSyncRecord,
  CustomSyncSchema,
  SyncAbstractType,
  TARGET_TABLES,
} from '@noco-integrations/core';

class MySQLSyncIntegration extends SyncIntegration<CustomSyncPayload> {
  public async getDestinationSchema(
    auth: AuthResponse<Knex>,
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

    const knex = auth;

    const schema: CustomSyncSchema = {};

    for (const table of this.config.tables) {
      const columns: {
        title: string;
        uidt: UITypes;
        abstractType: SyncAbstractType;
      }[] = [];

      // MySQL uses INFORMATION_SCHEMA.COLUMNS
      const tableSchema = await knex
        .select('*')
        .from('information_schema.columns')
        .where({
          table_name: table,
          table_schema: this.config.database,
        });

      for (const column of tableSchema) {
        const { uidt, abstractType } = this.autoDetectType(column.DATA_TYPE);

        columns.push({
          title: column.COLUMN_NAME,
          uidt,
          abstractType,
        });
      }

      // Get primary keys for MySQL
      const primaryKeys = await knex
        .select('COLUMN_NAME')
        .from('information_schema.key_column_usage')
        .where({
          TABLE_NAME: table,
          TABLE_SCHEMA: this.config.database,
          CONSTRAINT_NAME: 'PRIMARY',
        });

      schema[table] = {
        title: table,
        columns,
        relations: [],
        systemFields: {
          primaryKey: primaryKeys.map((pk) => pk.COLUMN_NAME),
        },
      };
    }

    return schema;
  }

  public async fetchData(
    auth: AuthResponse<Knex>,
    args: {
      targetTables?: (TARGET_TABLES | string)[];
      targetTableIncrementalValues?: Record<
        TARGET_TABLES | string,
        string | number
      >;
    },
  ): Promise<DataObjectStream<CustomSyncRecord>> {
    const knex = auth;
    const stream = new DataObjectStream<CustomSyncRecord>();

    (async () => {
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

          // Pagination settings
          const pageSize = 100;
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            // Build query with pagination
            let query = knex
              .select(columnNames)
              .from(`${this.config.database}.${tableName}`)
              .limit(pageSize)
              .offset(offset);

            // Apply incremental filter if available
            const incrementalKey = this.getIncrementalKey(tableName as string);
            const incrementalValue = incrementalValues[tableName];

            if (incrementalKey && incrementalValue) {
              query = query.where(incrementalKey, '>', incrementalValue);
            }

            // Add ordering to ensure consistent pagination
            const primaryKeys = tableSchema.systemFields?.primaryKey;
            if (primaryKeys && primaryKeys.length > 0) {
              // Order by primary key(s) for consistent pagination
              primaryKeys.forEach((pk) => {
                query = query.orderBy(pk, 'asc');
              });
            } else {
              // Fallback: order by first column if no primary key
              if (columnNames.length > 0) {
                query = query.orderBy(columnNames[0], 'asc');
              }
            }

            // Execute query
            const rows = await query;

            // Process rows
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

            // Check if we have more data
            hasMore = rows.length === pageSize;
            offset += pageSize;

            // Log progress for large tables
            if (offset % 1000 === 0) {
              this.log(
                `[MySQL Sync] Processed ${offset} records from table ${tableName}`,
              );
            }
          }

          this.log(
            `[MySQL Sync] Completed syncing table ${tableName}, total records processed: ${offset}`,
          );
        }
      } catch (error) {
        console.error('Error fetching data from MySQL:', error);
        stream.emit('error', error);
      } finally {
        stream.push(null); // End the stream
      }
    })();

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
   * Format data from MySQL to NocoDB format
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
        if (systemFields.createdAt && data[systemFields.createdAt]) {
          formattedData.RemoteCreatedAt = data[systemFields.createdAt];
        }
        if (systemFields.updatedAt && data[systemFields.updatedAt]) {
          formattedData.RemoteUpdatedAt = data[systemFields.updatedAt];
        }
      }

      // map the columns to the SyncRecord fields
      for (const column of tableSchema.columns) {
        if (column.exclude) {
          continue;
        }

        formattedData[column.title] = data[column.title];
      }
    }

    return {
      data: formattedData,
    };
  }

  public getIncrementalKey(targetTable: TARGET_TABLES | string): string | null {
    const schema = this.config.custom_schema;
    // If the schema has a specific incremental key for this table, use it
    if (schema && schema[targetTable]) {
      const tableSchema = schema[targetTable];
      const systemFields = tableSchema.systemFields;

      // If systemFields defines an updatedAt field, use it for incremental sync
      if (systemFields && systemFields.updatedAt) {
        return systemFields.updatedAt;
      }
    }

    return null;
  }

  public async fetchOptions(auth: AuthResponse<Knex>, key: string) {
    const knex = auth;

    if (key === 'databases') {
      const qb = knex
        .select('SCHEMA_NAME as database_name')
        .from('information_schema.schemata')
        .whereNotIn('SCHEMA_NAME', [
          'information_schema',
          'performance_schema',
          'mysql',
          'sys',
        ]);

      const databases = await qb;

      return databases.map((database: { database_name: string }) => ({
        label: database.database_name,
        value: database.database_name,
      }));
    }

    if (key === 'tables') {
      const qb = knex
        .select('TABLE_NAME as table_name')
        .from('information_schema.tables')
        .where({
          TABLE_SCHEMA: this.config.database,
          TABLE_TYPE: 'BASE TABLE',
        });

      const tables = await qb;

      return tables.map((table: { table_name: string }) => ({
        label: table.table_name,
        value: table.table_name,
      }));
    }

    return [];
  }

  private autoDetectType(type: string): {
    uidt: UITypes;
    abstractType: SyncAbstractType;
  } {
    if (type) {
      type = type.toLowerCase();

      // MySQL integer types
      if (
        type.includes('int') ||
        type === 'bigint' ||
        type === 'smallint' ||
        type === 'tinyint' ||
        type === 'mediumint'
      ) {
        return { uidt: UITypes.Number, abstractType: 'number' };
      }

      // MySQL text types
      if (type === 'text' || type === 'longtext' || type === 'mediumtext') {
        return { uidt: UITypes.LongText, abstractType: 'string' };
      }

      // MySQL string types
      if (
        type.includes('varchar') ||
        type.includes('char') ||
        type === 'tinytext'
      ) {
        return { uidt: UITypes.SingleLineText, abstractType: 'string' };
      }

      // MySQL boolean types
      if (type === 'boolean' || type === 'bool' || type === 'tinyint(1)') {
        return { uidt: UITypes.Checkbox, abstractType: 'boolean' };
      }

      // MySQL decimal/numeric types
      if (
        type.includes('decimal') ||
        type.includes('numeric') ||
        type.includes('float') ||
        type.includes('double')
      ) {
        return { uidt: UITypes.Decimal, abstractType: 'decimal' };
      }
    }

    return { uidt: UITypes.SingleLineText, abstractType: 'string' };
  }
}

export default MySQLSyncIntegration;
