// packages/nocodb-sdk/src/lib/app/team.ts
// `public` is a grant subject, not a roster: nobody is ever a member of it, and
// its capabilities are what anonymous visitors of a published app may invoke.
export type AppTeamSystemKey = 'admin' | 'members' | 'public';

export interface AppTeamType {
  id: string;
  fk_app_id: string;
  base_id?: string;
  fk_workspace_id?: string;
  title: string;
  handle: string;
  system_key?: AppTeamSystemKey | null;
  include_all_base_members?: boolean;
  include_base_creators?: boolean;
  /**
   * Action ids or globs this team may invoke. Snapshotted into the app version's
   * grants at publish — dispatch checks the snapshot, never this field, so an
   * edit here takes effect only on the next publish.
   */
  capabilities?: string[] | string;
  meta?: Record<string, any> | string;
  order?: number;
  created_at?: string;
  updated_at?: string;
  members_count?: number;
}

export interface AppTeamMemberEntry {
  principal_type: 'user' | 'team';
  principal_id: string;
  email?: string;
  display_name?: string;
  title?: string; // team title
  hierarchy_scope?: 'self_only' | 'self_and_descendants';
}

/** One team a member is on: `auto` comes from their project role, `explicit` from an assignment. */
export interface AppMemberTeamRef {
  id: string;
  /** `auto` by base role, `explicit` by assignment, `team` through a workspace team on it. */
  source: 'auto' | 'explicit' | 'team';
}

export interface AppMemberType {
  principal_type: 'user' | 'team';
  principal_id: string;
  email?: string;
  display_name?: string;
  /** Workspace team title. */
  title?: string;
  /** A real project role; null for app users and workspace teams. */
  base_role?: string | null;
  invited?: boolean;
  teams: AppMemberTeamRef[];
}

export interface AppMemberListResponse {
  list: AppMemberType[];
  pageInfo: { totalRows: number };
  /** Everyone on each team, before search and filter. */
  teamCounts: Record<string, number>;
}
