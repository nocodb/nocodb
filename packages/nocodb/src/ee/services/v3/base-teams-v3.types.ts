import type { IconType, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';

export interface BaseTeamV3ResponseType {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_icon_type?: IconType;
  team_badge_color?: string;
  base_role?: Exclude<ProjectRoles, ProjectRoles.OWNER>;
  workspace_role?: Exclude<WorkspaceUserRoles, WorkspaceUserRoles.OWNER>;
  created_at: string;
  updated_at: string;
}

export interface BaseTeamCreateV3ReqType {
  team_id: string;
  base_role: Exclude<ProjectRoles, ProjectRoles.OWNER>;
}

export interface BaseTeamCreateV3BulkReqType {
  teams: BaseTeamCreateV3ReqType[];
}

export interface BaseTeamUpdateV3ReqType {
  team_id: string;
  base_role: Exclude<ProjectRoles, ProjectRoles.OWNER>;
}

export interface BaseTeamDeleteV3ReqType {
  team_id: string;
}

export interface BaseTeamDeleteV3BulkReqType {
  teams: BaseTeamDeleteV3ReqType[];
}

export interface BaseTeamListV3Type {
  list: BaseTeamV3ResponseType[];
}

export interface BaseTeamDetailV3Type {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_icon_type?: IconType;
  team_badge_color?: string;
  base_role?: Exclude<ProjectRoles, ProjectRoles.OWNER>;
  workspace_role?: Exclude<WorkspaceUserRoles, WorkspaceUserRoles.OWNER>;
  created_at: string;
  updated_at: string;
}
