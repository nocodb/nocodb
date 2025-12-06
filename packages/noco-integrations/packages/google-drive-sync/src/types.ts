/**
 * Google Drive API v3 file resource
 * @see https://developers.google.com/drive/api/v3/reference/files#resource
 */
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  md5Checksum?: string;
  trashed?: boolean;
}

/**
 * Google Drive API v3 files.list response
 * @see https://developers.google.com/drive/api/v3/reference/files/list
 */
export interface GoogleDriveFileListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}
