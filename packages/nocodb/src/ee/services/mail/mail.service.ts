import { Injectable } from '@nestjs/common';
import { MailService as MailServiceCE } from 'src/services/mail/mail.service';
import { MailEvent } from 'src/interface/Mail';
import { RoleLabels } from 'nocodb-sdk';
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
              html: await this.renderMail('Mention', {
                name:
                  user.display_name ??
                  user.email.split('@')[0]?.toLocaleUpperCase(),
                email: user.email,
                link: this.buildUrl(req, {
                  workspaceId: workspace.id,
                  baseId: base.id,
                  tableId: table.id,
                  rowId,
                  commentId: comment.id,
                }),
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
            html: await this.renderMail('MentionRow', {
              name:
                user.display_name ??
                user.email.split('@')[0].toLocaleUpperCase(),
              email: user.email,
              tableTitle: table.title,
              baseTitle: base.title,
              workspaceTitle: workspace.title,
              link: this.buildUrl(req, {
                workspaceId: workspace.id,
                baseId: base.id,
                tableId: table.id,
                rowId,
                columnId: column.id,
              }),
            }),
          });
        }
        break;
      }
      case MailEvent.BASE_ROLE_UPDATE: {
        const {
          payload: { base, user, req, role },
        } = params;

        const invitee = req.user;
        const workspace = await Workspace.get(base.fk_workspace_id);

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Your role has been updated in ${base.title}`,
          html: await this.renderMail('BaseRoleUpdate', {
            baseTitle: base.title,
            workspaceTitle: workspace.title,
            name:
              invitee.display_name ??
              invitee.email.split('@')[0].toLocaleUpperCase(),
            email: invitee.email,
            link: this.buildUrl(req, {
              workspaceId: workspace.id,
              baseId: base.id,
            }),
            role: RoleLabels[role],
          }),
        });
        break;
      }
      case MailEvent.WORKSPACE_INVITE: {
        const {
          payload: { workspace, user, req, token },
        } = params;

        const invitee = req.user;

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `You have been invited to ${workspace.title}`,
          html: await this.renderMail('WorkspaceInvite', {
            workspaceTitle: workspace.title,
            name:
              invitee.display_name ??
              invitee.email.split('@')[0].toLocaleUpperCase(),
            email: invitee.email,
            link: this.buildUrl(req, {
              workspaceId: workspace.id,
              token,
            }),
          }),
        });
        break;
      }
      case MailEvent.WORKSPACE_ROLE_UPDATE: {
        const {
          payload: { workspace, user, req, role },
        } = params;

        const invitee = req.user;

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Your role has been updated in ${workspace.title}`,
          html: await this.renderMail('WorkspaceRoleUpdate', {
            workspaceTitle: workspace.title,
            role: RoleLabels[role],
            name:
              invitee.display_name ??
              invitee.email.split('@')[0].toLocaleUpperCase(),
            email: invitee.email,
            link: this.buildUrl(req, {
              workspaceId: workspace.id,
            }),
          }),
        });
        break;
      }

      default:
        await super.sendMail(params);
        break;
    }
  }
}
