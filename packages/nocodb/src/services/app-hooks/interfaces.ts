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

export interface NcBaseEvent extends NcBaseEvent {
  req: NcRequest;
  clientId?: string;
}

export interface ProjectInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectUserUpdateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
  updatedBy: UserType;
  ip?: string;
}

export interface ProjectUserResendInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
  invitedBy: UserType;
  ip?: string;
}

export interface ProjectCreateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  xcdb: boolean;
}

export interface ProjectUpdateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

export interface ProjectDeleteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

export interface WelcomeEvent extends NcBaseEvent {
  user: UserType;
}

export interface UserSignupEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
}

export interface UserSigninEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
  auditDescription?: string;
}

export interface ApiCreatedEvent extends NcBaseEvent {
  info: any;
}

export interface UserPasswordChangeEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
}

export interface UserPasswordForgotEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
}

export interface UserPasswordResetEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
}

export interface UserEmailVerificationEvent extends NcBaseEvent {
  user: UserType;
  ip?: string;
}

export interface TableEvent extends NcBaseEvent {
  table: TableType;
  user: UserType;
  ip?: string;
}

export interface ViewEvent extends NcBaseEvent {
  view: ViewType;
  user?: UserType;
  ip?: string;
  showAs?: string;
}

export interface FilterEvent extends NcBaseEvent {
  filter: FilterType;
  ip?: string;
  hook?: HookType;
  view?: ViewType;
}

export interface ColumnEvent extends NcBaseEvent {
  table: TableType;
  oldColumn?: ColumnType;
  column: ColumnType;
  user: UserType;
  ip?: string;
}

export interface SortEvent extends NcBaseEvent {
  sort: SortType;
  ip?: string;
}

export interface OrgUserInviteEvent extends NcBaseEvent {
  invitedBy: UserType;
  user: UserType;
  count?: number;
  ip?: string;
}

export interface ViewColumnEvent extends NcBaseEvent {
  // todo: type
  viewColumn: any;
}

export interface RelationEvent extends NcBaseEvent {
  column: ColumnType;
}

export interface WebhookEvent extends NcBaseEvent {
  hook: HookType;
}

export interface ApiTokenCreateEvent extends NcBaseEvent {
  userId: string;
  tokenBody: ApiTokenReqType;
}

export interface ApiTokenDeleteEvent extends NcBaseEvent {
  userId: string;
  token: string;
}

export interface PluginTestEvent extends NcBaseEvent {
  testBody: PluginTestReqType;
}

export interface PluginEvent extends NcBaseEvent {
  plugin: PluginType;
}

export interface SharedBaseEvent extends NcBaseEvent {
  link?: string;
  base?: BaseType;
}

export interface BaseEvent extends NcBaseEvent {
  source: SourceType;
}

export interface AttachmentEvent extends NcBaseEvent {
  type: 'url' | 'file';
}

export interface FormColumnEvent extends NcBaseEvent {}

export interface GridColumnEvent extends NcBaseEvent {}

export interface MetaDiffEvent extends NcBaseEvent {
  base: BaseType;
  source?: SourceType;
}
export interface UIAclEvent extends NcBaseEvent {
  base: BaseType;
}

export interface SyncSourceEvent extends NcBaseEvent {
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
