import { Injectable } from '@nestjs/common';
import type { AppEvents, NotificationType } from 'nocodb-sdk';
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

@Injectable()
export class AppHooksService {
  private listeners = new Map<string, ((...args: any[]) => void)[]>();
  private allListeners: ((...args: any[]) => void)[] = [];

  on(
    event: AppEvents.PROJECT_INVITE,
    listener: (data: ProjectInviteEvent) => void,
  ): void;
  on(
    event: AppEvents.PROJECT_CREATE,
    listener: (data: ProjectCreateEvent) => void,
  ): void;
  on(
    event: AppEvents.PROJECT_UPDATE,
    listener: (data: ProjectUpdateEvent) => void,
  ): void;
  on(
    event: AppEvents.PROJECT_DELETE,
    listener: (data: ProjectDeleteEvent) => void,
  ): void;
  on(
    event: AppEvents.USER_SIGNUP,
    listener: (data: UserSignupEvent) => void,
  ): void;
  on(
    event: AppEvents.USER_SIGNIN,
    listener: (data: UserSigninEvent) => void,
  ): void;
  on(event: AppEvents.WELCOME, listener: (data: WelcomeEvent) => void): void;
  on(
    event:
      | AppEvents.TABLE_CREATE
      | AppEvents.TABLE_DELETE
      | AppEvents.TABLE_UPDATE,
    listener: (data: TableEvent) => void,
  ): void;
  on(
    event:
      | AppEvents.VIEW_UPDATE
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_UPDATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    listener: (data: ViewEvent) => void,
  ): void;
  on(
    event:
      | AppEvents.FILTER_UPDATE
      | AppEvents.FILTER_DELETE
      | AppEvents.FILTER_CREATE,
    listener: (data: FilterEvent) => void,
  ): void;
  on(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_DELETE
      | AppEvents.SORT_CREATE,
    listener: (data: SortEvent) => void,
  ): void;
  on(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_DELETE
      | AppEvents.COLUMN_CREATE,
    listener: (data: ColumnEvent) => void,
  ): void;
  on(
    event:
      | AppEvents.WORKSPACE_UPDATE
      | AppEvents.WORKSPACE_DELETE
      | AppEvents.WORKSPACE_CREATE,
    listener: (data: WorkspaceEvent) => void,
  ): void;
  // todo: remove this, it's a temporary hack
  on(event: 'notification', listener: (data: NotificationType) => void): void;
  on(event, listener): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event: AppEvents.PROJECT_INVITE, data: ProjectInviteEvent): void;
  emit(event: AppEvents.PROJECT_CREATE, data: ProjectCreateEvent): void;
  emit(event: AppEvents.PROJECT_DELETE, data: ProjectDeleteEvent): void;
  emit(event: AppEvents.PROJECT_UPDATE, data: ProjectUpdateEvent): void;
  emit(event: AppEvents.USER_SIGNUP, data: UserSignupEvent): void;
  emit(event: AppEvents.USER_SIGNIN, data: UserSigninEvent): void;
  emit(event: AppEvents.WORKSPACE_INVITE, data: WorkspaceInviteEvent): void;
  emit(event: AppEvents.WELCOME, data: WelcomeEvent): void;
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
  // todo: remove this, it's a temporary hack
  emit(event: 'notification', data: NotificationType): void;
  emit(event, arg): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => listener(arg));
    this.allListeners.forEach((listener) => listener(event, arg));
  }

  removeListener(
    event: AppEvents | 'notification',
    listener: (...args: any[]) => void,
  ) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  removeAllListeners(event: AppEvents | 'notification') {
    this.listeners.delete(event);
  }

  onAll(listener: (event: AppEvents | 'notification', ...args: any[]) => void) {
    this.allListeners.push(listener);
  }

  removeAllListener(listener: (...args: any[]) => void) {
    const allIndex = this.allListeners.indexOf(listener);
    if (allIndex > -1) {
      this.allListeners.splice(allIndex, 1);
    }
  }
}
