// Roles for predefined test users
export type Role = 'owner' | 'creator' | 'editor' | 'commenter' | 'viewer';

export const ROLES: Role[] = ['owner', 'creator', 'editor', 'commenter', 'viewer'];

export const TEST_USERS: Record<Role, { email: string; password: string }> = {
  owner: { email: 'owner@agent.test', password: 'Password123.' },
  creator: { email: 'creator@agent.test', password: 'Password123.' },
  editor: { email: 'editor@agent.test', password: 'Password123.' },
  commenter: { email: 'commenter@agent.test', password: 'Password123.' },
  viewer: { email: 'viewer@agent.test', password: 'Password123.' },
};

// Workspace role strings used in v3 invitation API
export const WORKSPACE_ROLES: Record<Role, string> = {
  owner: 'workspace-level-owner',
  creator: 'workspace-level-creator',
  editor: 'workspace-level-editor',
  commenter: 'workspace-level-commenter',
  viewer: 'workspace-level-viewer',
};

// Stored credential for a signed-in user
export interface Credential {
  email: string;
  password: string;
  token: string;
}

// Persisted state
export interface State {
  url: string;
  credentials: Record<string, Credential>;   // email → {email, password, token}
  defaultUser: string | null;                 // email of last signed-in user
  workspace: { id: string; title: string } | null;
  baseWorkspaces?: Record<string, string>;    // baseId → wsId cache
  updatedAt: string;
}

// Legacy state shape (for auto-migration)
export interface LegacyState {
  url: string;
  tokens: Partial<Record<Role, string>>;
  workspace: { id: string; title: string } | null;
  updatedAt: string;
}

// API response types (lightweight — only fields we actually use)
export interface SigninResponse {
  token: string;
}

export interface UserResponse {
  id: string;
  email: string;
  display_name?: string;
  roles?: string;
}

export interface Workspace {
  id: string;
  title: string;
  created_at?: string;
}

export interface WorkspaceUser {
  id: string;
  email: string;
  roles: string;
}

export interface Base {
  id: string;
  title: string;
  type?: string;
  created_at?: string;
}

export interface Table {
  id: string;
  title: string;
  base_id?: string;
  columns?: Column[];  // v1/v2 response
  fields?: Column[];   // v3 response
  created_at?: string;
}

export interface Column {
  id: string;
  title: string;
  uidt?: string;       // v1/v2 field type
  type?: string;        // v3 field type
  pv?: boolean;
  system?: boolean;
}

export interface View {
  id: string;
  title: string;
  type?: number;
  table_id?: string;
}

export interface RecordV3 {
  id: number;
  fields: Record<string, unknown>;
}

export interface RecordList {
  records: RecordV3[];
  nestedNext?: string | null;
}

export interface CountResponse {
  count: number;
}
