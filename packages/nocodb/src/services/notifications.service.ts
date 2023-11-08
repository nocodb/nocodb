import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Notification } from '~/models';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  constructor(protected readonly appHooks: AppHooksService) {}

  protected async insertNotification(
    insertData: Partial<Notification>,
    req: NcRequest,
  ) {
    this.appHooks.emit('notification' as any, { ...insertData, req } as any);

    await Notification.insert(insertData);
  }

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    const { req } = data;
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const { base, user, invitedBy } = data as ProjectInviteEvent;

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.PROJECT_INVITE,
              body: {
                id: base.id,
                title: base.title,
                type: base.type,
                invited_by: invitedBy.email,
              },
            },
            req,
          );
        }
        break;
      case AppEvents.WELCOME:
        {
          const { user, req } = data as WelcomeEvent;

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.WELCOME,
              body: {},
            },
            req,
          );
        }
        break;
    }
  }

  // todo: verify if this is the right way to do it, since we are binding this context to the handler
  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
    this.appHooks.onAll(this.hookHandler.bind(this));
  }

  async notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    try {
      // Define the pagination parameters
      const { limit = 10, offset = 0 } = param; // Number of rows to skip before returning results

      const list = await Notification.list({
        fk_user_id: param.user.id,
        limit,
        offset,
        is_deleted: false,
      });

      const count = await Notification.count({
        fk_user_id: param.user.id,
        is_deleted: false,
      });

      const unreadCount = await Notification.count({
        fk_user_id: param.user.id,
        is_deleted: false,
        is_read: false,
      });

      return new PagedResponseImpl(
        list,
        {
          limit: param.limit,
          offset: param.offset,
          count,
        },
        { unreadCount },
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async notificationUpdate(param: { notificationId: string; body; user: any }) {
    await Notification.update(param.notificationId, param.body);

    return true;
  }

  async markAllRead(param: { user: any }) {
    if (!param.user?.id) {
      NcError.badRequest('User id is required');
    }

    await Notification.markAllAsRead(param.user.id);

    return true;
  }
}
