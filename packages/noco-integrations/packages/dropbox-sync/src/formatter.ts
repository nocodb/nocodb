import { TARGET_TABLES } from '@noco-integrations/core';
import mime from 'mime';
import type {
  SyncLinkValue,
  SyncRecord,
  SyncValue,
} from '@noco-integrations/core';
import type { FilesListFolderResponse } from './types';

/**
 * Extracts parent folder path from a given path
 * @param path - The full path (e.g., "/folder1/folder2/file.txt")
 * @returns The parent folder path (e.g., "/folder1/folder2") or null for root
 */
function getParentPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return null; // Root level
  }
  parts.pop(); // Remove the last part (file/folder name)
  return '/' + parts.join('/');
}

/**
 * Gets the record ID for a folder based on its path
 * @param path - The folder path
 * @returns The record ID (using path as identifier)
 */
function getFolderRecordId(path: string): string {
  return path || '/';
}

export class DropboxFormatter {
  /**
   * Formats Dropbox file/folder entries into the file storage schema format
   * @param entries - The Dropbox list folder response containing entries
   * @returns Array of formatted data objects for files and folders
   */
  formatEntries({
    entries,
  }: {
    entries: FilesListFolderResponse['entries'];
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
      (entry) => entry['.tag'] === 'folder',
    ) as Array<{
      '.tag': 'folder';
      name: string;
      path_lower: string;
      path_display: string;
      id: string;
    }>;

    const files = entries.filter((entry) => entry['.tag'] === 'file') as Array<{
      '.tag': 'file';
      name: string;
      path_lower: string;
      path_display: string;
      id: string;
      client_modified: string;
      server_modified: string;
      rev: string;
      size: number;
      is_downloadable: boolean;
      content_hash: string;
    }>;

    // Format folders
    for (const folder of folders) {
      const parentPath = getParentPath(folder.path_display);
      const folderRecordId = getFolderRecordId(folder.path_display);

      const folderData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: folder.name,
        'Folder URL': folder.path_display,
        Size: null,
        Description: null,
        RemoteRaw: JSON.stringify(folder),
        RemoteCreatedAt: null,
        RemoteUpdatedAt: null,
      };

      result.push({
        recordId: folderRecordId,
        targetTable: TARGET_TABLES.FILE_STORAGE_FOLDER,
        data: folderData,
        links: parentPath
          ? {
              'Parent Folder': [getFolderRecordId(parentPath)],
            }
          : undefined,
      });
    }

    // Format files
    for (const file of files) {
      const parentPath = getParentPath(file.path_display);
      const fileRecordId = file.id;

      // Determine MIME type from file name
      const mimeType = mime.getType(file.name) || 'application/octet-stream';

      const fileData: SyncRecord &
        Record<string, SyncValue<string | number | boolean | null>> = {
        Name: file.name,
        'File URL': file.path_display,
        'File Thumbnail URL': null,
        Size: file.size,
        'Mime Type': mimeType,
        Checksum: file.content_hash,
        RemoteRaw: JSON.stringify(file),
        RemoteCreatedAt: file.client_modified,
        RemoteUpdatedAt: file.server_modified,
      };

      result.push({
        recordId: fileRecordId,
        targetTable: TARGET_TABLES.FILE_STORAGE_FILE,
        data: fileData,
        links: parentPath
          ? {
              Folder: [getFolderRecordId(parentPath)],
            }
          : undefined,
      });
    }

    return result;
  }
}
