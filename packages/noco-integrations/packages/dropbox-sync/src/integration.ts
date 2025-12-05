import {
  DataObjectStream,
  SCHEMA_FILE_STORAGE,
  SyncIntegration,
} from '@noco-integrations/core';
import { DropboxFormatter } from './formatter';
import type { FilesListFolderResponse } from './types';
import type { DropboxAuthIntegration } from '@noco-integrations/dropbox-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TARGET_TABLES,
} from '@noco-integrations/core';

export interface DropboxSyncPayload {
  title: string;
}

export default class DropboxSyncIntegration extends SyncIntegration<DropboxSyncPayload> {
  formatter = new DropboxFormatter();

  public getTitle() {
    return this.config.title;
  }

  get batchSize(): number {
    return 25;
  }

  public async getDestinationSchema(_auth: DropboxAuthIntegration) {
    return SCHEMA_FILE_STORAGE;
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
        const configVars = (this.getVars() ?? {}) as any;
        let syncCursor = configVars.file_cursor;
        let hasMore = true;

        while (hasMore) {
          // if no syncCursor then we initiate first list
          if (!syncCursor) {
            const { data: listFolderResponse } = (await auth.use(
              async (client) => {
                return await client.post(`/files/list_folder`, {
                  path: '',
                  recursive: true,
                  include_deleted: false,
                  include_has_explicit_shared_members: false,
                  include_media_info: false,
                  include_mounted_folders: true,
                  include_non_downloadable_files: true,
                });
              },
            )) as { data: FilesListFolderResponse };
            syncCursor = listFolderResponse.cursor;
            hasMore = listFolderResponse.has_more;
            for (const each of this.formatter.formatEntries({
              entries: listFolderResponse.entries,
            })) {
              stream.push(each);
            }
          } else {
            const { data: listFolderContinueResponse } = (await auth.use(
              async (client) => {
                return await client.post(`/files/list_folder/continue`, {
                  cursor: syncCursor,
                });
              },
            )) as { data: FilesListFolderResponse };
            syncCursor = listFolderContinueResponse.cursor;
            hasMore = listFolderContinueResponse.has_more;
            for (const each of this.formatter.formatEntries({
              entries: listFolderContinueResponse.entries,
            })) {
              stream.push(each);
            }
          }
        }

        await this.saveVars({ file_cursor: syncCursor });
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
