import { AppEvents } from 'nocodb-sdk';
import * as ejs from 'ejs';
import { Injectable } from '@nestjs/common';
import { Mention, MentionRow } from './templates';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type {
  RowCommentEvent,
  RowMentionEvent,
} from '~/services/app-hooks/interfaces';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { extractMentions } from '~/utils/richTextHelper';
import { Base, BaseUser, Workspace } from '~/models';

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  constructor(protected readonly appHooks: AppHooksService) {}

  async getAdapter() {
    try {
      return await NcPluginMgrv2.emailAdapter();
    } catch (e) {
      console.error('Plugin not configured / active');
      return null;
    }
  }

  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }

  onModuleInit() {
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
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      console.error('Plugin not configured / active');
      return;
    }
    switch (event) {
      case AppEvents.COMMENT_CREATE:
      case AppEvents.COMMENT_UPDATE: {
        const {
          base,
          model: table,
          user,
          comment,
          rowId,
          req,
        } = data as RowCommentEvent;

        const mentions = extractMentions(comment.comment);

        if (mentions && mentions.length) {
          const ws = await Workspace.get(base.fk_workspace_id);

          const baseUsers = await BaseUser.getUsersList(req.context, {
            base_id: base.id,
          });

          for (const mention of mentions ?? []) {
            const mentionedUser = baseUsers.find((b) => b.id === mention);

            if (!mentionedUser) continue;
            if (mentionedUser.id === user.id) continue;

            await mailerAdapter.mailSend({
              to: mentionedUser.email,
              subject: `New comment on ${table.title}`,
              html: ejs.render(Mention, {
                name:
                  user.display_name ??
                  user.email.split('@')[0]?.toLocaleUpperCase(),
                email: user.email,
                link: `${(req as any).ncSiteUrl}${(req as any).dashboardUrl}#/${
                  ws.id
                }/${base.id}/${table.id}?rowId=${rowId}&commentId=${
                  comment.id
                }`,
                workspaceTitle: ws.title,
                baseTitle: base.title,
              }),
            });
          }
        }
        break;
      }

      case AppEvents.ROW_USER_MENTION: {
        const {
          model: table,
          rowId,
          user,
          column,
          req,
          mentions,
        } = data as RowMentionEvent;

        const base = await Base.get(req.context, table.base_id);

        const ws = await Workspace.get(base.fk_workspace_id);

        const baseUsers = await BaseUser.getUsersList(req.context, {
          base_id: base.id,
        });

        for (const mention of mentions ?? []) {
          const mentionedUser = baseUsers.find((b) => b.id === mention);

          if (!mentionedUser) continue;
          if (mentionedUser.id === user.id) continue;

          await mailerAdapter.mailSend({
            to: mentionedUser.email,
            subject: `You have been mentioned on ${table.title}`,
            html: ejs.render(MentionRow, {
              name:
                user.display_name ??
                user.email.split('@')[0].toLocaleUpperCase(),
              email: user.email,
              tableTitle: table.title,
              baseTitle: base.title,
              workspaceTitle: ws.title,
              link: `${(req as any).ncSiteUrl}${(req as any).dashboardUrl}#/${
                ws.id
              }/${base.id}/${table.id}?rowId=${rowId}&columnId=${column.id}`,
            }),
          });
        }
        break;
      }
    }
  }
}
