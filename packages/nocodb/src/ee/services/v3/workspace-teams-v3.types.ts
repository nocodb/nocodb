export interface WorkspaceTeamV3ResponseType {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_badge_color?: string;
  workspace_role: 'member' | 'manager';
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTeamCreateV3ReqType {
  team_id: string;
  workspace_role: 'member' | 'manager';
}

export interface WorkspaceTeamUpdateV3ReqType {
  team_id: string;
  workspace_role: 'member' | 'manager';
}

export interface WorkspaceTeamDeleteV3ReqType {
  team_id: string;
}

export interface WorkspaceTeamListV3Type {
  list: WorkspaceTeamV3ResponseType[];
}

export interface WorkspaceTeamDetailV3Type {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_badge_color?: string;
  workspace_role: 'member' | 'manager';
  created_at: string;
  updated_at: string;
}
