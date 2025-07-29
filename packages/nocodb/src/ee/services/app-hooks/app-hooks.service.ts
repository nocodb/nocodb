import { Inject, Injectable } from '@nestjs/common';
import { AppHooksService as ApppHookServiceCE } from 'src/services/app-hooks/app-hooks.service';
import type { AppEvents } from 'nocodb-sdk';
import type {
  ColumnEvent,
  FilterEvent,
  ProjectCreateEvent,
  ProjectDeleteEvent,
  ProjectInviteEvent,
  ProjectUpdateEvent,
  SortEvent,
  TableEvent,
  UserSigninEvent,
  UserSignupEvent,
  ViewEvent,
  WelcomeEvent,
  WorkspaceEvent,
  WorkspaceUserInviteEvent,
} from './interfaces';

import type {
  ApiCreatedEvent,
  ApiTokenCreateEvent,
  ApiTokenDeleteEvent,
  AttachmentEvent,
  BaseDuplicateEvent,
  CalendarViewUpdateEvent,
  ColumnDuplicateEvent,
  ColumnUpdateEvent,
  DashboardCreateEvent,
  DashboardDeleteEvent,
  DashboardDuplicateEvent,
  DashboardUpdateEvent,
  DataExportEvent,
  DataImportEvent,
  FilterUpdateEvent,
  FormColumnEvent,
  FormViewUpdateEvent,
  GalleryViewUpdateEvent,
  GridColumnEvent,
  GridViewUpdateEvent,
  IntegrationEvent,
  IntegrationUpdateEvent,
  KanbanViewUpdateEvent,
  MetaDiffEvent,
  ModelRoleVisibilityEvent,
  OrgUserInviteEvent,
  PluginEvent,
  PluginTestEvent,
  ProjectUserDeleteEvent,
  ProjectUserResendInviteEvent,
  ProjectUserUpdateEvent,
  RelationEvent,
  RowCommentEvent,
  RowMentionEvent,
  ScriptCreateEvent,
  ScriptDeleteEvent,
  ScriptDuplicateEvent,
  ScriptUpdateEvent,
  SharedBaseDeleteEvent,
  SharedBaseEvent,
  SharedDashboardEvent,
  SharedViewUpdateEvent,
  SnapshotDeleteEvent,
  SnapshotEvent,
  SnapshotRestoreEvent,
  SortUpdateEvent,
  SourceEvent,
  SourceUpdateEvent,
  SyncSourceEvent,
  TableDuplicateEvent,
  TableUpdateEvent,
  UserEmailVerificationEvent,
  UserInviteEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
  UserProfileUpdateEvent,
  UserSignoutEvent,
  ViewColumnEvent,
  ViewColumnUpdateEvent,
  ViewCreateEvent,
  ViewDeleteEvent,
  ViewDuplicateEvent,
  ViewUpdateEvent,
  WebhookEvent,
  WebhookUpdateEvent,
  WidgetCreateEvent,
  WidgetDeleteEvent,
  WidgetDuplicateEvent,
  WidgetUpdateEvent,
  WorkspaceRequestUpgradeEvent,
  WorkspaceUpdateEvent,
  WorkspaceUserDeleteEvent,
  WorkspaceUserUpdateEvent,
} from '~/services/app-hooks/interfaces';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

@Injectable()
export class AppHooksService extends ApppHookServiceCE {
  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
  ) {
    super(eventEmitter);
  }

  on(
    event: AppEvents.PROJECT_INVITE,
    listener: (data: ProjectInviteEvent) => void,
  ): () => void;
  on(
    event: AppEvents.PROJECT_CREATE,
    listener: (data: ProjectCreateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.PROJECT_UPDATE,
    listener: (data: ProjectUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.PROJECT_DELETE,
    listener: (data: ProjectDeleteEvent) => void,
  ): () => void;
  on(
    event: AppEvents.USER_SIGNUP,
    listener: (data: UserSignupEvent) => void,
  ): () => void;
  on(
    event: AppEvents.USER_INVITE,
    listener: (data: UserInviteEvent) => void,
  ): () => void;
  on(
    event: AppEvents.USER_SIGNIN,
    listener: (data: UserSigninEvent) => void,
  ): () => void;
  on(
    event: AppEvents.USER_SIGNOUT,
    listener: (data: UserSignoutEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WELCOME,
    listener: (data: WelcomeEvent) => void,
  ): () => void;
  on(
    event: AppEvents.TABLE_CREATE | AppEvents.TABLE_DELETE,
    listener: (data: TableEvent) => void,
  ): () => void;
  on(
    event: AppEvents.TABLE_UPDATE,
    listener: (data: TableUpdateEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.VIEW_UPDATE
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    listener: (data: ViewEvent) => void,
  ): () => void;
  on(
    event: AppEvents.SHARED_VIEW_UPDATE,
    listener: (data: SharedViewUpdateEvent) => void,
  ): void;
  on(
    event: AppEvents.FILTER_DELETE | AppEvents.FILTER_CREATE,
    listener: (data: FilterEvent) => void,
  ): () => void;

  on(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_DELETE
      | AppEvents.SORT_CREATE,
    listener: (data: SortEvent | SortUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.FILTER_UPDATE,
    listener: (data: FilterUpdateEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_DELETE
      | AppEvents.COLUMN_CREATE,
    listener: (data: ColumnEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WORKSPACE_UPDATE,
    listener: (data: WorkspaceUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WORKSPACE_DELETE | AppEvents.WORKSPACE_CREATE,
    listener: (data: WorkspaceEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WORKSPACE_USER_INVITE,
    listener: (data: WorkspaceUserInviteEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    listener: (data: RowCommentEvent) => void,
  ): () => void;

  on(
    event: AppEvents.ROW_USER_MENTION,
    listener: (data: RowMentionEvent) => void,
  ): () => void;

  on(
    event: AppEvents.INTEGRATION_DELETE | AppEvents.INTEGRATION_CREATE,
    listener: (data: IntegrationEvent) => void,
  ): () => void;
  on(
    event: AppEvents.INTEGRATION_UPDATE,
    listener: (data: IntegrationUpdateEvent) => void,
  ): () => void;

  on(
    event: AppEvents.WORKSPACE_UPGRADE_REQUEST,
    listener: (data: WorkspaceRequestUpgradeEvent) => void,
  ): () => void;

  on(
    event: AppEvents.SCRIPT_CREATE,
    listener: (data: ScriptCreateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.SCRIPT_UPDATE,
    listener: (data: ScriptUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.SCRIPT_DELETE,
    listener: (data: ScriptDeleteEvent) => void,
  ): () => void;
  on(
    event: AppEvents.SCRIPT_DUPLICATE,
    listener: (data: ScriptDuplicateEvent) => void,
  ): () => void;

  on(
    event: AppEvents.DASHBOARD_CREATE,
    listener: (data: DashboardCreateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.DASHBOARD_UPDATE,
    listener: (data: DashboardUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.DASHBOARD_DELETE,
    listener: (data: DashboardDeleteEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.DASHBOARD_DUPLICATE_START
      | AppEvents.DASHBOARD_DUPLICATE_FAIL
      | AppEvents.DASHBOARD_DUPLICATE_COMPLETE,
    listener: (data: DashboardDuplicateEvent) => void,
  ): () => void;

  on(
    event:
      | AppEvents.SHARED_DASHBOARD_GENERATE_LINK
      | AppEvents.SHARED_DASHBOARD_DELETE_LINK
      | AppEvents.SHARED_DASHBOARD_UPDATE_LINK,
    listener: (data: SharedDashboardEvent) => void,
  ): () => void;

  on(
    event: AppEvents.WIDGET_CREATE,
    listener: (data: WidgetCreateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WIDGET_UPDATE,
    listener: (data: WidgetUpdateEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WIDGET_DELETE,
    listener: (data: WidgetDeleteEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WIDGET_DUPLICATE,
    listener: (data: WidgetDuplicateEvent) => void,
  ): () => void;

  on(event, listener): () => void {
    return super.on(event, listener);
  }

  emit(event: AppEvents.PROJECT_INVITE, data: ProjectInviteEvent): void;
  emit(event: AppEvents.PROJECT_CREATE, data: ProjectCreateEvent): void;
  emit(event: AppEvents.PROJECT_DELETE, data: ProjectDeleteEvent): void;
  emit(event: AppEvents.PROJECT_UPDATE, data: ProjectUpdateEvent): void;
  emit(event: AppEvents.USER_SIGNUP, data: UserSignupEvent): void;
  emit(event: AppEvents.USER_INVITE, data: UserInviteEvent): void;
  emit(event: AppEvents.USER_SIGNIN, data: UserSigninEvent): void;
  emit(event: AppEvents.USER_SIGNOUT, data: UserSignoutEvent): void;
  emit(event: AppEvents.APIS_CREATED, data: ApiCreatedEvent): void;
  emit(
    event: AppEvents.USER_PASSWORD_CHANGE,
    data: UserPasswordChangeEvent,
  ): void;
  emit(
    event: AppEvents.USER_PASSWORD_FORGOT,
    data: UserPasswordForgotEvent,
  ): void;
  emit(
    event: AppEvents.USER_PASSWORD_RESET,
    data: UserPasswordResetEvent,
  ): void;
  emit(
    event: AppEvents.WORKSPACE_USER_INVITE,
    data: WorkspaceUserInviteEvent,
  ): void;
  emit(
    event: AppEvents.WORKSPACE_USER_UPDATE,
    data: WorkspaceUserUpdateEvent,
  ): void;
  emit(
    event: AppEvents.WORKSPACE_USER_DELETE,
    data: WorkspaceUserDeleteEvent,
  ): void;
  emit(
    event: AppEvents.WORKSPACE_UPGRADE_REQUEST,
    data: WorkspaceRequestUpgradeEvent,
  ): void;
  emit(event: AppEvents.WELCOME, data: WelcomeEvent): void;
  emit(
    event: AppEvents.PROJECT_USER_UPDATE,
    data: ProjectUserUpdateEvent,
  ): void;
  emit(
    event: AppEvents.PROJECT_USER_RESEND_INVITE,
    data: ProjectUserResendInviteEvent,
  ): void;
  emit(
    event:
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_UPDATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    data: ViewEvent,
  ): void;
  emit(event: AppEvents.VIEW_UPDATE, data: ViewUpdateEvent): void;
  emit(event: AppEvents.SHARED_VIEW_UPDATE, data: SharedViewUpdateEvent): void;
  emit(
    event: AppEvents.FILTER_DELETE | AppEvents.FILTER_CREATE,
    data: FilterEvent,
  ): void;
  emit(event: AppEvents.FILTER_UPDATE, data: FilterUpdateEvent): void;
  emit(
    event: AppEvents.TABLE_CREATE | AppEvents.TABLE_DELETE,
    data: TableEvent,
  ): void;
  emit(event: AppEvents.TABLE_UPDATE, data: TableUpdateEvent): void;

  emit(
    event: AppEvents.SORT_CREATE | AppEvents.SORT_DELETE,
    data: SortEvent,
  ): void;
  emit(event: AppEvents.SORT_UPDATE, data: SortUpdateEvent): void;
  emit(
    event: AppEvents.WORKSPACE_CREATE | AppEvents.WORKSPACE_DELETE,
    data: WorkspaceEvent,
  ): void;
  emit(event: AppEvents.WORKSPACE_UPDATE, data: WorkspaceUpdateEvent): void;
  emit(
    event: AppEvents.COLUMN_CREATE | AppEvents.COLUMN_DELETE,
    data: ColumnEvent,
  ): void;
  emit(event: AppEvents.COLUMN_UPDATE, data: ColumnUpdateEvent): void;
  emit(
    event:
      | AppEvents.WEBHOOK_CREATE
      | AppEvents.WEBHOOK_DELETE
      | AppEvents.WEBHOOK_TEST
      | AppEvents.WEBHOOK_TRIGGER,
    data: WebhookEvent,
  ): void;

  emit(event: AppEvents.WEBHOOK_UPDATE, data: WebhookUpdateEvent): void;

  emit(
    event:
      | AppEvents.SYNC_SOURCE_UPDATE
      | AppEvents.SYNC_SOURCE_CREATE
      | AppEvents.SYNC_SOURCE_DELETE,
    data: SyncSourceEvent,
  ): void;
  emit(event: AppEvents.API_TOKEN_CREATE, data: ApiTokenCreateEvent): void;
  emit(event: AppEvents.API_TOKEN_DELETE, data: ApiTokenDeleteEvent): void;
  emit(event: AppEvents.ORG_USER_INVITE, data: OrgUserInviteEvent): void;
  emit(event: AppEvents.ORG_USER_RESEND_INVITE, data: OrgUserInviteEvent): void;
  emit(event: AppEvents.VIEW_COLUMN_CREATE, data: ViewColumnEvent): void;
  emit(event: AppEvents.VIEW_COLUMN_UPDATE, data: ViewColumnUpdateEvent): void;
  emit(
    event: AppEvents.RELATION_DELETE | AppEvents.RELATION_CREATE,
    data: RelationEvent,
  ): void;
  emit(event: AppEvents.PLUGIN_TEST, data: PluginTestEvent): void;
  emit(
    event: AppEvents.PLUGIN_INSTALL | AppEvents.PLUGIN_UNINSTALL,
    data: PluginEvent,
  ): void;
  emit(event: AppEvents.SHARED_BASE_GENERATE_LINK, data: SharedBaseEvent): void;
  emit(
    event: AppEvents.SHARED_BASE_DELETE_LINK,
    data: SharedBaseDeleteEvent,
  ): void;
  emit(
    event: AppEvents.SOURCE_DELETE | AppEvents.SOURCE_CREATE,
    data: SourceEvent,
  ): void;
  emit(event: AppEvents.SOURCE_UPDATE, data: SourceUpdateEvent): void;
  emit(event: AppEvents.ATTACHMENT_UPLOAD, data: AttachmentEvent): void;
  emit(event: AppEvents.FORM_COLUMN_UPDATE, data: FormColumnEvent): void;
  emit(event: AppEvents.GRID_COLUMN_UPDATE, data: GridColumnEvent): void;
  emit(event: AppEvents.META_DIFF_SYNC, data: MetaDiffEvent): void;
  emit(event: AppEvents.ORG_API_TOKEN_CREATE, data: ApiTokenCreateEvent): void;
  emit(event: AppEvents.ORG_API_TOKEN_DELETE, data: ApiTokenDeleteEvent): void;
  emit(
    event: AppEvents.USER_EMAIL_VERIFICATION,
    data: UserEmailVerificationEvent,
  ): void;
  emit(event: AppEvents.EXTENSION_CREATE, data: any): void;
  emit(event: AppEvents.EXTENSION_UPDATE, data: any): void;
  emit(event: AppEvents.EXTENSION_DELETE, data: any): void;
  emit(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    data: RowCommentEvent,
  ): void;
  emit(event: AppEvents.ROW_USER_MENTION, data: RowMentionEvent): void;
  emit(
    event: AppEvents.INTEGRATION_CREATE | AppEvents.INTEGRATION_DELETE,
    data: IntegrationEvent,
  ): void;
  emit(event: AppEvents.INTEGRATION_UPDATE, data: IntegrationUpdateEvent): void;
  emit(
    event:
      | AppEvents.FORM_CREATE
      | AppEvents.GRID_CREATE
      | AppEvents.CALENDAR_CREATE
      | AppEvents.GALLERY_CREATE
      | AppEvents.KANBAN_CREATE
      | AppEvents.MAP_CREATE,
    data: ViewCreateEvent,
  ): void;
  emit(
    event:
      | AppEvents.FORM_DELETE
      | AppEvents.GRID_DELETE
      | AppEvents.CALENDAR_DELETE
      | AppEvents.GALLERY_DELETE
      | AppEvents.KANBAN_DELETE
      | AppEvents.MAP_DELETE,
    data: ViewDeleteEvent,
  ): void;
  emit(
    event:
      | AppEvents.FORM_UPDATE
      | AppEvents.GRID_UPDATE
      | AppEvents.CALENDAR_UPDATE
      | AppEvents.GALLERY_UPDATE
      | AppEvents.KANBAN_UPDATE
      | AppEvents.MAP_UPDATE,
    data:
      | ViewUpdateEvent
      | GridViewUpdateEvent
      | GalleryViewUpdateEvent
      | KanbanViewUpdateEvent
      | CalendarViewUpdateEvent
      | FormViewUpdateEvent,
  ): void;
  emit(
    event:
      | AppEvents.BASE_DUPLICATE_START
      | AppEvents.BASE_DUPLICATE_FAIL
      | AppEvents.BASE_DUPLICATE_COMPLETE,
    data: BaseDuplicateEvent,
  ): void;
  emit(
    event:
      | AppEvents.TABLE_DUPLICATE_START
      | AppEvents.TABLE_DUPLICATE_FAIL
      | AppEvents.TABLE_DUPLICATE_COMPLETE,
    data: TableDuplicateEvent,
  ): void;
  emit(
    event:
      | AppEvents.COLUMN_DUPLICATE_START
      | AppEvents.COLUMN_DUPLICATE_FAIL
      | AppEvents.COLUMN_DUPLICATE_COMPLETE,
    data: ColumnDuplicateEvent,
  ): void;
  emit(
    event:
      | AppEvents.VIEW_DUPLICATE_START
      | AppEvents.VIEW_DUPLICATE_FAIL
      | AppEvents.VIEW_DUPLICATE_COMPLETE,
    data: ViewDuplicateEvent,
  ): void;

  emit(
    event: AppEvents.PROJECT_USER_DELETE,
    data: ProjectUserDeleteEvent,
  ): void;
  emit(event: AppEvents.UI_ACL, data: ModelRoleVisibilityEvent): void;
  emit(event: AppEvents.WEBHOOK_TEST, data: WebhookEvent): void;
  emit(event: AppEvents.SNAPSHOT_CREATE, data: SnapshotEvent): void;
  emit(event: AppEvents.SNAPSHOT_DELETE, data: SnapshotDeleteEvent): void;
  emit(event: AppEvents.SNAPSHOT_RESTORE, data: SnapshotRestoreEvent): void;
  emit(event: AppEvents.DATA_EXPORT, data: DataExportEvent): void;
  emit(event: AppEvents.DATA_IMPORT, data: DataImportEvent): void;

  emit(event: AppEvents.SCRIPT_CREATE, data: ScriptCreateEvent): void;
  emit(event: AppEvents.SCRIPT_UPDATE, data: ScriptUpdateEvent): void;
  emit(event: AppEvents.SCRIPT_DELETE, data: ScriptDeleteEvent): void;
  emit(event: AppEvents.SCRIPT_DUPLICATE, data: ScriptDuplicateEvent): void;

  emit(event: AppEvents.DASHBOARD_CREATE, data: DashboardCreateEvent): void;
  emit(event: AppEvents.DASHBOARD_UPDATE, data: DashboardUpdateEvent): void;
  emit(event: AppEvents.DASHBOARD_DELETE, data: DashboardDeleteEvent): void;
  emit(
    event:
      | AppEvents.DASHBOARD_DUPLICATE_START
      | AppEvents.DASHBOARD_DUPLICATE_FAIL
      | AppEvents.DASHBOARD_DUPLICATE_COMPLETE,
    data: DashboardDuplicateEvent,
  ): void;

  emit(
    event:
      | AppEvents.SHARED_DASHBOARD_DELETE_LINK
      | AppEvents.SHARED_DASHBOARD_GENERATE_LINK
      | AppEvents.SHARED_DASHBOARD_UPDATE_LINK,
    data: SharedDashboardEvent,
  ): void;

  emit(event: AppEvents.WIDGET_CREATE, data: WidgetCreateEvent): void;
  emit(event: AppEvents.WIDGET_UPDATE, data: WidgetUpdateEvent): void;
  emit(event: AppEvents.WIDGET_DELETE, data: WidgetDeleteEvent): void;
  emit(event: AppEvents.WIDGET_DUPLICATE, data: WidgetDuplicateEvent): void;

  emit(
    event: AppEvents.USER_PROFILE_UPDATE,
    data: UserProfileUpdateEvent,
  ): void;
  emit(event, data): void {
    return super.emit(event, data);
  }
}
