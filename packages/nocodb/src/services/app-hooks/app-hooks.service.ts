import { Inject, Injectable } from '@nestjs/common';
import { IEventEmitter } from '../../modules/event-emitter/event-emitter.interface';
import type {
  ProjectUserResendInviteEvent,
  ProjectUserUpdateEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
} from './interfaces';
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
  WorkspaceInviteEvent,
} from './interfaces';

const ALL_EVENTS = '__nc_all_events__';

@Injectable()
export class AppHooksService {
  private listenerUnsubscribers: Map<(...args: any[]) => void, () => void> =
    new Map();

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
  ) {}

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
    event: AppEvents.USER_SIGNIN,
    listener: (data: UserSigninEvent) => void,
  ): () => void;
  on(
    event: AppEvents.WELCOME,
    listener: (data: WelcomeEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.TABLE_CREATE
      | AppEvents.TABLE_DELETE
      | AppEvents.TABLE_UPDATE,
    listener: (data: TableEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.VIEW_UPDATE
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_UPDATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    listener: (data: ViewEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.FILTER_UPDATE
      | AppEvents.FILTER_DELETE
      | AppEvents.FILTER_CREATE,
    listener: (data: FilterEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_DELETE
      | AppEvents.SORT_CREATE,
    listener: (data: SortEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_DELETE
      | AppEvents.COLUMN_CREATE,
    listener: (data: ColumnEvent) => void,
  ): () => void;
  on(
    event:
      | AppEvents.WORKSPACE_UPDATE
      | AppEvents.WORKSPACE_DELETE
      | AppEvents.WORKSPACE_CREATE,
    listener: (data: WorkspaceEvent) => void,
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
  emit(event: AppEvents.WORKSPACE_INVITE, data: WorkspaceInviteEvent): void;
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
      | AppEvents.VIEW_UPDATE
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_UPDATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    data: ViewEvent,
  ): void;
  emit(
    event:
      | AppEvents.FILTER_UPDATE
      | AppEvents.FILTER_DELETE
      | AppEvents.FILTER_CREATE,
    data: FilterEvent,
  ): void;
  emit(
    event:
      | AppEvents.TABLE_UPDATE
      | AppEvents.TABLE_CREATE
      | AppEvents.TABLE_DELETE,
    data: TableEvent,
  ): void;
  emit(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_CREATE
      | AppEvents.SORT_DELETE,
    data: SortEvent,
  ): void;
  emit(
    event:
      | AppEvents.WORKSPACE_UPDATE
      | AppEvents.WORKSPACE_CREATE
      | AppEvents.WORKSPACE_DELETE,
    data: WorkspaceEvent,
  ): void;
  emit(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_CREATE
      | AppEvents.COLUMN_DELETE,
    data: ColumnEvent,
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
    }) => void,
  ) {
    const unsubscribe = this.eventEmitter.on(ALL_EVENTS, listener);
    this.listenerUnsubscribers.set(listener, unsubscribe);
    return unsubscribe;
  }
}
