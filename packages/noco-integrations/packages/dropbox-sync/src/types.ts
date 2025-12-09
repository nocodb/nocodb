interface FilesListFolderEntryFile {
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
}
interface FilesListFolderEntryFolder {
  '.tag': 'folder';
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
}

export interface FilesListFolderResponse {
  entries: (FilesListFolderEntryFile | FilesListFolderEntryFolder)[];
  cursor: string;
  has_more: boolean;
}
