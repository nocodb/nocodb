import type {
  ProjectType,
  TableType,
  UserType,
  WorkspaceType,
} from 'nocodb-sdk';

export interface ProjectInviteEvent {
  project: ProjectType;
  user: UserType;
  invitedBy: UserType;
}

export interface ProjectCreateEvent {
  project: ProjectType;
  user: UserType;
}

export interface ProjectUpdateEvent {
  project: ProjectType;
  user: UserType;
}

export interface ProjectDeleteEvent {
  project: ProjectType;
  user: UserType;
}

export interface WorkspaceInviteEvent {
  workspace: WorkspaceType;
  user: UserType;
  invitedBy: UserType;
}

export interface WelcomeEvent {
  user: UserType;
}

export interface UserSignupEvent {
  user: UserType;
}

export interface UserSigninEvent {
  user: UserType;
}

export interface TableCreateEvent {
  table: TableType;
  user: UserType;
}
export interface TableUpdateEvent {
  table: TableType;
  user: UserType;
}
export interface TableDeleteEvent {
  table: TableType;
  user: UserType;
}

export type AppEventPayload =
  | ProjectInviteEvent
  | ProjectCreateEvent
  | ProjectUpdateEvent
  | ProjectDeleteEvent
  | WorkspaceInviteEvent
  | WelcomeEvent
  | UserSignupEvent
  | UserSigninEvent
  | TableUpdateEvent
  | TableDeleteEvent;
