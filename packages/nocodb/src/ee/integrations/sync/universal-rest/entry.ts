import { UITypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { AxiosInstance } from 'axios';
import type { AuthResponse } from '~/integrations/auth/auth.helpers';
import type {
  AnyRecordType,
  SyncColumnDefinition,
  SystemFieldsPayload,
} from '~/integrations/sync/sync.schemas';
import { DataObjectStream } from '~/integrations/sync/sync.helpers';
import SyncIntegration from '~/integrations/sync/sync.interface';

function getValueFromPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? null;
}

function inferSchemaFromRecord(
  record: Record<string, any>,
): SyncColumnDefinition[] {
  return Object.keys(record).map((key) => ({
    title: key,
    uidt: UITypes.SingleLineText,
  }));
}

type PaginationMode =
  | { mode: 'next'; nextPath: string } // Response has a "next" URL
  | { mode: 'offset'; limitParam?: string; offsetParam?: string; limit: number }
  | { mode: 'page'; pageParam?: string; startPage?: number }
  | { mode: 'cursor'; cursorParam: string; cursorPath: string };

type UniversalRestPayload = {
  url: string; // endpoint, relative to baseUrl
  dataPath: string; // path to records array, e.g., "results"
  pagination?: PaginationMode;
  requestParams?: Record<string, any>;
  system: SystemFieldsPayload;
};

export default class UniversalRestIntegration extends SyncIntegration {
  public async getDestinationSchema(
    auth: AuthResponse<AxiosInstance>,
    payload: UniversalRestPayload,
  ) {
    const axios = auth.custom;

    const response = await axios.get(payload.url, {
      params: payload.requestParams,
    });
    const dataArray = getValueFromPath(response.data, payload.dataPath);

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('No records found to infer schema');
    }

    const firstRecord = dataArray[0];
    return inferSchemaFromRecord(firstRecord);
  }

  public async fetchData(
    auth: AuthResponse<AxiosInstance>,
    payload: UniversalRestPayload,
    _options?: unknown,
  ): Promise<DataObjectStream<AnyRecordType>> {
    const axios = auth.custom;
    const { url, system, dataPath, pagination, requestParams = {} } = payload;

    const stream = new DataObjectStream<AnyRecordType>();

    (async () => {
      try {
        let nextUrl = url;
        let offset = 0;
        let page = +(pagination?.mode === 'page'
          ? pagination.startPage ?? 1
          : 1);
        let cursor: string | undefined = undefined;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const params: Record<string, any> = { ...requestParams };

          // Handle pagination param injection
          if (pagination) {
            switch (pagination.mode) {
              case 'offset':
                params[pagination.offsetParam || 'offset'] = offset;
                params[pagination.limitParam || 'limit'] = pagination.limit;
                break;
              case 'page':
                params[pagination.pageParam || 'page'] = page;
                break;
              case 'cursor':
                if (cursor) {
                  params[pagination.cursorParam] = cursor;
                }
                break;
            }
          }

          const response = await axios.get(nextUrl, { params });
          const dataArray = getValueFromPath(response.data, dataPath);

          if (!Array.isArray(dataArray)) {
            throw new Error(`Expected array at path ${dataPath}`);
          }

          for (const record of dataArray) {
            const id = getValueFromPath(record, system.primaryKey);
            if (id !== undefined && id !== null) {
              stream.push({
                recordId: id.toString(),
                data: {
                  ...record,
                  ...(system.createdAt
                    ? {
                        RemoteCreatedAt: dayjs(
                          getValueFromPath(record, system.createdAt),
                        ).toISOString(),
                      }
                    : {}),
                  ...(system.updatedAt
                    ? {
                        RemoteUpdatedAt: dayjs(
                          getValueFromPath(record, system.updatedAt),
                        ).toISOString(),
                      }
                    : {}),
                  RemoteRaw: JSON.stringify(record),
                },
              });
            }
          }

          // Pagination handling
          let shouldContinue = true;

          if (!pagination) break;

          switch (pagination.mode) {
            case 'next':
              nextUrl = getValueFromPath(response.data, pagination.nextPath);
              shouldContinue = !!nextUrl;
              break;
            case 'offset':
              offset += pagination.limit;
              shouldContinue = dataArray.length === pagination.limit;
              break;
            case 'page':
              page += 1;
              shouldContinue = dataArray.length > 0;
              break;
            case 'cursor':
              cursor = getValueFromPath(response.data, pagination.cursorPath);
              shouldContinue = !!cursor;
              break;
          }

          if (!shouldContinue) break;

          await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
        }

        stream.push(null);
      } catch (error) {
        stream.destroy(error);
      }
    })();

    return stream;
  }

  public getIncrementalKey() {
    return 'RemoteUpdatedAt'; // You can adjust based on common timestamp fields or pass as config
  }
}
