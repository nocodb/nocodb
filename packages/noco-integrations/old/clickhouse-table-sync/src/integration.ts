import { UITypes } from 'nocodb-sdk';
import { DataObjectStream, SyncIntegration } from '@noco-integrations/core';
import type {
  AnyRecordType,
  AuthResponse,
  SyncColumnDefinition,
  CustomSystemFieldsPayload,
} from '@noco-integrations/core';
import type { ClickHouseClient } from '@clickhouse/client';

export class ClickhouseTableIntegration extends SyncIntegration {
  public async getDestinationSchema(
    auth: AuthResponse<ClickHouseClient>,
    payload: {
      table: string;
      system: CustomSystemFieldsPayload;
    },
  ): Promise<readonly SyncColumnDefinition[]> {
    const clickhouse = auth.custom;

    if (!clickhouse) {
      throw new Error('Clickhouse client not found in auth response');
    }

    const rows = await clickhouse.query({
      query: `SELECT * FROM ${payload.table} LIMIT 1`,
      format: 'JSONEachRow',
    });

    const res = (await rows.json()) as Array<Record<string, unknown>>;

    if (!res.length) {
      return [];
    }

    const firstRow = res[0];

    const schema = Object.keys(firstRow).map((key) => {
      return {
        title: key,
        uidt: UITypes.SingleLineText,
      };
    });

    return schema as SyncColumnDefinition[];
  }

  public async fetchData(
    auth: AuthResponse<ClickHouseClient>,
    payload: {
      table: string;
      system: CustomSystemFieldsPayload;
    },
    _options?: unknown,
  ): Promise<DataObjectStream<AnyRecordType>> {
    const clickhouse = auth.custom;

    if (!clickhouse) {
      throw new Error('Clickhouse client not found in auth response');
    }

    const { table, system } = payload;

    const primaryKey = system.primaryKey;

    const stream = new DataObjectStream<AnyRecordType>();

    (async () => {
      try {
        let offset = 0;
        const limit = 1000;

         
        while (true) {
          const rows = await clickhouse.query({
            query: `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`,
            format: 'JSONEachRow',
          });

          const res = (await rows.json()) as Record<string, unknown>[];

          for (const row of res) {
            const data = row as Record<string, unknown>;

            const pk = this.extractPrimaryKey(data, primaryKey);

            if (pk === undefined || pk === null) {
              continue;
            }

            stream.push({
              recordId: pk,
              data: {
                ...data,
                ...(system.createdAt
                  ? { RemoteCreatedAt: data[system.createdAt] as string }
                  : {}),
                ...(system.updatedAt
                  ? { RemoteUpdatedAt: data[system.updatedAt] as string }
                  : {}),
                RemoteRaw: JSON.stringify(row),
              },
            });
          }

          if (res.length < limit) {
            break;
          }

          offset += limit;
        }

        stream.push(null);
      } catch (error) {
        stream.destroy(error as Error);
      }
    })();

    return stream;
  }

  public getIncrementalKey(): string {
    return 'RemoteUpdatedAt';
  }

  // Helper function for extracting primary key
  private extractPrimaryKey(
    data: Record<string, unknown>,
    primaryKeys: string[],
  ): string {
    if (!primaryKeys || primaryKeys.length === 0) {
      return '';
    }

    return primaryKeys.map((key) => String(data[key] || '')).join('_');
  }
}
