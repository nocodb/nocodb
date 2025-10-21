import type { WorkspaceUserRoles } from 'nocodb-sdk';

export interface WorkspaceTeamV3ResponseType {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_badge_color?: string;
  workspace_role:
    | WorkspaceUserRoles.CREATOR
    | WorkspaceUserRoles.EDITOR
    | WorkspaceUserRoles.VIEWER
    | WorkspaceUserRoles.COMMENTER
    | WorkspaceUserRoles.NO_ACCESS;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTeamCreateV3ReqType {
  team_id: string;
  workspace_role:
    | WorkspaceUserRoles.CREATOR
    | WorkspaceUserRoles.EDITOR
    | WorkspaceUserRoles.VIEWER
    | WorkspaceUserRoles.COMMENTER
    | WorkspaceUserRoles.NO_ACCESS;
}

export interface WorkspaceTeamUpdateV3ReqType {
  team_id: string;
  workspace_role:
    | WorkspaceUserRoles.CREATOR
    | WorkspaceUserRoles.EDITOR
    | WorkspaceUserRoles.VIEWER
    | WorkspaceUserRoles.COMMENTER
    | WorkspaceUserRoles.NO_ACCESS;
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
  workspace_role:
    | WorkspaceUserRoles.CREATOR
    | WorkspaceUserRoles.EDITOR
    | WorkspaceUserRoles.VIEWER
    | WorkspaceUserRoles.COMMENTER
    | WorkspaceUserRoles.NO_ACCESS;
  created_at: string;
  updated_at: string;
}
