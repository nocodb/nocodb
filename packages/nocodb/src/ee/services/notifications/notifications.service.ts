import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { NotificationsService as NotificationsServiceCE } from 'src/services/notifications/notifications.service';
import type { BaseType } from 'nocodb-sdk';
import type {
  ProjectInviteEvent,
  RowCommentEvent,
  RowMentionEvent,
  WelcomeEvent,
  WorkspaceInviteEvent,
} from '~/services/app-hooks/interfaces';
import { extractMentions } from '~/utils/richTextHelper';
import { DatasService } from '~/services/datas.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Base, BaseUser, Column, Workspace } from '~/models';

@Injectable()
export class NotificationsService extends NotificationsServiceCE {
  constructor(
    protected readonly appHooks: AppHooksService,
    protected readonly datasService: DatasService,
  ) {
    super(appHooks);
  }

  onModuleInit() {
    super.onModuleInit();
    this.appHooks.on(AppEvents.WORKSPACE_INVITE, (data) =>
      this.hookHandler({ event: AppEvents.WORKSPACE_INVITE, data }),
    );
    this.appHooks.on(AppEvents.COMMENT_CREATE, (data) =>
      this.hookHandler({ event: AppEvents.COMMENT_CREATE, data }),
    );
    this.appHooks.on(AppEvents.COMMENT_UPDATE, (data) =>
      this.hookHandler({ event: AppEvents.COMMENT_UPDATE, data }),
    );

    this.appHooks.on(AppEvents.ROW_USER_MENTION, (data) =>
      this.hookHandler({ event: AppEvents.ROW_USER_MENTION, data }),
    );
  }

  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    switch (event) {
      case AppEvents.PROJECT_INVITE:
        {
          const { base, user, invitedBy, req } = data as ProjectInviteEvent;

          const ws = await Workspace.get(base.fk_workspace_id);

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
                },
                workspace: {
                  id: ws.id,
                  title: ws.title,
                },
              },
            },
            req,
          );
        }
        break;
      case AppEvents.WORKSPACE_INVITE:
        {
          const { workspace, user, invitedBy, req } =
            data as WorkspaceInviteEvent;

          await this.insertNotification(
            {
              fk_user_id: user.id,
              type: AppEvents.WORKSPACE_INVITE,
              body: {
                user: {
                  id: invitedBy.id,
                  email: invitedBy.email,
                  displayName: invitedBy.display_name,
                },
                workspace: {
                  id: workspace.id,
                  title: workspace.title,
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
      case AppEvents.COMMENT_UPDATE:
      case AppEvents.COMMENT_CREATE: {
        const {
          user,
          base,
          comment,
          rowId,
          model: table,
          req,
        } = data as RowCommentEvent;
        const mentions = extractMentions(comment.comment);

        if (!mentions || !mentions.length) break;

        try {
          const row = await this.datasService.dataRead(req.context, {
            rowId: rowId,
            baseName: base.id,
            tableName: table.id,
            query: {},
          });

          const cols = await Column.list(req.context, {
            fk_model_id: table.id,
          });

          const pvc = cols.find((c) => c.pv);

          const displayValue = row[pvc?.title ?? ''] ?? '';

          const baseUsers = await BaseUser.getUsersList(req.context, {
            base_id: base.id,
          });

          const ws = await Workspace.get(base.fk_workspace_id);

          for (const mention of mentions) {
            const mentionedUser = baseUsers.find((b) => b.id === mention);
            if (!mentionedUser) continue; // Do not send notification if user is not in the base
            // If user is the same as the one who commented, do not send notification?
            // if (mentionedUser.id === user.id) continue;

            await this.insertNotification(
              {
                fk_user_id: mentionedUser.id,
                type: 'mention' as any,
                body: {
                  workspace: {
                    id: ws.id,
                    title: ws.title,
                  },
                  base: {
                    id: base.id,
                    title: base.title,
                    type: base.type,
                  },
                  table: {
                    id: table.id,
                    title: table.title,
                  },
                  row: {
                    id: rowId,
                    value: displayValue,
                    column: pvc,
                  },
                  comment: {
                    id: comment.id,
                    comment: comment.comment,
                  },
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
        } catch (e) {
          this.logger.error({
            error: e,
            details: 'Error while sending notifications',
            comment: comment.id,
          });
        }

        break;
      }
      case AppEvents.ROW_USER_MENTION: {
        const { user, model, column, rowId, mentions, req } =
          data as RowMentionEvent;

        const base = (await Base.get(req.context, model.base_id)) as BaseType;

        const row = await this.datasService.dataRead(req.context, {
          rowId: rowId,
          baseName: base.id,
          tableName: model.id,
          query: {},
        });

        const cols = await Column.list(req.context, {
          fk_model_id: model.id,
        });

        const pvc = cols.find((c) => c.pv);

        const displayValue = row[pvc?.title ?? ''] ?? '';

        const baseUsers = await BaseUser.getUsersList(req.context, {
          base_id: base.id,
        });

        const ws = await Workspace.get(base.fk_workspace_id);

        for (const mention of mentions) {
          const mentionedUser = baseUsers.find((u) => u.id === mention);
          if (!mentionedUser) continue;

          await this.insertNotification(
            {
              fk_user_id: mentionedUser.id,
              type: AppEvents.ROW_USER_MENTION,
              body: {
                base: {
                  id: base.id,
                  title: base.title,
                  type: base.type,
                },
                user: {
                  id: user.id,
                  email: user.email,
                  display_name: user.display_name,
                },
                table: {
                  id: model.id,
                  title: model.title,
                },
                workspace: {
                  id: ws.id,
                  title: ws.title,
                },
                column: {
                  id: column.id,
                  title: column.title,
                },
                row: {
                  id: rowId,
                  value: displayValue,
                  column: pvc,
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
}
