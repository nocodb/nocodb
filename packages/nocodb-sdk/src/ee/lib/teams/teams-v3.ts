import type { IconType, TeamUserRoles } from '~/lib/enums';

export interface TeamV3Type {
  id: string;
  name: string;
  icon?: string;
  icon_type?: IconType;
  badge_color?: string;
  members_count: number;
  managers_count: number;
  fk_org_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type TeamScope = 'org' | 'workspace';

export interface TeamV3ResponseType {
  id: string;
  title: string;
  icon?: string;
  icon_type?: IconType;
  badge_color?: string;
  members_count: number;
  managers_count: number;
  managers: string[]; // Array of manager user IDs
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_member?: boolean; // Whether the current logged-in user is a member of the team
  is_owner?: boolean; // Whether the current logged-in user is an owner of the team
  fk_parent_team_id?: string | null;
  depth?: number;
  path?: string;
  fk_org_id?: string;
  fk_workspace_id?: string;
  scope?: TeamScope; // 'org' = org-level team, 'workspace' = workspace-level team
  scim_managed?: boolean;
}

export interface TeamTreeNodeV3Type extends TeamV3ResponseType {
  children: TeamTreeNodeV3Type[];
}

export interface TeamCreateV3ReqType {
  title: string;
  icon?: string;
  icon_type?: IconType;
  badge_color?: string;
  members?: TeamMemberV3Type[];
  parent_team_id?: string;
}

export interface TeamMoveV3ReqType {
  parent_team_id: string | null; // null = make root team
}

export interface TeamUpdateV3ReqType {
  title?: string;
  icon?: string;
  icon_type?: IconType;
  badge_color?: string;
}

export interface TeamMemberV3Type {
  user_id: string;
  team_role: TeamUserRoles.OWNER | TeamUserRoles.MEMBER;
}

export interface TeamMemberV3ResponseType {
  user_email: string;
  user_id: string;
  team_role: TeamUserRoles.OWNER | TeamUserRoles.MEMBER;
}

export interface InheritedTeamMemberV3Type extends TeamMemberV3ResponseType {
  inherited_from_team_id: string;
  inherited_from_team_title: string;
}

export interface TeamDetailV3Type {
  title: string;
  icon?: string;
  icon_type?: IconType;
  badge_color?: string;
  fk_parent_team_id?: string | null;
  members: TeamMemberV3ResponseType[];
  inherited_members?: InheritedTeamMemberV3Type[];
}

export interface TeamMembersAddV3ReqType {
  user_id: string;
  team_role: TeamUserRoles.OWNER | TeamUserRoles.MEMBER;
}

export interface TeamMembersRemoveV3ReqType {
  user_id: string;
}

export interface TeamMembersUpdateV3ReqType {
  user_id: string;
  team_role: TeamUserRoles.OWNER | TeamUserRoles.MEMBER;
}
