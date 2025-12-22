import {
  DataObjectStream,
  SCHEMA_CRM,
  SCHEMA_FILE_STORAGE,
  SyncIntegration,
} from '@noco-integrations/core';
import { HubspotFormatter } from './formatter';
import type { DropboxAuthIntegration } from '@noco-integrations/dropbox-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TARGET_TABLES,
} from '@noco-integrations/core';

export interface HubspotSyncPayload {
  title: string;
}

export default class HubspotSyncIntegration extends SyncIntegration<DropboxSyncPayload> {
  formatter = new HubspotFormatter();

  public getTitle() {
    return this.config.title;
  }

  public async getDestinationSchema(_auth: DropboxAuthIntegration) {
    return SCHEMA_CRM;
  }

  public async fetchData(
    auth: DropboxAuthIntegration,
    _args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    // Simplified data fetching for Dropbox employees
    void (async () => {
      try {
        stream.push(null);
      } catch (error) {
        console.error('[Dropbox Sync] Error fetching data:', error);
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
