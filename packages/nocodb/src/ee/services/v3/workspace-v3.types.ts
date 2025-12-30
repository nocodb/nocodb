export interface WorkspaceV3Update {
  title: string;
}

export interface WorkspaceV3Create {
  title: string;
  org_id?: string; // required for cloud; absent in case of on-prem EE
}

export interface WorkspaceV3 extends WorkspaceV3Create {
  id: string;
  org_id?: string;
  title: string;
  meta?: any;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceV3ListResponse {
  list: WorkspaceV3[];
}
