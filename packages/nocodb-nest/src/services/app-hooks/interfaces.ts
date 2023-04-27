import type {
  ColumnType,
  FilterType,
  ProjectType,
  SortType,
  TableType,
  UserType,
  ViewType,
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

export interface TableEvent {
  table: TableType;
  user: UserType;
}

export interface ViewEvent {
  view: ViewType;
  user: UserType;
}

export interface FilterEvent {
  filter: FilterType;
  user: UserType;
}

export interface ColumnEvent {
  column: ColumnType;
  user: UserType;
}

export interface SortEvent {
  sort: SortType;
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
  | TableEvent
  | ViewEvent
  | FilterEvent
  | SortEvent
  | ColumnEvent;
