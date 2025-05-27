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

class PostgresSyncIntegration extends SyncIntegration<CustomSyncPayload> {
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

      const tableSchema = await knex
        .select('*')
        .from('information_schema.columns')
        .where({ table_name: table });

      for (const column of tableSchema) {
        const { uidt, abstractType } = this.autoDetectType(column.data_type);

        columns.push({
          title: column.column_name,
          uidt,
          abstractType,
        });
      }

      const primaryKeys = await knex
        .select('kcu.column_name')
        .from('information_schema.key_column_usage as kcu')
        .join('information_schema.table_constraints as tc', function () {
          this.on('kcu.constraint_name', '=', 'tc.constraint_name').andOn(
            'kcu.table_name',
            '=',
            'tc.table_name',
          );
        })
        .where({
          'kcu.table_name': table,
          'tc.constraint_type': 'PRIMARY KEY',
        });

      schema[table] = {
        title: table,
        columns,
        relations: [],
        systemFields: {
          primaryKey: primaryKeys.map((pk) => pk.column_name),
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
              .from(`${this.config.schema}.${tableName}`)
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
                `[PostgreSQL Sync] Processed ${offset} records from table ${tableName}`,
              );
            }
          }

          this.log(
            `[PostgreSQL Sync] Completed syncing table ${tableName}, total records processed: ${offset}`,
          );
        }
      } catch (error) {
        console.error('Error fetching data from PostgreSQL:', error);
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
   * Format data from PostgreSQL to NocoDB format
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

    if (key === 'schemas') {
      const qb = knex.select('schema_name').from('information_schema.schemata');

      const schemas = await qb;

      return schemas.map((schema: { schema_name: string }) => ({
        label: schema.schema_name,
        value: schema.schema_name,
      }));
    }

    if (key === 'tables') {
      const qb = knex
        .select('table_name')
        .from('information_schema.tables')
        .where({ table_schema: this.config.schema });

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

      if (type.includes('int')) {
        return { uidt: UITypes.Number, abstractType: 'number' };
      }

      if (type === 'text') {
        return { uidt: UITypes.LongText, abstractType: 'string' };
      }

      if (type === 'boolean') {
        return { uidt: UITypes.Checkbox, abstractType: 'boolean' };
      }

      if (type === 'date') {
        return { uidt: UITypes.Date, abstractType: 'date' };
      }

      if (type.includes('timestamp')) {
        return { uidt: UITypes.DateTime, abstractType: 'datetime' };
      }

      if (
        type.includes('decimal') ||
        type.includes('numeric') ||
        type.includes('real') ||
        type.includes('double precision') ||
        type.includes('float')
      ) {
        return { uidt: UITypes.Decimal, abstractType: 'decimal' };
      }
    }

    return { uidt: UITypes.SingleLineText, abstractType: 'string' };
  }
}

export default PostgresSyncIntegration;
