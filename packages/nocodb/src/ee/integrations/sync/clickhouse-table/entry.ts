import type { ClickHouseClient } from '@clickhouse/client';
import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type {
  AnyRecordType,
  SyncColumnDefinition,
} from '~/integrations/sync/sync.schemas';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';

export default class ClickhouseTableIntegration extends SyncIntegration {
  public async getDestinationSchema(
    auth: AuthResponse<ClickHouseClient>,
    payload: {
      table: string;
      primaryKey: string;
    },
  ) {
    /*
      {
        title: 'Assignees',
        uidt: UITypes.SingleLineText,
      },
    */
    const clickhouse = auth.custom;

    // select 1 from <table> limit 1

    const rows = await clickhouse.query({
      query: `SELECT * FROM ${payload.table} LIMIT 1`,
      format: 'JSONEachRow',
    });

    const res = await rows.json();

    const firstRow = res[0];

    const schema = Object.keys(firstRow).map((key) => {
      return {
        title: key,
        uidt: 'SingleLineText',
      };
    });

    return schema as SyncColumnDefinition[];
  }

  public async fetchData(
    auth: AuthResponse<ClickHouseClient>,
    payload: {
      table: string;
      primaryKey: string;
    },
    _options?: unknown,
  ): Promise<DataObjectStream<AnyRecordType>> {
    const clickhouse = auth.custom;

    const { table, primaryKey } = payload;

    const stream = new DataObjectStream<AnyRecordType>();

    (async () => {
      try {
        let offset = 0;
        const limit = 1000;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const rows = await clickhouse.query({
            query: `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`,
            format: 'JSONEachRow',
          });

          const res = await rows.json();

          for (const row of res) {
            const data = row as Record<string, unknown>;

            if (data[primaryKey] === undefined || data[primaryKey] === null) {
              continue;
            }

            stream.push({
              recordId: data[primaryKey].toString(),
              data: {
                ...data,
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
        stream.destroy(error);
      }
    })();

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt';
  }
}
