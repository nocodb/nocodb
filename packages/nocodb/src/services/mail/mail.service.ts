import { Injectable } from '@nestjs/common';
import * as ejs from 'ejs';
import type { MailParams } from '~/interface/Mail';
import type { NcRequest } from 'nocodb-sdk';
import { MailEvent } from '~/interface/Mail';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  BaseInvite,
  BaseRoleUpdate,
  OrganizationInvite,
  OrganizationRoleUpdate,
  PasswordReset,
  VerifyEmail,
  Welcome,
} from '~/services/mail/templates';
import Noco from '~/Noco';
import config from '~/app.config';

@Injectable()
export class MailService {
  async getAdapter() {
    try {
      return await NcPluginMgrv2.emailAdapter();
    } catch (e) {
      console.error('Plugin not configured / active');
      return null;
    }
  }

  buildUrl(
    req: NcRequest,
    params?: {
      token?: string;
      workspaceId?: string;
      baseId?: string;
      tableId?: string;
      rowId?: string;
      commentId?: string;
      columnId?: string;
      resetPassword?: string;
      verificationToken?: string;
    },
  ) {
    const dashboardPath = Noco.getConfig()?.dashboardPath;

    if (params.token && !config.auth.disableEmailAuth) {
      return `${req.ncSiteUrl}${dashboardPath}#/signup/${params.token}`;
    }

    let url = `${req.ncSiteUrl}`;

    url += req.dashboardUrl || dashboardPath;

    if (params.workspaceId) {
      url += `#/${params.workspaceId}`;
    } else {
      url += `#`;
    }

    if (params.resetPassword) {
      url += `/auth/password/reset/${params.resetPassword}`;
      return url;
    }

    if (params?.verificationToken) {
      url += `/email/validate/${params.verificationToken}`;
      return url;
    }

    if (params.baseId) {
      url += `/${params.baseId}`;
    }

    if (params.tableId) {
      url += `/${params.tableId}`;
      const queryParams = [];
      if (params.rowId) queryParams.push(`rowId=${params.rowId}`);
      if (params.commentId) queryParams.push(`commentId=${params.commentId}`);
      if (params.columnId) queryParams.push(`columnId=${params.columnId}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;
    }

    return url;
  }

  async sendMail(params: MailParams) {
    const mailerAdapter = await this.getAdapter();
    if (!mailerAdapter) {
      console.error('Plugin not configured / active');
      return;
    }

    const { payload, mailEvent } = params;

    switch (mailEvent) {
      case MailEvent.BASE_INVITE: {
        const { base, user, req, token } = payload;

        const invitee = req.user;
        await mailerAdapter.mailSend({
          to: user.email,
          subject: `You have been invited to ${base.title}`,
          html: ejs.render(BaseInvite, {
            baseTitle: base.title,
            name:
              invitee.display_name ??
              invitee.email.split('@')[0].toLocaleUpperCase(),
            email: user.email,
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
        const { req, user, base, role } = payload;

        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Role updated in ${base.title}`,
          html: ejs.render(BaseRoleUpdate, {
            baseTitle: base.title,
            name:
              user.display_name ?? user.email.split('@')[0].toLocaleUpperCase(),
            email: user.email,
            role,
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
          subject: `Reset your password`,
          html: ejs.render(PasswordReset, {
            email: user.email,
            link: this.buildUrl(req, {
              token: (user as any).reset_password_token,
            }),
          }),
        });
        break;
      }

      case MailEvent.VERIFY_EMAIL: {
        const { user, req } = payload;
        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Verify your email`,
          html: ejs.render(VerifyEmail, {
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
          subject: `Welcome to NocoDB!`,
          html: ejs.render(Welcome, {
            email: user.email,
            link: this.buildUrl(req, {}),
          }),
        });
        break;
      }
      case MailEvent.ORGANIZATION_INVITE: {
        const { req, user, token } = payload;
        await mailerAdapter.mailSend({
          to: user.email,
          subject: `You have been invited to join NocoDB`,
          html: ejs.render(OrganizationInvite, {
            name:
              user.display_name ?? user.email.split('@')[0].toLocaleUpperCase(),
            email: user.email,
            link: this.buildUrl(req, {
              token,
            }),
          }),
        });
        break;
      }
      case MailEvent.ORGANIZATION_ROLE_UPDATE: {
        const { req, user, role } = payload;
        await mailerAdapter.mailSend({
          to: user.email,
          subject: `Role updated in NocoDB`,
          html: ejs.render(OrganizationRoleUpdate, {
            name:
              user.display_name ?? user.email.split('@')[0].toLocaleUpperCase(),
            email: user.email,
            role,
            link: this.buildUrl(req, {}),
          }),
        });
      }
    }
  }
}
