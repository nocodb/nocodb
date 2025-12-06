import {
  DataObjectStream,
  SCHEMA_FILE_STORAGE,
  SyncIntegration,
} from '@noco-integrations/core';
import { BoxFormatter } from './formatter';
import type { BoxItemsResponse, BoxFolder } from './types';
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

  /**
   * Fetches all items from a Box folder with pagination
   * @param auth - Box authentication integration
   * @param folderId - The folder ID to fetch items from (use "0" for root)
   * @param allEntries - Accumulator for all entries
   * @returns Promise with all entries from this folder
   */
  private async fetchFolderItems(
    auth: BoxAuthIntegration,
    folderId: string,
    allEntries: (BoxItemsResponse['entries'][number])[] = [],
  ): Promise<BoxItemsResponse['entries']> {
    let marker: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        limit: '1000',
        usemarker: 'true',
        fields: 'id,type,name,size,created_at,modified_at,description,parent,shared_link,sha1,extension,item_status',
      };

      if (marker) {
        params.marker = marker;
      }

      const { data: itemsResponse } = (await auth.use(async (client) => {
        return await client.get(`/folders/${folderId}/items`, { params });
      })) as { data: BoxItemsResponse };

      allEntries.push(...itemsResponse.entries);

      marker = itemsResponse.next_marker;
      hasMore = !!marker;
    }

    return allEntries;
  }

  /**
   * Recursively fetches all items from a Box folder and its subfolders
   * @param auth - Box authentication integration
   * @param folderId - The folder ID to fetch items from (use "0" for root)
   * @param allEntries - Accumulator for all entries
   * @returns Promise with all entries from this folder and subfolders
   */
  private async fetchFolderItemsRecursive(
    auth: BoxAuthIntegration,
    folderId: string,
    allEntries: (BoxItemsResponse['entries'][number])[] = [],
  ): Promise<BoxItemsResponse['entries']> {
    // Fetch all items from current folder
    const folderEntries = await this.fetchFolderItems(auth, folderId, []);
    allEntries.push(...folderEntries);

    // Recursively fetch items from subfolders
    const folders = folderEntries.filter(
      (item) => item.type === 'folder' && item.item_status !== 'trashed' && item.item_status !== 'deleted',
    ) as BoxFolder[];

    for (const folder of folders) {
      await this.fetchFolderItemsRecursive(auth, folder.id, allEntries);
    }

    return allEntries;
  }

  public async fetchData(
    auth: BoxAuthIntegration,
    _args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    void (async () => {
      try {
        const rootFolderId = '0'; // Box root folder ID

        // Fetch all items recursively starting from root
        const entries: BoxItemsResponse['entries'] = [];
        await this.fetchFolderItemsRecursive(auth, rootFolderId, entries);

        // Format and push all entries
        if (entries && entries.length > 0) {
          for (const each of this.formatter.formatEntries({ entries })) {
            stream.push(each);
          }
        }

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
