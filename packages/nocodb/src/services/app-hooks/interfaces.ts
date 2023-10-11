import type { SyncSource } from '~/models';
import type {
  ApiTokenReqType,
  PluginTestReqType,
  PluginType,
  SourceType,
} from 'nocodb-sdk';
import type {
  BaseType,
  ColumnType,
  FilterType,
  HookType,
  ProjectUserReqType,
  SortType,
  TableType,
  UserType,
  ViewType,
} from 'nocodb-sdk';

export interface ProjectInviteEvent {
  base: BaseType;
  user: UserType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectUserUpdateEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
  updatedBy: UserType;
  ip?: string;
}

export interface ProjectUserResendInviteEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectCreateEvent {
  base: BaseType;
  user: UserType;
  xcdb: boolean;
}

export interface ProjectUpdateEvent {
  base: BaseType;
  user: UserType;
}

export interface ProjectDeleteEvent {
  base: BaseType;
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
  base?: BaseType;
}

export interface BaseEvent {
  source: SourceType;
}

export interface AttachmentEvent {
  type: 'url' | 'file';
}

export interface FormColumnEvent {}

export interface GridColumnEvent {}

export interface MetaDiffEvent {
  base: BaseType;
  source?: SourceType;
}
export interface UIAclEvent {
  base: BaseType;
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
