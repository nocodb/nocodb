import * as ejs from 'ejs';
import { Injectable } from '@nestjs/common';
import { MailService as MailServiceCE } from 'src/services/mail/mail.service';
import { MailEvent } from 'src/interface/Mail';
import { Mention, MentionRow } from './templates';
import type { MailParams } from 'src/interface/Mail';
import { extractMentions } from '~/utils/richTextHelper';
import { Base, BaseUser, Workspace } from '~/models';

@Injectable()
export class MailService extends MailServiceCE {
  async sendMail(params: MailParams) {
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      console.error('Plugin not configured / active');
      return;
    }

    switch (params.mailEvent) {
      case MailEvent.COMMENT_CREATE:
      case MailEvent.COMMENT_UPDATE: {
        const {
          base,
          model: table,
          user,
          comment,
          rowId,
          req,
        } = params.payload;

        const mentions = extractMentions(comment.comment);

        if (mentions && mentions.length) {
          const workspace = await Workspace.get(base.fk_workspace_id);

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
                link: `${req.ncSiteUrl}${req.dashboardUrl}#/${workspace.id}/${base.id}/${table.id}?rowId=${rowId}&commentId=${comment.id}`,
                workspaceTitle: workspace.title,
                baseTitle: base.title,
              }),
            });
          }
        }
        break;
      }
      case MailEvent.ROW_USER_MENTION: {
        const {
          model: table,
          rowId,
          user,
          column,
          req,
          mentions,
        } = params.payload;

        const base = await Base.get(req.context, table.base_id);

        const workspace = await Workspace.get(base.fk_workspace_id);

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
              workspaceTitle: workspace.title,
              link: `${req.ncSiteUrl}${req.dashboardUrl}#/${workspace.id}/${base.id}/${table.id}?rowId=${rowId}&columnId=${column.id}`,
            }),
          });
        }
        break;
      }
      default:
        await super.sendMail(params);
        break;
    }
  }
}
