import { TARGET_TABLES } from '@noco-integrations/core';
import type {
  SyncLinkValue,
  SyncRecord,
  SyncValue,
} from '@noco-integrations/core';
import type { GoogleDriveFileListResponse } from './types';

export class GoogleDriveFormatter {
  /**
   * Formats Google Drive file/folder entries into the file storage schema format
   * @param files - The Google Drive files list response containing files
   * @returns Array of formatted data objects for files and folders
   */
  formatEntries({
    files,
  }: {
    files: GoogleDriveFileListResponse['files'];
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
    const folders = files.filter(
      (file) => file.mimeType === 'application/vnd.google-apps.folder',
    );

    const regularFiles = files.filter(
      (file) => file.mimeType !== 'application/vnd.google-apps.folder',
    );

    // Format folders
    for (const folder of folders) {
      const folderRecordId = folder.id;
      const parentId =
        folder.parents && folder.parents.length > 0 ? folder.parents[0] : null;

      const folderData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: folder.name,
        'Folder URL': folder.webViewLink || null,
        Size: null,
        Description: null,
        RemoteRaw: JSON.stringify(folder),
        RemoteCreatedAt: folder.createdTime || null,
        RemoteUpdatedAt: folder.modifiedTime || null,
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
    for (const file of regularFiles) {
      const fileRecordId = file.id;
      const parentId =
        file.parents && file.parents.length > 0 ? file.parents[0] : null;

      const fileData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: file.name,
        'File URL': file.webViewLink || null,
        'File Thumbnail URL': file.thumbnailLink || null,
        Size: file.size ? parseInt(file.size, 10) : null,
        'Mime Type': file.mimeType || null,
        Checksum: file.md5Checksum || null,
        RemoteRaw: JSON.stringify(file),
        RemoteCreatedAt: file.createdTime || null,
        RemoteUpdatedAt: file.modifiedTime || null,
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
