export interface TeamV3Type {
  id: string;
  name: string;
  icon?: string;
  badge_color?: string;
  members_count: number;
  managers_count: number;
  fk_org_id?: string;
  fk_workspace_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TeamV3ResponseType {
  id: string;
  title: string;
  icon?: string;
  badge_color?: string;
  members_count: number;
  managers_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeamCreateV3ReqType {
  title: string;
  icon?: string;
  badge_color?: string;
  members?: TeamMemberV3Type[];
}

export interface TeamUpdateV3ReqType {
  title?: string;
  icon?: string;
  badge_color?: string;
}

export interface TeamMemberV3Type {
  user_id: string;
  team_role: 'member' | 'manager';
}

export interface TeamMemberV3ResponseType {
  user_email: string;
  user_id: string;
  team_role: 'member' | 'manager';
}

export interface TeamDetailV3Type {
  title: string;
  icon?: string;
  badge_color?: string;
  members: TeamMemberV3ResponseType[];
}

export interface TeamMembersAddV3ReqType {
  user_id: string;
  team_role: 'member' | 'manager';
}

export interface TeamMembersRemoveV3ReqType {
  user_id: string;
}

export interface TeamMembersUpdateV3ReqType {
  user_id: string;
  team_role: 'member' | 'manager';
}
