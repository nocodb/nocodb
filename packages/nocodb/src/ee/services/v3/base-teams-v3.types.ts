import type { ProjectRoles } from 'nocodb-sdk';

export interface BaseTeamV3ResponseType {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_badge_color?: string;
  base_role:
    | ProjectRoles.CREATOR
    | ProjectRoles.EDITOR
    | ProjectRoles.VIEWER
    | ProjectRoles.COMMENTER
    | ProjectRoles.NO_ACCESS;
  created_at: string;
  updated_at: string;
}

export interface BaseTeamCreateV3ReqType {
  team_id: string;
  base_role:
    | ProjectRoles.CREATOR
    | ProjectRoles.EDITOR
    | ProjectRoles.VIEWER
    | ProjectRoles.COMMENTER
    | ProjectRoles.NO_ACCESS;
}

export interface BaseTeamUpdateV3ReqType {
  team_id: string;
  base_role:
    | ProjectRoles.CREATOR
    | ProjectRoles.EDITOR
    | ProjectRoles.VIEWER
    | ProjectRoles.COMMENTER
    | ProjectRoles.NO_ACCESS;
}

export interface BaseTeamDeleteV3ReqType {
  team_id: string;
}

export interface BaseTeamListV3Type {
  list: BaseTeamV3ResponseType[];
}

export interface BaseTeamDetailV3Type {
  team_id: string;
  team_title: string;
  team_icon?: string;
  team_badge_color?: string;
  base_role:
    | ProjectRoles.CREATOR
    | ProjectRoles.EDITOR
    | ProjectRoles.VIEWER
    | ProjectRoles.COMMENTER
    | ProjectRoles.NO_ACCESS;
  created_at: string;
  updated_at: string;
}
