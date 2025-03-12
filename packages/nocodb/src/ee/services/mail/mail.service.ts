import { Injectable } from '@nestjs/common';
import { MailService as MailServiceCE } from 'src/services/mail/mail.service';
import { RoleLabels } from 'nocodb-sdk';
import type { MailParams } from '~/interface/Mail';
import { MailEvent } from '~/interface/Mail';
import { extractMentions } from '~/utils/richTextHelper';
import { Base, BaseUser, Workspace } from '~/models';
import { extractDisplayNameFromEmail } from '~/utils';

@Injectable()
export class MailService extends MailServiceCE {
  async sendMail(params: MailParams) {
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      this.logger.error('Email Plugin not configured / active');
      return false;
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
              subject: `You have been mentioned`,
              html: await this.renderMail('Mention', {
                name: extractDisplayNameFromEmail(
                  user.email,
                  user.display_name,
                ),
                email: user.email,
                link: this.buildUrl(req, {
                  workspaceId: workspace.id,
                  baseId: base.id,
                  tableId: table.id,
                  rowId,
                  commentId: comment.id,
                }),
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
            subject: `You have been mentioned`,
            html: await this.renderMail('MentionRow', {
              name: extractDisplayNameFromEmail(user.email, user.display_name),
              email: user.email,
              baseTitle: base.title,
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
      case MailEvent.WORKSPACE_INVITE: {
        const {
          payload: { workspace, user, req, token },
        } = params;

        const invitee = req.user;

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `You’ve been invited to a Workspace`,
          html: await this.renderMail('WorkspaceInvite', {
            workspaceTitle: workspace.title,
            name: extractDisplayNameFromEmail(
              invitee.email,
              invitee.display_name,
            ),
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
          payload: { workspace, user, req, oldRole, newRole },
        } = params;

        const invitee = req.user;

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Your Workspace role has been updated`,
          html: await this.renderMail('WorkspaceRoleUpdate', {
            workspaceTitle: workspace.title,
            newRole: RoleLabels[newRole],
            oldRole: RoleLabels[oldRole],
            name: extractDisplayNameFromEmail(
              invitee.email,
              invitee.display_name,
            ),
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
