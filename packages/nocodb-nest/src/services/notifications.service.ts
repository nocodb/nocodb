import { Injectable } from '@nestjs/common';
import { Notification } from '../models';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type {
  ColumnEvent,
  FilterEvent,
  ProjectInviteEvent,
  SortEvent,
  TableEvent,
  ViewEvent,
  WelcomeEvent,
  WorkspaceEvent,
  WorkspaceInviteEvent,
} from './app-hooks/interfaces';
import type { Project } from '../models';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import {AppEvents} from "nocodb-sdk";

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly appHooks: AppHooksService) {}

  private async hookHandler(event: AppEvents, data: any) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const { project, user, invitedBy } = data as ProjectInviteEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.PROJECT_INVITE,
            body: {
              id: project.id,
              title: project.title,
              type: project.type,
              invited_by: invitedBy.email,
              workspace_id: (project as Project).fk_workspace_id,
            },
          });
        }
        break;
      case AppEvents.PROJECT_CREATE:
      case AppEvents.PROJECT_UPDATE:
      case AppEvents.PROJECT_DELETE:
        {
          const { project, user, invitedBy } = data as ProjectInviteEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: event,
            body: {
              id: project.id,
              title: project.title,
              type: project.type,
              workspace_id: (project as Project).fk_workspace_id,
            },
          });
        }
        break;
      case AppEvents.WORKSPACE_CREATE:
      case AppEvents.WORKSPACE_UPDATE:
      case AppEvents.WORKSPACE_DELETE:
        {
          const { workspace, user } = data as WorkspaceEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: event,
            body: {
              id: workspace.id,
            },
          });
        }
        break;
      case AppEvents.WORKSPACE_INVITE:
        {
          const { workspace, user, invitedBy } = data as WorkspaceInviteEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.WORKSPACE_INVITE,
            body: {
              id: workspace.id,
              invited_by: invitedBy.email,
              title: workspace.title,
            },
          });
        }
        break;
      case AppEvents.WELCOME:
        {
          const { user } = data as WelcomeEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.WELCOME,
            body: {},
          });
        }
        break;
      case AppEvents.FILTER_CREATE:
      case AppEvents.FILTER_UPDATE:
      case AppEvents.FILTER_DELETE:
        {
          // const { filter, user } = data as FilterEvent;
          //
          // await Notification.insert({
          //   fk_user_id: user.id,
          //   type: event,
          //   body: {
          //     id: filter.id,
          //   },
          // });
        }
        break;
      case AppEvents.SORT_CREATE:
      case AppEvents.SORT_UPDATE:
      case AppEvents.SORT_DELETE:
        {
          // const { user, sort } = data as SortEvent;
          //
          // await Notification.insert({
          //   fk_user_id: user.id,
          //   type: event,
          //   body: {
          //     id: sort.id,
          //   },
          // });
        }
        break;
      case AppEvents.TABLE_CREATE:
      case AppEvents.TABLE_UPDATE:
      case AppEvents.TABLE_DELETE:
        {
          const { user, table } = data as TableEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: event,
            body: {
              title: table.title,
              project_id: table.project_id,
              base_id: table.base_id,
              id: table.id,
            },
          });
        }
        break;
      case AppEvents.VIEW_CREATE:
      case AppEvents.VIEW_UPDATE:
      case AppEvents.VIEW_DELETE:
      case AppEvents.SHARED_VIEW_CREATE:
      case AppEvents.SHARED_VIEW_UPDATE:
      case AppEvents.SHARED_VIEW_DELETE:
        {
          const { user, view } = data as ViewEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: event,
            body: {
              title: view.title,
              project_id: view.project_id,
              base_id: view.base_id,
              id: view.id,
              fk_model_id: view.fk_model_id,
            },
          });
        }
        break;
      case AppEvents.COLUMN_CREATE:
      case AppEvents.COLUMN_UPDATE:
      case AppEvents.COLUMN_DELETE:
        {
          const { user, column } = data as ColumnEvent;

          await Notification.insert({
            fk_user_id: user.id,
            type: event,
            body: {
              title: column.title,
              // todo: update in swagger
              project_id: column['project_id'],
              base_id: column.base_id,
              id: column.id,
              fk_model_id: column.fk_model_id,
            },
          });
        }
        break;
    }
  }

  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
    this.appHooks.onAll(this.hookHandler);
  }

  async notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    const list = await Notification.list({
      fk_user_id: param.user.id,
      limit: param.limit,
      offset: param.offset,
      is_read: param.is_read,
      is_deleted: param.is_deleted,
    });

    const count = await Notification.count({
      fk_user_id: param.user.id,
      limit: param.limit,
      offset: param.offset,
      is_read: param.is_read,
      is_deleted: param.is_deleted,
    });

    return new PagedResponseImpl(list, {
      limit: param.limit,
      offset: param.offset,
      count,
    });
  }

  notificationUpdate(param: { notificationId: string; body; user: any }) {
    return Notification.update(
      {
        id: param.notificationId,
        fk_user_id: param.user.id,
      },
      param.body,
    );
  }

  // // soft delete
  // notificationDelete(param: { notificationId: string; user: UserType }) {
  //   return Notification.update(param.notificationId, {
  //     is_deleted: true,
  //   });
  // }

  //   // todo: validation
  //   notificationDelete(param: { notificationId: string; user: UserType }) {
  //     return;
  //   }
}
