import type { SyncSource } from '~/models';
import type {
  BaseType,
  ColumnType,
  CommentType,
  FilterType,
  HookType,
  IntegrationType,
  PluginTestReqType,
  PluginType,
  ProjectRoles,
  ProjectUserReqType,
  SortType,
  SourceType,
  TableType,
  UserType,
  ViewType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { CustomUrl } from '~/models';

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface NcBaseEvent {
  context: NcContext;
  req: NcRequest;
  clientId?: string;
}

export interface ProjectInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  invitedBy: UserType;
  role: ProjectRoles | string;
}

export interface RowCommentEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  model: TableType;
  rowId: string;
  comment: CommentType;
  ip?: string;
}

export interface RowMentionEvent extends NcBaseEvent {
  model: TableType;
  rowId: string;
  user: UserType;
  column: ColumnType;
  mentions: string[];
}

export interface ProjectUserUpdateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: Partial<ProjectUserReqType>;
  oldBaseUser: Partial<ProjectUserReqType>;
}
export interface UserProfileUpdateEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
  oldUser: Partial<UserType>;
}

export interface ProjectUserDeleteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

export interface ProjectUserResendInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
}

export interface ProjectCreateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  xcdb: boolean;
}

export interface ProjectUpdateEvent extends NcBaseEvent {
  base: BaseType;
  updateObj: Record<string, any>;
  oldBaseObj: BaseType;
  user: UserType;
}

export interface TableUpdateEvent extends NcBaseEvent {
  table: Partial<TableType>;
  prevTable: TableType;
}

export interface ProjectDeleteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

export interface WelcomeEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserSignupEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserInviteEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
  role: string;
  workspaceInvite?: boolean;
  workspaceId?: string;
}

export interface UserSigninEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserSignoutEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface ApiCreatedEvent extends NcBaseEvent {
  info: any;
}

export interface UserPasswordChangeEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserPasswordForgotEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserPasswordResetEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface UserEmailVerificationEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

export interface TableEvent extends NcBaseEvent {
  table: TableType;
  user: UserType;
  source?: SourceType;
}

export interface ViewEvent extends NcBaseEvent {
  view: ViewType;
  user?: UserType;
}

export interface ViewCreateEvent extends NcBaseEvent {
  view: ViewType;
  owner: UserType;
  user?: UserType;
}
export interface ViewDeleteEvent extends NcBaseEvent {
  view: ViewType;
  owner: UserType;
  user?: UserType;
}

export interface SharedViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  sharedView: any;
  oldSharedView: any;
  user?: UserType;
}

export interface ViewUpdateEvent extends ViewEvent {
  oldView: ViewType;
  owner: UserType;
}

export interface FormViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  formView: any;
  oldFormView: any;
}

export interface GridViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  gridView: any;
  oldGridView: any;
  owner: UserType;
}

export interface KanbanViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  kanbanView: any;
  oldKanbanView: any;
  owner: UserType;
}

export interface GalleryViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  galleryView: any;
  oldGalleryView: any;
  owner: UserType;
}

export interface CalendarViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  calendarView: any;
  oldCalendarView: any;
  owner: UserType;
}

export interface FormViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  formView: any;
  oldFormView: any;
  owner: UserType;
}

type FilterEventAdditionalProp =
  | {
      hook: HookType;
    }
  | {
      view: ViewType;
    }
  | {
      linkColumn: ColumnType;
    };

export type FilterEvent = NcBaseEvent & {
  filter: FilterType;
  ip?: string;
  column?: ColumnType;
} & FilterEventAdditionalProp;

export type FilterUpdateEvent = FilterEvent & {
  oldFilter: FilterType;
};

export interface ColumnEvent extends NcBaseEvent {
  table: TableType;
  columnId: string;
  column: ColumnType;
  columns: ColumnType[];
}

export interface ColumnUpdateEvent extends ColumnEvent {
  oldColumn: ColumnType;
}

export interface SortEvent extends NcBaseEvent {
  sort: SortType;
  ip?: string;
  view: ViewType;
  column: ColumnType;
}

export interface SortUpdateEvent extends SortEvent {
  oldSort: SortType;
}

export interface OrgUserInviteEvent extends Omit<NcBaseEvent, 'context'> {
  user: UserType;
  count?: number;
  context?: NcContext;
}

export interface ViewColumnEvent extends NcBaseEvent {
  viewColumn: any;
  view: ViewType;
  column: ColumnType;
}

export interface ViewColumnUpdateEvent extends ViewColumnEvent {
  oldViewColumn: any;
  internal?: boolean;
}

export interface RelationEvent extends NcBaseEvent {
  column: ColumnType;
}

export interface WebhookEvent extends NcBaseEvent {
  hook: HookType;
  tableId: string;
}

export interface WebhookUpdateEvent extends WebhookEvent {
  oldHook: HookType;
}

export interface WebhookTriggerEvent extends NcBaseEvent {
  hook: HookType;
  data: any;
}

export interface ApiTokenCreateEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenId: string;
  tokenTitle: string;
}

export interface ApiTokenUpdateEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenTitle: string;
  oldTokenTitle: string;
}

export interface ApiTokenDeleteEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenId: string;
  tokenTitle: string;
}

export interface PluginTestEvent extends Optional<NcBaseEvent, 'context'> {
  testBody: PluginTestReqType;
}

export interface PluginEvent extends Optional<NcBaseEvent, 'context'> {
  plugin: PluginType;
}

export interface SharedBaseEvent extends NcBaseEvent {
  link?: string;
  base?: BaseType;
  sharedBaseRole: string;
  uuid: string;
  customUrl?: CustomUrl;
}

export interface SharedBaseDeleteEvent
  extends Omit<SharedBaseEvent, 'sharedBaseRole'> {}

export interface SourceEvent extends NcBaseEvent {
  source: SourceType;
  integration: IntegrationType;
}

export interface AttachmentEvent extends Optional<NcBaseEvent, 'context'> {
  type: 'url' | 'file';
}

export interface FormColumnEvent extends NcBaseEvent {
  formColumn: any;
}

export interface GridColumnEvent extends NcBaseEvent {}

export interface MetaDiffEvent extends NcBaseEvent {
  base: BaseType;
  source?: SourceType;
}

export interface UIAclEvent extends NcBaseEvent {
  base: any;
  role: string;
  view: any;
  disabled: boolean;
}

export interface SyncSourceEvent extends NcBaseEvent {
  syncSource: Partial<SyncSource>;
}

export interface IntegrationEvent extends Optional<NcBaseEvent, 'context'> {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

export interface SourceUpdateEvent extends SourceEvent {
  oldSource: Partial<SourceType>;
}

export interface BaseDuplicateEvent extends NcBaseEvent {
  sourceBase: BaseType;
  destBase?: BaseType;
  user: UserType;
  id?: string;
  error?: string;
  options?: unknown;
}

export interface TableDuplicateEvent extends NcBaseEvent {
  sourceTable: TableType;
  destTable?: TableType;
  user: UserType;
  id?: string;
  error?: string;
  title?: string;
  options?: unknown;
}

export interface ColumnDuplicateEvent extends NcBaseEvent {
  table: TableType;
  sourceColumn: ColumnType;
  destColumn?: ColumnType;
  user: UserType;
  id?: string;
  error?: string;
  options?: unknown;
}

export interface ViewDuplicateEvent extends NcBaseEvent {
  sourceView: ViewType;
  destView?: ViewType;
  id?: string;
  error?: string;
}

export interface ModelRoleVisibilityEvent extends NcBaseEvent {
  view: ViewType;
  role: string;
  disabled: boolean;
}

export interface DataImportEvent extends NcBaseEvent {
  view: ViewType;
  table: TableType;
  type: 'excel' | 'csv';
  id: string;
}

export interface IntegrationEvent extends Optional<NcBaseEvent, 'context'> {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

export interface IntegrationUpdateEvent extends IntegrationEvent {
  oldIntegration: IntegrationType;
}

export interface DataExportEvent extends NcBaseEvent {
  view: ViewType;
  table: TableType;
  type: 'excel' | 'csv';
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
  | RowCommentEvent
  | RowMentionEvent
  | WebhookTriggerEvent
  | ColumnEvent;
