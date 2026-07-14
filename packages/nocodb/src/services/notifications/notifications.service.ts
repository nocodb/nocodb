import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  getCircularReplacer,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import type {
  BaseAccessRequestEvent,
  BaseAccessRequestResolvedEvent,
  ProjectInviteEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Response } from 'express';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { BaseUser, Notification } from '~/models';
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
    const notification = await Notification.get({
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
    const notification = await Notification.get({
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
    data:
      | ProjectInviteEvent
      | WelcomeEvent
      | BaseAccessRequestEvent
      | BaseAccessRequestResolvedEvent;
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
      case AppEvents.BASE_ACCESS_REQUEST:
        {
          const { base, request, requester, context } =
            data as BaseAccessRequestEvent;
          const recipients = await this.getBaseOwnerCreatorIds(
            context,
            base.id!,
          );

          for (const recipientId of recipients) {
            if (!recipientId || recipientId === requester?.id) continue;
            await this.insertNotification(
              {
                fk_user_id: recipientId,
                type: AppEvents.BASE_ACCESS_REQUEST,
                body: {
                  base: {
                    id: base.id,
                    title: base.title,
                    type: base.type,
                    fk_workspace_id: (base as any).fk_workspace_id,
                  },
                  request: {
                    id: request?.id,
                    requested_role: request?.requested_role || 'editor',
                    status: request?.status || 'pending',
                    message: request?.message || null,
                  },
                  user: {
                    id: requester?.id,
                    email: requester?.email,
                    displayName: requester?.display_name,
                    meta: requester?.meta,
                  },
                },
              },
              req,
            );
          }
        }
        break;
      case AppEvents.BASE_ACCESS_REQUEST_APPROVED:
      case AppEvents.BASE_ACCESS_REQUEST_REJECTED:
        {
          const { base, request, requester, reviewedBy } =
            data as BaseAccessRequestResolvedEvent;
          if (!requester?.id) break;

          await this.insertNotification(
            {
              fk_user_id: requester.id,
              type: event,
              body: {
                base: {
                  id: base.id,
                  title: base.title,
                  type: base.type,
                  fk_workspace_id: (base as any).fk_workspace_id,
                },
                request: {
                  id: request?.id,
                  requested_role: request?.requested_role || 'editor',
                  status: request?.status,
                },
                user: {
                  id: reviewedBy?.id,
                  email: reviewedBy?.email,
                  displayName: reviewedBy?.display_name,
                  meta: reviewedBy?.meta,
                },
              },
            },
            req,
          );
        }
        break;
    }
  }

  protected async getBaseOwnerCreatorIds(
    context: NcContext,
    baseId: string,
  ): Promise<string[]> {
    const users = await BaseUser.getUsersList(context, { base_id: baseId });
    const ids = new Set<string>();

    for (const user of users) {
      const baseRole =
        (user as any).roles ||
        WorkspaceRolesToProjectRoles[(user as any).workspace_roles] ||
        null;
      if (
        baseRole &&
        (String(baseRole).includes(ProjectRoles.OWNER) ||
          String(baseRole).includes(ProjectRoles.CREATOR))
      ) {
        if ((user as any).id) ids.add((user as any).id);
      }
    }

    return [...ids];
  }

  protected listenerUnsubs: (() => void)[] = [];

  onModuleDestroy() {
    for (const unsub of this.listenerUnsubs) {
      unsub();
    }
    this.listenerUnsubs = [];
  }

  onModuleInit() {
    this.listenerUnsubs.push(
      this.appHooks.on(AppEvents.PROJECT_INVITE, (data) =>
        this.hookHandler({ event: AppEvents.PROJECT_INVITE, data }),
      ),
    );
    this.listenerUnsubs.push(
      this.appHooks.on(AppEvents.WELCOME, (data) =>
        this.hookHandler({ event: AppEvents.WELCOME, data }),
      ),
    );
    this.listenerUnsubs.push(
      this.appHooks.on(AppEvents.BASE_ACCESS_REQUEST, (data) =>
        this.hookHandler({ event: AppEvents.BASE_ACCESS_REQUEST, data }),
      ),
    );
    this.listenerUnsubs.push(
      this.appHooks.on(AppEvents.BASE_ACCESS_REQUEST_APPROVED, (data) =>
        this.hookHandler({
          event: AppEvents.BASE_ACCESS_REQUEST_APPROVED,
          data,
        }),
      ),
    );
    this.listenerUnsubs.push(
      this.appHooks.on(AppEvents.BASE_ACCESS_REQUEST_REJECTED, (data) =>
        this.hookHandler({
          event: AppEvents.BASE_ACCESS_REQUEST_REJECTED,
          data,
        }),
      ),
    );
  }
}
