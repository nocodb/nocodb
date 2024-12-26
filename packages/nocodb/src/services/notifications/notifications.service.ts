import { Injectable, Logger } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { Response } from 'express';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Notification } from '~/models';

import { getCircularReplacer } from '~/utils';
import { PubSubRedis } from '~/redis/pubsub-redis';
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  protected logger: Logger = new Logger(NotificationsService.name);

  constructor(protected readonly appHooks: AppHooksService) {}

  connections = new Map<
    string,
    (Response & {
      resId: string;
    })[]
  >();

  addConnection = (userId: string, res: Response & { resId: string }) => {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, [] as (Response & { resId: string })[]);
    }

    this.connections.get(userId).push(res);
  };

  removeConnection = async (
    userId: string,
    res: Response & { resId: string },
    unsubscribeCb: (keepRedisChannel?: boolean) => Promise<void> | null,
  ) => {
    if (!this.connections.has(userId)) {
      return;
    }

    const userConnections = this.connections.get(userId);

    const idx = userConnections.findIndex((c) => c.resId === res.resId);

    if (idx > -1) {
      userConnections.splice(idx, 1);
    }

    if (userConnections.length === 0) {
      this.connections.delete(userId);
      if (unsubscribeCb) {
        await unsubscribeCb();
      }
    } else {
      this.connections.set(userId, userConnections);
      if (unsubscribeCb) {
        // if there are still connections, keep the redis channel
        await unsubscribeCb(true);
      }
    }
  };

  sendToConnections(key: string, payload: string): void {
    const connections = this.connections.get(String(key));

    for (const res of connections ?? []) {
      res.send({
        status: 'success',
        data: payload,
      });
    }
    this.removeConnectionByUserId(key);
  }

  removeConnectionByUserId(userId: string) {
    this.connections.delete(userId);
  }

  protected async insertNotification(
    insertData: Partial<Notification>,
    _req: NcRequest,
  ) {
    await Notification.insert(insertData);

    if (PubSubRedis.available) {
      await PubSubRedis.publish(
        `notification:${insertData.fk_user_id}`,
        JSON.stringify(insertData, getCircularReplacer()),
      );
    }

    this.sendToConnections(
      insertData.fk_user_id,
      JSON.stringify(insertData, getCircularReplacer()),
    );
  }

  async notificationList(param: {
    user: UserType;
    limit?: number;
    offset?: number;
    is_read?: boolean;
    is_deleted?: boolean;
  }) {
    try {
      const { limit = 10, offset = 0, is_read } = param;

      const list = await Notification.list({
        fk_user_id: param.user.id,
        is_read,
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
      this.logger.error(e);
    }
  }

  async notificationUpdate(param: {
    notificationId: string;
    body;
    user: UserType;
  }) {
    const notification = Notification.get({
      id: param.notificationId,
      fk_user_id: param.user.id,
    });

    if (!notification) {
      NcError.unauthorized('Unauthorized to update notification');
    }
    await Notification.update(param.notificationId, param.body);

    return true;
  }

  async notificationDelete(param: { notificationId: string; user: UserType }) {
    const notification = Notification.get({
      id: param.notificationId,
      fk_user_id: param.user.id,
    });

    if (!notification) {
      NcError.unauthorized('Unauthorized to delete notification');
    }

    await Notification.update(param.notificationId, {
      is_deleted: true,
    });
  }

  async markAllRead(param: { user: UserType }) {
    if (!param.user?.id) {
      NcError.badRequest('User id is required');
    }
    await Notification.markAllAsRead(param.user.id);
    return true;
  }

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: ProjectInviteEvent | WelcomeEvent;
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
                base: {
                  id: base.id,
                  title: base.title,
                  type: base.type,
                },
                user: {
                  id: invitedBy.id,
                  email: invitedBy.email,
                  displayName: invitedBy.display_name,
                  meta: invitedBy.meta,
                },
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

  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
    this.appHooks.on(AppEvents.PROJECT_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.PROJECT_INVITE, data }),
    );
    this.appHooks.on(AppEvents.WELCOME, (data) =>
      this.hookHandler({ event: AppEvents.WELCOME, data }),
    );
  }
}
