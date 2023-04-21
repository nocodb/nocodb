import { Injectable } from '@nestjs/common';
import { Notification } from '../models';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { AppEvents, AppHooksService } from './app-hooks.service';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly appHooks: AppHooksService) {}

  private async hookHandler(event: AppEvents, data: any) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const { project, user } = data;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.PROJECT_INVITE,
            body: {
              id: project.id,
              title: project.title,
            },
          });
        }
        break;
      case AppEvents.WORKSPACE_INVITE:
        {
          const { workspace, user } = data;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.WORKSPACE_INVITE,
            body: {
              id: workspace.id,
              title: workspace.title,
            },
          });
        }
        break;
      case AppEvents.WELCOME:
        {
          const { user } = data;

          await Notification.insert({
            fk_user_id: user.id,
            type: AppEvents.WELCOME,
            body: {},
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
