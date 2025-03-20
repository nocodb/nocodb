import { Injectable, Logger } from '@nestjs/common';
import { RoleLabels } from 'nocodb-sdk';
import { render } from '@react-email/render';
import type { NcRequest } from 'nocodb-sdk';
import type { MailParams } from '~/interface/Mail';
import type { ComponentProps } from 'react';
import * as MailTemplates from '~/services/mail/templates';
import { MailEvent } from '~/interface/Mail';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import config from '~/app.config';
import { extractDisplayNameFromEmail } from '~/utils';

type TemplateComponent<K extends keyof typeof MailTemplates> =
  (typeof MailTemplates)[K];
type TemplateProps<K extends keyof typeof MailTemplates> = ComponentProps<
  TemplateComponent<K>
>;

@Injectable()
export class MailService {
  protected logger = new Logger(MailService.name);
  async getAdapter() {
    try {
      return await NcPluginMgrv2.emailAdapter();
    } catch (e) {
      this.logger.error('Email Plugin not configured / active');
      return null;
    }
  }

  async renderMail<K extends keyof typeof MailTemplates>(
    template: K,
    props: TemplateProps<K>,
  ) {
    const Component = MailTemplates[template];
    // TODO: Fix Type here
    return await render(Component(props as TemplateProps<any>));
  }

  buildUrl(
    req: NcRequest,
    params: {
      token?: string;
      workspaceId?: string;
      baseId?: string;
      tableId?: string;
      rowId?: string;
      commentId?: string;
      columnId?: string;
      resetPassword?: string;
      verificationToken?: string;
    } = {},
  ) {
    const dashboardPath = Noco.getConfig()?.dashboardPath;

    if (params.token && !config.auth.disableEmailAuth) {
      return `${req.ncSiteUrl}${dashboardPath}#/signup/${params.token}`;
    }

    let url = req.ncSiteUrl;

    url += dashboardPath;

    if (params.resetPassword) {
      url += `/auth/password/reset/${params.resetPassword}`;
      return url;
    }

    if (params.verificationToken) {
      url += `/email/validate/${params.verificationToken}`;
      return url;
    }

    if (params.workspaceId) {
      url += `#/${params.workspaceId}`;
    } else {
      url += `#`;
    }

    if (params.baseId) {
      url += `/${params.baseId}`;

      if (params.tableId) {
        url += `/${params.tableId}`;

        const searchParams = new URLSearchParams();

        if (params.rowId) {
          searchParams.set('rowId', params.rowId);
        }
        if (params.commentId) {
          searchParams.set('commentId', params.commentId);
        }
        if (params.columnId) {
          searchParams.set('columnId', params.columnId);
        }
        if (searchParams.toString()) {
          url += `?${searchParams.toString()}`;
        }
      }
    }

    return url;
  }

  async sendMail(params: MailParams) {
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      this.logger.error('Email Plugin not configured / active');
      return false;
    }

    const { payload, mailEvent } = params;

    try {
      switch (mailEvent) {
        case MailEvent.BASE_INVITE: {
          const { base, user, req, token } = payload;

          const invitee = req.user;
          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'You’ve been invited to a Base',
            html: await this.renderMail('BaseInvite', {
              baseTitle: base.title,
              name: extractDisplayNameFromEmail(
                invitee.email,
                invitee.display_name,
              ),
              email: invitee.email,
              link: this.buildUrl(req, {
                workspaceId: base.fk_workspace_id,
                baseId: base.id,
                token,
              }),
            }),
          });
          break;
        }
        case MailEvent.BASE_ROLE_UPDATE: {
          const { req, user, base, oldRole, newRole } = payload;
          const invitee = req.user;

          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'Your Base role has been updated',
            html: await this.renderMail('BaseRoleUpdate', {
              baseTitle: base.title,
              name: extractDisplayNameFromEmail(
                invitee.email,
                invitee.display_name,
              ),
              email: invitee.email,
              oldRole: RoleLabels[oldRole],
              newRole: RoleLabels[newRole],
              link: this.buildUrl(req, {
                workspaceId: base.fk_workspace_id,
                baseId: base.id,
              }),
            }),
          });
          break;
        }
        case MailEvent.RESET_PASSWORD: {
          const { user, req } = payload;

          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'Reset your password',
            html: await this.renderMail('PasswordReset', {
              email: user.email,
              link: this.buildUrl(req, {
                resetPassword: (user as any).reset_password_token,
              }),
            }),
          });
          break;
        }

        case MailEvent.VERIFY_EMAIL: {
          const { user, req } = payload;
          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'Verify your email',
            html: await this.renderMail('VerifyEmail', {
              email: user.email,
              link: this.buildUrl(req, {
                verificationToken: (user as any).email_verification_token,
              }),
            }),
          });
          break;
        }
        case MailEvent.WELCOME: {
          const { req, user } = payload;
          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'Welcome to NocoDB!',
            html: await this.renderMail('Welcome', {
              email: user.email,
              link: this.buildUrl(req, {}),
            }),
          });
          break;
        }
        case MailEvent.ORGANIZATION_INVITE: {
          const { req, user, token } = payload;
          const invitee = req.user;
          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'You have been invited to join NocoDB',
            html: await this.renderMail('OrganizationInvite', {
              name: extractDisplayNameFromEmail(
                invitee.email,
                invitee.display_name,
              ),
              email: invitee.email,
              link: this.buildUrl(req, {
                token,
              }),
            }),
          });
          break;
        }
        case MailEvent.ORGANIZATION_ROLE_UPDATE: {
          const { req, user, oldRole, newRole } = payload;
          const invitee = req.user;
          await mailerAdapter.mailSend({
            to: user.email,
            subject: 'Role updated in NocoDB',
            html: await this.renderMail('OrganizationRoleUpdate', {
              name: extractDisplayNameFromEmail(
                invitee.email,
                invitee.display_name,
              ),
              email: invitee.email,
              oldRole: RoleLabels[oldRole],
              newRole: RoleLabels[newRole],
              link: this.buildUrl(req, {}),
            }),
          });
          break;
        }
        case MailEvent.FORM_SUBMISSION: {
          const { formView, data, model, emails, base } = payload;

          await mailerAdapter.mailSend({
            to: emails.join(','),
            subject: `NocoDB Forms: Someone has responded to ${formView.title}`,
            html: await this.renderMail('FormSubmission', {
              formTitle: formView.title,
              tableTitle: model.title,
              submissionData: data,
              baseTitle: base.title,
            }),
          });
        }
      }
      return true;
    } catch (e) {
      this.logger.error('Error sending email', e);
      return false;
    }
  }
}
