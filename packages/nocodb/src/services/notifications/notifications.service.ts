import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  RowCommentEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { Response } from 'express';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { BaseUser, Column, Notification } from '~/models';

import { DatasService } from '~/services/datas.service';
import { extractMentions } from '~/utils/richTextHelper';
import { getCircularReplacer } from '~/utils';
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    protected readonly appHooks: AppHooksService,
    private readonly datasService: DatasService,
  ) {}

  connections = new Map<
    string,
    (Response & {
      resId: string;
    })[]
  >();

  addConnection = (userId: string, res: Response & { resId: string }) => {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, [] as any);
    }

    this.connections.get(userId).push(res);
  };

  removeConnection = (userId: string, res: Response & { resId: string }) => {
    if (!this.connections.has(userId)) {
      return;
    }

    const userConnections = this.connections.get(userId);

    const idx = userConnections.findIndex((c) => c.resId === res.resId);

    if (idx > -1) {
      userConnections.splice(idx, 1);
    }
    this.connections.set(userId, userConnections);
  };

  public sendToConnections(key: string, payload: string): void {
    const connections = this.connections.get(String(key));

    if (connections && connections.length)
      connections.forEach((res) => {
        res.send({
          status: 'success',
          data: payload,
        });
      });
  }

  protected async insertNotification(
    insertData: Partial<Notification>,
    _req: NcRequest,
  ) {
    await Notification.insert(insertData);

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
      case AppEvents.COMMENT_UPDATE:
      case AppEvents.COMMENT_CREATE: {
        console.log('COMMENT_UPDATE/CREATE');
        const {
          user,
          base,
          comment,
          rowId,
          model: table,
          req,
        } = data as RowCommentEvent;
        const mentions = extractMentions(comment.comment);
        console.log(mentions);

        if (!mentions || !mentions.length) break;

        const row = await this.datasService.dataRead({
          rowId: rowId,
          baseName: base.id,
          tableName: table.id,
          query: {},
        });

        const cols = await Column.list({
          fk_model_id: table.id,
        });

        const pvc = cols.find((c) => c.pv);

        const displayValue = row[pvc?.title ?? ''] ?? '';

        const baseUsers = await BaseUser.getUsersList({
          base_id: base.id,
        });

        for (const mention of mentions ?? []) {
          const mentionedUser = baseUsers.find((b) => b.id === mention);
          if (!mentionedUser) continue;
          // TODO: Do not send email if the mentioned user is the same as the user who commented
          // if (mentionedUser.id === user.id) continue;

          await this.insertNotification(
            {
              fk_user_id: mentionedUser.id,
              type: 'mention' as any,
              body: {
                workspace: {
                  id: (base as any).fk_workspace_id,
                },
                base: {
                  id: base.id,
                  title: base.title,
                  base_type: base.type,
                },
                table: {
                  id: table.id,
                  title: table.title,
                },
                row: {
                  id: rowId,
                  value: displayValue,
                },
                comment: comment,
                user: {
                  id: user.id,
                  email: user.email,
                  display_name: user.display_name,
                },
              },
            },
            req,
          );
        }

        break;
      }
    }
  }

  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
    this.appHooks.onAll(this.hookHandler.bind(this));
  }
}
