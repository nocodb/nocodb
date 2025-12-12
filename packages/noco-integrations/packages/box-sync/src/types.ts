/**
 * Box API v2.0 file resource
 * @see https://developer.box.com/reference/resources/file--full/
 */

/**
 * Box API v2.0 items response
 * @see https://developer.box.com/reference/get-folders-id-items/
 */

type UserType = 'user';

interface User {
  type: UserType;
  id: string;
  name: string;
  login: string;
}

type FolderType = 'folder';

interface Folder {
  type: FolderType;
  id: string;
  sequence_id: string | null;
  etag: string | null;
  name: string;
}

interface PathCollection {
  total_count: number;
  entries: Folder[];
}

type FileVersionType = 'file_version';

interface FileVersion {
  type: FileVersionType;
  id: string;
  sha1: string;
}

type BoxFileType = 'file';

export interface BoxFile {
  type: BoxFileType;
  id: string;
  file_version: FileVersion;
  sequence_id: string;
  etag: string;
  sha1: string;
  name: string;
  description: string;
  size: number;
  path_collection: PathCollection;
  created_at: string;
  modified_at: string;
  trashed_at: string | null;
  purged_at: string | null;
  content_created_at: string;
  content_modified_at: string;
  created_by: User;
  modified_by: User;
  owned_by: User;
  shared_link: unknown | null;
  parent: Folder;
  item_status: string;
  is_package: boolean;
  synced: boolean;
}

export interface BoxFolderDetails {
  type: FolderType;
  id: string;
  sequence_id: string;
  etag: string;
  name: string;
  created_at: string;
  modified_at: string;
  description: string;
  size: number;
  path_collection: PathCollection;
  created_by: User;
  modified_by: User;
  trashed_at: string | null;
  purged_at: string | null;
  content_created_at: string;
  content_modified_at: string;
  owned_by: User;
  shared_link: unknown | null;
  folder_upload_email: unknown | null;
  parent: Folder;
  item_status: string;
  synced: boolean;
}

type EventType = 'event';
type BoxEventType = 'ITEM_UPLOAD' | 'ITEM_CREATE';

export interface Event {
  type: EventType;
  event_id: string;
  created_by: User;
  created_at: string;
  recorded_at: string;
  event_type: BoxEventType;
  session_id: string | null;
  source: BoxFile | BoxFolderDetails;
}

export interface EventStreamResponse {
  entries: Event[];
  next_stream_position: number;
  chunk_size: number;
}
