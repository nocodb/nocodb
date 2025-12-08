import {
  DataObjectStream,
  SCHEMA_FILE_STORAGE,
  SyncIntegration,
} from '@noco-integrations/core';
import { BoxFormatter } from './formatter';
import type { EventStreamResponse } from './types';
import type { BoxAuthIntegration } from '@noco-integrations/box-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TARGET_TABLES,
} from '@noco-integrations/core';

export interface BoxSyncPayload {
  title: string;
}

export default class BoxSyncIntegration extends SyncIntegration<BoxSyncPayload> {
  formatter = new BoxFormatter();

  public getTitle() {
    return this.config.title;
  }

  get batchSize(): number {
    return 25;
  }

  public async getDestinationSchema(_auth: BoxAuthIntegration) {
    return SCHEMA_FILE_STORAGE;
  }

  async getEvents(
    auth: BoxAuthIntegration,
    { streamPosition }: { streamPosition?: string },
  ) {
    const { data } = (await auth.use(async (client) => {
      return await client.get(`/events`, {
        params: { stream_position: streamPosition },
      });
    })) as { data: EventStreamResponse };

    return data;
  }

  public async fetchData(
    auth: BoxAuthIntegration,
    _args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    let streamPosition = this.getVars()?.stream_position;
    let hasMore = true;

    void (async () => {
      try {
        while (hasMore) {
          const result = await this.getEvents(auth, { streamPosition });
          const entries = result.entries;
          // Format and push all entries
          if (entries && entries.length > 0) {
            for (const each of this.formatter.formatEntries({ entries })) {
              stream.push(each);
            }
          }
          hasMore = entries.length > 0;
          streamPosition = result.next_stream_position;
        }

        await this.saveVars({
          stream_position: streamPosition,
        });
        stream.push(null);
      } catch (error) {
        console.error('[Box Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }

  formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
    namespace?: string,
  ): { data: SyncRecord; links?: Record<string, SyncLinkValue> } {
    switch (targetTable) {
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteNamespace: namespace,
          },
        };
      }
    }
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
