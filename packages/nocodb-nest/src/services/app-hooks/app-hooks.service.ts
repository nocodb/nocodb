import { Injectable } from '@nestjs/common';
import type {
  AppEventPayload,
  ProjectCreateEvent,
  ProjectDeleteEvent,
  ProjectInviteEvent,
  ProjectUpdateEvent,
  TableEvent,
  UserSigninEvent,
  UserSignupEvent,
  ViewEvent,
  WelcomeEvent,
  WorkspaceInviteEvent,
} from './interfaces';

// todo: move to nocodb-sdk
export enum AppEvents {
  PROJECT_CREATE = 'project.create',
  PROJECT_INVITE = 'project.invite',
  PROJECT_DELETE = 'project.delete',
  PROJECT_UPDATE = 'project.update',
  PROJECT_CLONE = 'project.clone',

  WELCOME = 'app.welcome',

  WORKSPACE_CREATE = 'workspace.create',
  WORKSPACE_INVITE = 'workspace.invite',
  WORKSPACE_DELETE = 'workspace.delete',
  WORKSPACE_UPDATE = 'workspace.update',

  USER_SIGNUP = 'user.signup',
  USER_SIGNIN = 'user.signin',
  USER_UPDATE = 'user.update',
  USER_PASSWORD_RESET = 'user.password.reset',
  USER_PASSWORD_CHANGE = 'user.password.change',
  USER_DELETE = 'user.delete',

  TABLE_CREATE = 'table.create',
  TABLE_DELETE = 'table.delete',
  TABLE_UPDATE = 'table.update',

  VIEW_CREATE = 'view.create',
  VIEW_DELETE = 'view.delete',
  VIEW_UPDATE = 'view.update',

  SHARED_VIEW_CREATE = 'shared.view.create',
  SHARED_VIEW_DELETE = 'shared.view.delete',
  SHARED_VIEW_UPDATE = 'shared.view.update',

  FILE_CREATE = 'file.create',
  FILE_DELETE = 'file.delete',
  FILE_UPDATE = 'file.update',

  SORT_CREATE = 'sort.create',
  SORT_DELETE = 'sort.delete',
  SORT_UPDATE = 'sort.update',
}

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
  on(event: AppEvents, listener: (...args: any[]) => void): void {
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
      | AppEvents.TABLE_UPDATE
      | AppEvents.TABLE_CREATE
      | AppEvents.TABLE_DELETE,
    data: TableEvent,
  ): void;
  emit(event, arg): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => listener(arg));
    this.allListeners.forEach((listener) => listener(event, arg));
  }

  removeListener(event: AppEvents, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  removeAllListeners(event: AppEvents) {
    this.listeners.delete(event);
  }

  onAll(listener: (event: AppEvents, ...args: any[]) => void) {
    this.allListeners.push(listener);
  }

  removeAllListener(listener: (...args: any[]) => void) {
    const allIndex = this.allListeners.indexOf(listener);
    if (allIndex > -1) {
      this.allListeners.splice(allIndex, 1);
    }
  }
}
