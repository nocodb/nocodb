/**
 * Box API v2.0 file resource
 * @see https://developer.box.com/reference/resources/file--full/
 */
export interface BoxFile {
  id: string;
  type: 'file';
  name: string;
  size?: number;
  created_at?: string;
  modified_at?: string;
  description?: string;
  parent?: {
    id: string;
    type: 'folder';
    name: string;
  };
  shared_link?: {
    url: string;
  };
  sha1?: string;
  extension?: string;
  item_status?: 'active' | 'trashed' | 'deleted';
}

/**
 * Box API v2.0 folder resource
 * @see https://developer.box.com/reference/resources/folder--full/
 */
export interface BoxFolder {
  id: string;
  type: 'folder';
  name: string;
  created_at?: string;
  modified_at?: string;
  description?: string;
  parent?: {
    id: string;
    type: 'folder';
    name: string;
  };
  shared_link?: {
    url: string;
  };
  item_status?: 'active' | 'trashed' | 'deleted';
}

/**
 * Box API v2.0 items response
 * @see https://developer.box.com/reference/get-folders-id-items/
 */
export interface BoxItemsResponse {
  entries: (BoxFile | BoxFolder)[];
  total_count?: number;
  limit?: number;
  offset?: number;
  next_marker?: string;
}
