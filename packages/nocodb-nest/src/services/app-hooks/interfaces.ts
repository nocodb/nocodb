import type { ProjectType, UserType, WorkspaceType } from 'nocodb-sdk';

export interface ProjectInviteEventData {
  project: ProjectType;
  user: UserType;
  invitedBy: UserType;
}

export interface WorkspaceInviteEventData {
  workspace: WorkspaceType;
  user: UserType;
  invitedBy: UserType;
}

export interface WelcomeEventData {
  user: UserType;
}
