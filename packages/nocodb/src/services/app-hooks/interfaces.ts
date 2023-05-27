import type { SyncSource } from '../../models';
import type {
  ApiTokenReqType,
  BaseType,
  PluginTestReqType,
  PluginType,
} from 'nocodb-sdk';
import type {
  ColumnType,
  FilterType,
  HookType,
  ProjectType,
  ProjectUserReqType,
  SortType,
  TableType,
  UserType,
  ViewType,
} from 'nocodb-sdk';

export interface ProjectInviteEvent {
  project: ProjectType;
  user: UserType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectUserUpdateEvent {
  project: ProjectType;
  user: UserType;
  projectUser: ProjectUserReqType;
  updatedBy: UserType;
  ip?: string;
}

export interface ProjectUserResendInviteEvent {
  project: ProjectType;
  user: UserType;
  projectUser: ProjectUserReqType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectCreateEvent {
  project: ProjectType;
  user: UserType;
  xcdb: boolean;
}

export interface ProjectUpdateEvent {
  project: ProjectType;
  user: UserType;
}

export interface ProjectDeleteEvent {
  project: ProjectType;
  user: UserType;
}

export interface WelcomeEvent {
  user: UserType;
}

export interface UserSignupEvent {
  user: UserType;
  ip?: string;
}

export interface UserSigninEvent {
  user: UserType;
  ip?: string;
  auditDescription?: string;
}

export interface ApiCreatedEvent {
  info: any;
}

export interface UserPasswordChangeEvent {
  user: UserType;
  ip?: string;
}

export interface UserPasswordForgotEvent {
  user: UserType;
  ip?: string;
}

export interface UserPasswordResetEvent {
  user: UserType;
  ip?: string;
}

export interface UserEmailVerificationEvent {
  user: UserType;
  ip?: string;
}

export interface TableEvent {
  table: TableType;
  user: UserType;
  ip?: string;
}

export interface ViewEvent {
  view: ViewType;
  user?: UserType;
  ip?: string;
  showAs?: string;
}

export interface FilterEvent {
  filter: FilterType;
  ip?: string;
  hook?: HookType;
  view?: ViewType;
}

export interface ColumnEvent {
  table: TableType;
  oldColumn?: ColumnType;
  column: ColumnType;
  user: UserType;
  ip?: string;
}

export interface SortEvent {
  sort: SortType;
  ip?: string;
}

export interface OrgUserInviteEvent {
  invitedBy: UserType;
  user: UserType;
  count?: number;
  ip?: string;
}

export interface ViewColumnEvent {
  // todo: type
  viewColumn: any;
}

export interface RelationEvent {
  column: ColumnType;
}

export interface WebhookEvent {
  hook: HookType;
}

export interface ApiTokenCreateEvent {
  userId: string;
  tokenBody: ApiTokenReqType;
}

export interface ApiTokenDeleteEvent {
  userId: string;
  token: string;
}

export interface PluginTestEvent {
  testBody: PluginTestReqType;
}

export interface PluginEvent {
  plugin: PluginType;
}

export interface SharedBaseEvent {
  link?: string;
  project?: ProjectType;
}

export interface BaseEvent {
  base: BaseType;
}

export interface AttachmentEvent {
  type: 'url' | 'file';
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FormColumnEvent {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GridColumnEvent {}

export interface MetaDiffEvent {
  project: ProjectType;
  base?: BaseType;
}
export interface UIAclEvent {
  project: ProjectType;
}

export interface SyncSourceEvent {
  syncSource: Partial<SyncSource>;
}

export type AppEventPayload =
  | ProjectInviteEvent
  | ProjectCreateEvent
  | ProjectUpdateEvent
  | ProjectDeleteEvent
  | WelcomeEvent
  | UserSignupEvent
  | UserSigninEvent
  | TableEvent
  | ViewEvent
  | FilterEvent
  | SortEvent
  | ColumnEvent;
