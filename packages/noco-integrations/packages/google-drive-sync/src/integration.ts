import {
  DataObjectStream,
  SCHEMA_FILE_STORAGE,
  SyncIntegration,
} from '@noco-integrations/core';
import { GoogleDriveFormatter } from './formatter';
import type { GoogleDriveFileListResponse } from './types';
import type { GoogleDriveAuthIntegration } from '@noco-integrations/google-drive-auth';
import type {
  SyncLinkValue,
  SyncRecord,
  TARGET_TABLES,
} from '@noco-integrations/core';

export interface GoogleDriveSyncPayload {
  title: string;
}

export default class GoogleDriveSyncIntegration extends SyncIntegration<GoogleDriveSyncPayload> {
  formatter = new GoogleDriveFormatter();

  public getTitle() {
    return this.config.title;
  }

  get batchSize(): number {
    return 25;
  }

  public async getDestinationSchema(_auth: GoogleDriveAuthIntegration) {
    return SCHEMA_FILE_STORAGE;
  }

  public async fetchData(
    auth: GoogleDriveAuthIntegration,
    _args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    void (async () => {
      try {
        const configVars = (this.getVars() ?? {}) as any;
        let pageToken = configVars.page_token;
        let hasMore = true;

        while (hasMore) {
          const { data: fileListResponse } = (await auth.use(async (client) => {
            const params: Record<string, string> = {
              pageSize: '1000',
              fields:
                'nextPageToken, files(id, name, mimeType, parents, size, createdTime, modifiedTime, webViewLink, thumbnailLink, md5Checksum, trashed)',
              q: 'trashed=false',
              orderBy: 'folder,modifiedTime desc',
            };

            if (pageToken) {
              params.pageToken = pageToken;
            }

            return await client.get('/files', { params });
          })) as { data: GoogleDriveFileListResponse };

          pageToken = fileListResponse.nextPageToken;
          hasMore = !!pageToken;

          if (fileListResponse.files && fileListResponse.files.length > 0) {
            for (const each of this.formatter.formatEntries({
              files: fileListResponse.files,
            })) {
              stream.push(each);
            }
          }
        }

        await this.saveVars({ page_token: pageToken });
        stream.push(null);
      } catch (error) {
        console.error('[Google Drive Sync] Error fetching data:', error);
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
