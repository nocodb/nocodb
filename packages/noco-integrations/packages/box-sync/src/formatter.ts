import path from 'path';
import { TARGET_TABLES } from '@noco-integrations/core';
import mime from 'mime';
import type {
  SyncLinkValue,
  SyncRecord,
  SyncValue,
} from '@noco-integrations/core';
import type { BoxFile, BoxFolderDetails, Event } from './types';

export class BoxFormatter {
  getFolderPath(folder: BoxFolderDetails) {
    return (
      folder.path_collection.entries
        .filter((p) => p.id !== '0')
        .map((p) => p.name)
        .join('/') ?? '/'
    );
  }

  /**
   * Formats Box file/folder entries into the file storage schema format
   * @param entries - The Box items response containing files and folders
   * @returns Array of formatted data objects for files and folders
   */
  formatEntries({ entries }: { entries: Event[] }): Array<{
    recordId: string;
    targetTable: TARGET_TABLES;
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  }> {
    const result: Array<{
      recordId: string;
      targetTable: TARGET_TABLES;
      data: SyncRecord;
      links?: Record<string, SyncLinkValue>;
    }> = [];

    // Process folders first to ensure parent folders exist before files reference them
    const folders = entries
      .filter(
        (item) =>
          item.source &&
          item.source.type === 'folder' &&
          item.source.item_status !== 'trashed' &&
          item.source.item_status !== 'deleted',
      )
      .map((item) => item.source) as BoxFolderDetails[];

    const files = entries
      .filter(
        (item) =>
          item.source &&
          item.source.type === 'file' &&
          item.source.item_status !== 'trashed' &&
          item.source.item_status !== 'deleted',
      )
      .map((item) => item.source) as BoxFile[];

    // Format folders
    for (const folder of folders) {
      const folderRecordId = folder.id;
      const parentId =
        folder.parent?.id && folder.parent?.id !== '0'
          ? folder.parent?.id
          : null;

      const folderData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: folder.name,
        'Folder URL': `https://app.box.com/folder/${folderRecordId}`,
        Size: null,
        Description: folder.description || null,
        RemoteRaw: JSON.stringify(folder),
        RemoteCreatedAt: folder.created_at || null,
        RemoteUpdatedAt: folder.modified_at || null,
      };

      result.push({
        recordId: folderRecordId,
        targetTable: TARGET_TABLES.FILE_STORAGE_FOLDER,
        data: folderData,
        links: parentId
          ? {
              'Parent Folder': [parentId],
            }
          : undefined,
      });
    }

    // Format files
    for (const file of files) {
      const fileRecordId = file.id;
      const parentId =
        file.parent?.id && file.parent?.id !== '0' ? file.parent?.id : null;

      const extension = path.extname(file.name);
      // Determine MIME type from file extension or name
      const mimeType = extension
        ? mime.getType(extension)
        : 'application/octet-stream';

      const fileData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: file.name,
        'File URL': `https://app.box.com/file/${fileRecordId}`,
        'File Thumbnail URL': null,
        Size: file.size || null,
        'Mime Type': mimeType,
        Checksum: file.sha1 || null,
        RemoteRaw: JSON.stringify(file),
        RemoteCreatedAt: file.created_at || null,
        RemoteUpdatedAt: file.modified_at || null,
      };

      result.push({
        recordId: fileRecordId,
        targetTable: TARGET_TABLES.FILE_STORAGE_FILE,
        data: fileData,
        links: parentId
          ? {
              Folder: [parentId],
            }
          : undefined,
      });
    }

    return result;
  }
}
