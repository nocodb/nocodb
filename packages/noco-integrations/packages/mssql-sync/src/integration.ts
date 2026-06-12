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
import type { MssqlAuthIntegration } from '@noco-integrations/mssql-auth';

class MssqlSyncIntegration extends SyncIntegration<CustomSyncPayload> {
  public async getDestinationSchema(
    auth: MssqlAuthIntegration,
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

      // SQL Server uses INFORMATION_SCHEMA.COLUMNS
      const tableSchema = await auth.use(async (knex) => {
        return knex
          .select('COLUMN_NAME', 'DATA_TYPE')
          .from('INFORMATION_SCHEMA.COLUMNS')
          .where({
            TABLE_NAME: table,
            TABLE_SCHEMA: this.config.schema,
          });
      });

      for (const column of tableSchema) {
        const { uidt, abstractType } = this.autoDetectType(column.DATA_TYPE);

        columns.push({
          title: column.COLUMN_NAME,
          uidt,
          abstractType,
        });
      }

      // Get primary keys. SQL Server PK constraint names are arbitrary, so join
      // KEY_COLUMN_USAGE to TABLE_CONSTRAINTS and filter on CONSTRAINT_TYPE.
      const primaryKeys = await auth.use(async (knex) => {
        return knex
          .select('kcu.COLUMN_NAME as COLUMN_NAME')
          .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE as kcu')
          .join('INFORMATION_SCHEMA.TABLE_CONSTRAINTS as tc', function () {
            this.on('kcu.CONSTRAINT_NAME', '=', 'tc.CONSTRAINT_NAME')
              .andOn('kcu.TABLE_NAME', '=', 'tc.TABLE_NAME')
              .andOn('kcu.TABLE_SCHEMA', '=', 'tc.TABLE_SCHEMA');
          })
          .where('tc.CONSTRAINT_TYPE', 'PRIMARY KEY')
          .andWhere('kcu.TABLE_NAME', table)
          .andWhere('kcu.TABLE_SCHEMA', this.config.schema);
      });

      schema[table] = {
        title: table,
        columns,
        relations: [],
        systemFields: {
          primaryKey: primaryKeys.map((pk) => pk.COLUMN_NAME),
          updatedAt: detectUpdatedAtColumn(columns),
        },
      };
    }

    return schema;
  }

  public async fetchData(
    auth: MssqlAuthIntegration,
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
        let schema = this.config.custom_schema;
        if (!schema) {
          throw new Error(
            'SQL Server sync is missing its schema mapping (custom_schema). ' +
              'Re-open the sync configuration to map the source schema before syncing.',
          );
        }
        let reIntrospected = false;

        const targetTables = args.targetTables || [];
        const incrementalValues = args.targetTableIncrementalValues || {};

        for (const tableName of targetTables) {
          let tableSchema = schema[tableName as string];

          if (!tableSchema && !reIntrospected) {
            schema = await this.getDestinationSchema(auth);
            reIntrospected = true;
            this._config = { ...this._config, custom_schema: schema };
            tableSchema = schema[tableName as string];
          }

          if (!tableSchema) {
            console.warn(`Schema not found for table: ${tableName}`);
            continue;
          }

          const columnNames = tableSchema.columns.map((col) => col.title);

          // Pagination settings
          const pageSize = 100;
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
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

              // SQL Server OFFSET/FETCH requires a deterministic ORDER BY.
              const primaryKeys = tableSchema.systemFields?.primaryKey;
              if (primaryKeys && primaryKeys.length > 0) {
                primaryKeys.forEach((pk) => {
                  query = query.orderBy(pk, 'asc');
                });
              } else if (columnNames.length > 0) {
                query = query.orderBy(columnNames[0], 'asc');
              }

              return query;
            });

            for (const row of rows) {
              const recordId = this.generateRecordId(tableName as string, row);
              const { data, links } = this.formatData(tableName as string, row);

              stream.push({
                targetTable: tableName as string,
                recordId,
                data,
                links,
              });
            }

            hasMore = rows.length === pageSize;
            offset += pageSize;

            if (offset % 1000 === 0) {
              this.log(
                `[SQL Server Sync] Processed ${offset} records from table ${tableName}`,
              );
            }
          }

          this.log(
            `[SQL Server Sync] Completed syncing table ${tableName}, total records processed: ${offset}`,
          );
        }
      } catch (error) {
        console.error('Error fetching data from SQL Server:', error);
        stream.emit('error', error);
      } finally {
        stream.push(null); // End the stream
      }
    })();

    return stream;
  }

  /**
   * Generate a unique record ID based on primary keys.
   */
  private generateRecordId(tableName: string, row: any): string {
    const primaryKeys =
      this.config.custom_schema?.[tableName]?.systemFields?.primaryKey;

    if (!primaryKeys || primaryKeys.length === 0) {
      throw new Error('No primary keys found for table: ' + tableName);
    }

    // Single PK: use the raw value.
    if (primaryKeys.length === 1) {
      return `${row[primaryKeys[0]]}`;
    }

    // Composite PK: mirror NocoDB's own composite-key encoding
    // (extractPkFromPkColumns) — join with `___` and escape `_` inside each
    // value so two distinct tuples can never collapse to the same id
    // (e.g. (`a_b`,`c`) vs (`a`,`b_c`)). Sort a COPY so the id is stable
    // regardless of column order AND so we don't mutate the shared schema
    // array that `fetchData` reuses to build the paginated ORDER BY.
    return [...primaryKeys]
      .sort()
      .map((pk) => `${row[pk]}`.replace(/_/g, '\\_'))
      .join('___');
  }

  /**
   * Format data from SQL Server to NocoDB format.
   */
  public formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
  ): {
    data: CustomSyncRecord;
    links?: Record<string, string[] | null>;
  } {
    const formattedData: CustomSyncRecord = {
      // Avoid raw data for custom schemas
      RemoteRaw: null,
    };

    const tableSchema = this.config.custom_schema?.[targetTable];

    if (tableSchema) {
      const systemFields = tableSchema.systemFields;
      if (systemFields) {
        if (systemFields.createdAt && data[systemFields.createdAt]) {
          formattedData.RemoteCreatedAt = data[systemFields.createdAt];
        }
        if (systemFields.updatedAt && data[systemFields.updatedAt]) {
          formattedData.RemoteUpdatedAt = data[systemFields.updatedAt];
        }
      }

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

    if (schema && schema[targetTable]) {
      const systemFields = schema[targetTable].systemFields;

      if (systemFields && systemFields.updatedAt) {
        const updatedAtColumn = schema[targetTable].columns?.find(
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

  public async fetchOptions(auth: MssqlAuthIntegration, key: string) {
    if (key === 'schemas') {
      const schemas = await auth.use(async (knex) => {
        return knex.select('SCHEMA_NAME').from('INFORMATION_SCHEMA.SCHEMATA');
      });

      return schemas.map((schema: { SCHEMA_NAME: string }) => ({
        label: schema.SCHEMA_NAME,
        value: schema.SCHEMA_NAME,
      }));
    }

    if (key === 'tables') {
      const tables = await auth.use(async (knex) => {
        return (
          knex
            .select('TABLE_NAME')
            .from('INFORMATION_SCHEMA.TABLES')
            .where({ TABLE_SCHEMA: this.config.schema })
            .andWhere('TABLE_TYPE', 'BASE TABLE')
        );
      });

      return tables.map((table: { TABLE_NAME: string }) => ({
        label: table.TABLE_NAME,
        value: table.TABLE_NAME,
      }));
    }

    return [];
  }

  private autoDetectType(type: string): {
    uidt: UITypes;
    abstractType: SyncAbstractType;
  } {
    // `INFORMATION_SCHEMA.COLUMNS.DATA_TYPE` is matched here (e.g. `int`,
    // `nvarchar`, `datetime2`, `bit`).
    const t = (type || '').toLowerCase();

    switch (t) {
      case 'tinyint':
      case 'smallint':
      case 'int':
      case 'bigint':
        return { uidt: UITypes.Number, abstractType: 'number' };

      case 'decimal':
      case 'numeric':
      case 'money':
      case 'smallmoney':
      case 'float':
      case 'real':
        return { uidt: UITypes.Decimal, abstractType: 'decimal' };

      case 'bit':
        return { uidt: UITypes.Checkbox, abstractType: 'boolean' };

      case 'date':
        return { uidt: UITypes.Date, abstractType: 'date' };

      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'datetimeoffset':
        return { uidt: UITypes.DateTime, abstractType: 'datetime' };

      case 'time':
        return { uidt: UITypes.Time, abstractType: 'time' };

      case 'char':
      case 'varchar':
      case 'nchar':
      case 'nvarchar':
      case 'uniqueidentifier':
        return { uidt: UITypes.SingleLineText, abstractType: 'string' };

      case 'text':
      case 'ntext':
      case 'xml':
        return { uidt: UITypes.LongText, abstractType: 'string' };
    }

    // Fallbacks for length-qualified names.
    if (t.includes('int')) {
      return { uidt: UITypes.Number, abstractType: 'number' };
    }
    if (t.includes('char')) {
      return { uidt: UITypes.SingleLineText, abstractType: 'string' };
    }
    if (
      t.includes('numeric') ||
      t.includes('decimal') ||
      t.includes('money') ||
      t.includes('float')
    ) {
      return { uidt: UITypes.Decimal, abstractType: 'decimal' };
    }
    if (t.includes('datetime')) {
      return { uidt: UITypes.DateTime, abstractType: 'datetime' };
    }

    // binary, varbinary, image, geography, etc.
    return { uidt: UITypes.SingleLineText, abstractType: 'string' };
  }
}

export default MssqlSyncIntegration;
