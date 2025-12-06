import { TARGET_TABLES } from '@noco-integrations/core';
import mime from 'mime';
import type {
  SyncLinkValue,
  SyncRecord,
  SyncValue,
} from '@noco-integrations/core';
import type { BoxItemsResponse, BoxFile, BoxFolder } from './types';

export class BoxFormatter {
  /**
   * Formats Box file/folder entries into the file storage schema format
   * @param entries - The Box items response containing files and folders
   * @returns Array of formatted data objects for files and folders
   */
  formatEntries({
    entries,
  }: {
    entries: BoxItemsResponse['entries'];
  }): Array<{
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
    const folders = entries.filter(
      (item) => item.type === 'folder' && item.item_status !== 'trashed' && item.item_status !== 'deleted',
    ) as BoxFolder[];

    const files = entries.filter(
      (item) => item.type === 'file' && item.item_status !== 'trashed' && item.item_status !== 'deleted',
    ) as BoxFile[];

    // Format folders
    for (const folder of folders) {
      const folderRecordId = folder.id;
      const parentId = folder.parent?.id || null;

      const folderData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: folder.name,
        'Folder URL': folder.shared_link?.url || null,
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
      const parentId = file.parent?.id || null;

      // Determine MIME type from file extension or name
      const mimeType = file.extension
        ? mime.getType(file.extension) || mime.getType(file.name) || 'application/octet-stream'
        : mime.getType(file.name) || 'application/octet-stream';

      const fileData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: file.name,
        'File URL': file.shared_link?.url || null,
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
