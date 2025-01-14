import { Inject, Injectable } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import type { AppEvents } from 'nocodb-sdk';
import type {
  ApiCreatedEvent,
  ApiTokenCreateEvent,
  ApiTokenDeleteEvent,
  AttachmentEvent,
  BaseDuplicateEvent,
  CalendarViewUpdateEvent,
  ColumnDuplicateEvent,
  ColumnEvent,
  ColumnUpdateEvent,
  DataExportEvent,
  DataImportEvent,
  FilterEvent,
  FilterUpdateEvent,
  FormColumnEvent,
  FormViewUpdateEvent,
  GalleryViewUpdateEvent,
  GridColumnEvent,
  GridViewUpdateEvent,
  IntegrationUpdateEvent,
  KanbanViewUpdateEvent,
  MetaDiffEvent,
  OrgUserInviteEvent,
  PluginEvent,
  PluginTestEvent,
  ProjectCreateEvent,
  ProjectDeleteEvent,
  ProjectInviteEvent,
  ProjectUpdateEvent,
  ProjectUserResendInviteEvent,
  ProjectUserUpdateEvent,
  RelationEvent,
  RowCommentEvent,
  SharedBaseDeleteEvent,
  SharedBaseEvent,
  SharedViewUpdateEvent,
  SortEvent,
  SortUpdateEvent,
  SourceEvent,
  SourceUpdateEvent,
  SyncSourceEvent,
  TableDuplicateEvent,
  TableEvent,
  TableUpdateEvent,
  UIAclEvent,
  UserEmailVerificationEvent,
  UserInviteEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
  UserProfileUpdateEvent,
  UserSigninEvent,
  UserSignoutEvent,
  UserSignupEvent,
  ViewColumnEvent,
  ViewColumnUpdateEvent,
  ViewCreateEvent,
  ViewDeleteEvent,
  ViewDuplicateEvent,
  ViewEvent,
  ViewUpdateEvent,
  WebhookEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { IntegrationEvent } from '~/services/app-hooks/interfaces';
import type { RowMentionEvent } from '~/services/app-hooks/interfaces';
import type { WebhookUpdateEvent } from '~/services/app-hooks/interfaces';
import type { ProjectUserDeleteEvent } from '~/services/app-hooks/interfaces';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

const ALL_EVENTS = '__nc_all_events__';

@Injectable()
export class AppHooksService {
  logger = new Logger('AppHooksService');

  protected listenerUnsubscribers: Map<(...args: any[]) => void, () => void> =
    new Map();

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
  ) {}

  on(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    listener: (data: RowCommentEvent) => void,
  ): () => void;
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
    event: AppEvents.FILTER_UPDATE,
    listener: (data: FilterUpdateEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_DELETE
      | AppEvents.SORT_CREATE,
    listener: (data: SortEvent | SortUpdateEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_DELETE
      | AppEvents.COLUMN_CREATE,
    listener: (data: ColumnEvent) => void,
  ): () => void;

  on(
    event: AppEvents.ROW_USER_MENTION,
    listener: (data: RowMentionEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.INTEGRATION_UPDATE
      | AppEvents.INTEGRATION_DELETE
      | AppEvents.INTEGRATION_CREATE,
    listener: (data: IntegrationEvent) => void,
  ): () => void;
  on(event, listener): () => void {
    const unsubscribe = this.eventEmitter.on(event, listener);

    this.listenerUnsubscribers.set(listener, unsubscribe);

    return unsubscribe;
  }

  emit(event: AppEvents.PROJECT_INVITE, data: ProjectInviteEvent): void;
  emit(event: AppEvents.PROJECT_CREATE, data: ProjectCreateEvent): void;
  emit(event: AppEvents.PROJECT_DELETE, data: ProjectDeleteEvent): void;
  emit(event: AppEvents.PROJECT_UPDATE, data: ProjectUpdateEvent): void;
  emit(event: AppEvents.USER_SIGNUP, data: UserSignupEvent): void;
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
  emit(event: AppEvents.WELCOME, data: WelcomeEvent): void;
  emit(
    event: AppEvents.PROJECT_USER_UPDATE,
    data: ProjectUserUpdateEvent,
  ): void;
  emit(
    event: AppEvents.PROJECT_USER_DELETE,
    data: ProjectUserDeleteEvent,
  ): void;
  emit(
    event: AppEvents.PROJECT_USER_RESEND_INVITE,
    data: ProjectUserResendInviteEvent,
  ): void;
  emit(event: AppEvents.SHARED_VIEW_UPDATE, data: SharedViewUpdateEvent): void;
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
  emit(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    data: RowCommentEvent,
  ): void;
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
    event: AppEvents.COLUMN_CREATE | AppEvents.COLUMN_DELETE,
    data: ColumnEvent,
  ): void;
  emit(event: AppEvents.COLUMN_UPDATE, data: ColumnUpdateEvent): void;
  emit(
    event:
      | AppEvents.WEBHOOK_CREATE
      | AppEvents.WEBHOOK_DELETE
      | AppEvents.WEBHOOK_TRIGGER
      | AppEvents.WEBHOOK_TEST,
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
  emit(event: AppEvents.UI_ACL, data: UIAclEvent): void;
  emit(event: AppEvents.ORG_API_TOKEN_CREATE, data: ApiTokenCreateEvent): void;
  emit(event: AppEvents.ORG_API_TOKEN_DELETE, data: ApiTokenDeleteEvent): void;
  emit(
    event: AppEvents.USER_EMAIL_VERIFICATION,
    data: UserEmailVerificationEvent,
  ): void;
  emit(event: AppEvents.ROW_USER_MENTION, data: RowMentionEvent): void;

  emit(event: AppEvents.EXTENSION_CREATE, data: any): void;
  emit(event: AppEvents.EXTENSION_UPDATE, data: any): void;
  emit(event: AppEvents.EXTENSION_DELETE, data: any): void;

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
  emit(event: AppEvents.WEBHOOK_TEST, data: WebhookEvent): void;
  emit(
    event: AppEvents.USER_PROFILE_UPDATE,
    data: UserProfileUpdateEvent,
  ): void;
  emit(event: AppEvents.DATA_EXPORT, data: DataExportEvent): void;
  emit(event: AppEvents.DATA_IMPORT, data: DataImportEvent): void;

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
  emit(event, data): void {
    this.eventEmitter.emit(event, data);
    this.eventEmitter.emit(ALL_EVENTS, { event, data: data });
  }

  removeListener(
    event: AppEvents | 'notification',
    listener: (args: any) => void,
  ) {
    this.listenerUnsubscribers.get(listener)?.();
    this.listenerUnsubscribers.delete(listener);
  }

  removeListeners(event: AppEvents | 'notification') {
    return this.eventEmitter.removeAllListeners(event);
  }

  removeAllListener(listener) {
    this.listenerUnsubscribers.get(listener)?.();
    this.listenerUnsubscribers.delete(listener);
  }

  onAll(
    listener: (payload: {
      event: AppEvents | 'notification';
      data: any;
    }) => void | Promise<void>,
  ) {
    const unsubscribe = this.eventEmitter.on(ALL_EVENTS, async (...args) => {
      try {
        await listener(...args);
      } catch (e) {
        this.logger.error(e?.message, e?.stack);
      }
    });
    this.listenerUnsubscribers.set(listener, unsubscribe);
    return unsubscribe;
  }
}
