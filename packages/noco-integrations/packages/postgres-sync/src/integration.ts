import {
  DataObjectStream,
  detectUpdatedAtColumn,
  SyncIntegration,
  UITypes,
} from '@noco-integrations/core';
import type {
  CustomSyncPayload,
  CustomSyncRecord,
  CustomSyncSchema,
  SyncAbstractType,
  TARGET_TABLES,
} from '@noco-integrations/core';
import type { PostgresAuthIntegration } from '@noco-integrations/postgres-auth';

class PostgresSyncIntegration extends SyncIntegration<CustomSyncPayload> {
  public async getDestinationSchema(
    auth: PostgresAuthIntegration,
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
    const schema: CustomSyncSchema = {};

    for (const table of this.config.tables) {
      const columns: {
        title: string;
        uidt: UITypes;
        abstractType: SyncAbstractType;
      }[] = [];

      const tableSchema = await auth.use(async (knex) => {
        return knex
          .select('a.attname as column_name', 't.typname as data_type')
          .from('pg_attribute as a')
          .join('pg_class as c', 'a.attrelid', 'c.oid')
          .join('pg_namespace as n', 'c.relnamespace', 'n.oid')
          .join('pg_type as t', 'a.atttypid', 't.oid')
          .where({
            'c.relname': table,
            'n.nspname': this.config.schema,
          })
          .andWhere('a.attnum', '>', 0) // exclude system columns
          .andWhere('a.attisdropped', false); // exclude dropped columns
      });

      for (const column of tableSchema) {
        const { uidt, abstractType } = this.autoDetectType(column.data_type);

        columns.push({
          title: column.column_name,
          uidt,
          abstractType,
        });
      }

      const primaryKeys = await auth.use(async (knex) => {
        return knex
          .select('kcu.column_name')
          .from('information_schema.key_column_usage as kcu')
          .join('information_schema.table_constraints as tc', function () {
            // Scope the join by schema too — PK constraint names are only
            // unique per schema (`<table>_pkey`), so joining on
            // constraint_name + table_name alone cross-matches every schema
            // that has a same-named table, duplicating and cross-contaminating
            // the PK columns (and producing an ORDER BY on a column that
            // doesn't exist in this schema).
            this.on('kcu.constraint_name', '=', 'tc.constraint_name')
              .andOn('kcu.constraint_schema', '=', 'tc.constraint_schema')
              .andOn('kcu.table_name', '=', 'tc.table_name');
          })
          .where({
            'kcu.table_schema': this.config.schema,
            'kcu.table_name': table,
            'tc.table_schema': this.config.schema,
            'tc.constraint_type': 'PRIMARY KEY',
          })
          // Stable column order for composite PKs (drives fetch pagination).
          .orderBy('kcu.ordinal_position', 'asc');
      });

      schema[table] = {
        title: table,
        columns,
        relations: [],
        systemFields: {
          primaryKey: primaryKeys.map((pk) => pk.column_name),
          updatedAt: detectUpdatedAtColumn(columns),
        },
      };
    }

    return schema;
  }

  public async fetchData(
    auth: PostgresAuthIntegration,
    args: {
      targetTables?: (TARGET_TABLES | string)[];
      targetTableIncrementalValues?: Record<
        TARGET_TABLES | string,
        string | number
      >;
    },
  ): Promise<DataObjectStream<CustomSyncRecord>> {
    const stream = new DataObjectStream<CustomSyncRecord>();

    void (async () => {
      try {
        // Ensure we have schema information
        let schema =
          this.config.custom_schema || (await this.getDestinationSchema(auth));
        let reIntrospected = false;

        // Get tables to sync
        const targetTables = args.targetTables || [];
        const incrementalValues = args.targetTableIncrementalValues || {};

        // Process each table
        for (const tableName of targetTables) {
          let tableSchema = schema[tableName as string];

          if (!tableSchema && !reIntrospected) {
            // The persisted schema can lag behind the sync mappings (e.g. a
            // destination table restored from trash is re-added to
            // `config.tables` but not to the stored `custom_schema`) —
            // re-introspect once before giving up on the table.
            schema = await this.getDestinationSchema(auth);
            reIntrospected = true;
            // generateRecordId/formatData/getIncrementalKey read
            // `this.config.custom_schema` — refresh the wrapper's config
            // in-memory (this run only, never persisted) so the
            // re-introspected tables resolve there too.
            this._config = { ...this._config, custom_schema: schema };
            tableSchema = schema[tableName as string];
          }

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
            const rows = await auth.use(async (knex) => {
              let query = knex
                .select(columnNames)
                .from(`${this.config.schema}.${tableName}`)
                .limit(pageSize)
                .offset(offset);

              // Apply incremental filter if available
              const incrementalKey = this.getIncrementalKey(
                tableName as string,
              );
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
              return query;
            });

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
        const updatedAtColumn = tableSchema.columns?.find(
          (column) => column.title === systemFields.updatedAt,
        );

        // An excluded column has no destination counterpart to read the cursor from
        if (updatedAtColumn && !updatedAtColumn.exclude) {
          return systemFields.updatedAt;
        }
      }
    }

    return null;
  }

  public async fetchOptions(auth: PostgresAuthIntegration, key: string) {
    if (key === 'schemas') {
      const schemas = await auth.use(async (knex) => {
        return knex.select('schema_name').from('information_schema.schemata');
      });

      return schemas.map((schema: { schema_name: string }) => ({
        label: schema.schema_name,
        value: schema.schema_name,
      }));
    }

    if (key === 'tables') {
      const tables = await auth.use(async (knex) => {
        return knex
          .select('table_name')
          .from('information_schema.tables')
          .where({ table_schema: this.config.schema })
          .andWhere('table_type', 'BASE TABLE');
      });

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
    // `pg_type.typname` is matched here (e.g. `int4`, `bool`, `timestamptz`),
    // not the friendly SQL name — keep the cases in terms of typnames.
    const t = (type || '').toLowerCase();

    switch (t) {
      case 'int2':
      case 'int4':
      case 'int8':
      case 'smallint':
      case 'integer':
      case 'bigint':
      case 'serial':
      case 'smallserial':
      case 'bigserial':
        return { uidt: UITypes.Number, abstractType: 'number' };

      case 'numeric':
      case 'decimal':
      case 'float4':
      case 'float8':
      case 'real':
      case 'double precision':
      case 'money':
        return { uidt: UITypes.Decimal, abstractType: 'decimal' };

      case 'bool':
      case 'boolean':
        return { uidt: UITypes.Checkbox, abstractType: 'boolean' };

      case 'json':
      case 'jsonb':
        return { uidt: UITypes.JSON, abstractType: 'json' };

      case 'date':
        return { uidt: UITypes.Date, abstractType: 'date' };

      case 'timestamp':
      case 'timestamptz':
        return { uidt: UITypes.DateTime, abstractType: 'datetime' };

      case 'time':
      case 'timetz':
        return { uidt: UITypes.Time, abstractType: 'time' };

      case 'text':
        return { uidt: UITypes.LongText, abstractType: 'string' };
    }

    // Fallbacks for aliased / length-qualified names some drivers report.
    if (t.includes('timestamp')) {
      return { uidt: UITypes.DateTime, abstractType: 'datetime' };
    }
    if (t.startsWith('int') || t === 'serial') {
      return { uidt: UITypes.Number, abstractType: 'number' };
    }
    if (
      t.includes('numeric') ||
      t.includes('decimal') ||
      t.includes('double') ||
      t.includes('float')
    ) {
      return { uidt: UITypes.Decimal, abstractType: 'decimal' };
    }

    // varchar, bpchar, char, name, uuid, bytea, etc.
    return { uidt: UITypes.SingleLineText, abstractType: 'string' };
  }
}

export default PostgresSyncIntegration;
