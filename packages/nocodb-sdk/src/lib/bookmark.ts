export interface BookmarkGroupType {
  id?: string;
  fk_user_id?: string;
  name: string;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BookmarkType {
  id?: string;
  fk_user_id?: string;
  fk_group_id?: string;
  title: string;
  target_type: 'workspace' | 'base' | 'table' | 'view' | 'document' | 'workflow' | 'script';
  target_id: string;
  order?: number;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface BookmarkGroupReqType {
  name: string;
  order?: number;
}

export interface BookmarkReqType {
  fk_group_id?: string;
  title: string;
  target_type: 'workspace' | 'base' | 'table' | 'view' | 'document' | 'workflow' | 'script';
  target_id: string;
  order?: number;
  meta?: Record<string, any>;
}
