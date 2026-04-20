import { Injectable, Logger } from '@nestjs/common';
import { ncIsArray, RoleLabels } from 'nocodb-sdk';
import { render } from '@react-email/render';
import type { NcRequest } from 'nocodb-sdk';
import type { MailParams, RawMailParams } from '~/interface/Mail';
import type { ComponentProps } from 'react';
import * as MailTemplates from '~/services/mail/templates';
import { MailEvent } from '~/interface/Mail';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import config from '~/app.config';
import { extractDisplayNameFromEmail } from '~/utils';
import { ncSiteUrl } from '~/utils/envs';

type TemplateComponent<K extends keyof typeof MailTemplates> =
  (typeof MailTemplates)[K];
type TemplateProps<K extends keyof typeof MailTemplates> = ComponentProps<
  TemplateComponent<K>
>;

@Injectable()
export class MailService {
  protected logger = new Logger(MailService.name);
  protected async getAdapter(ncMeta = Noco.ncMeta) {
    try {
      return await NcPluginMgrv2.emailAdapter(undefined, ncMeta);
    } catch (e) {
      this.logger.error('Email Plugin not configured / active');
      return null;
    }
  }

  protected static readonly PUBLIC_URL_NOTIFIED_CACHE_KEY =
    'system:public_url_missing_notified';

  protected isPublicUrlConfigured(): boolean {
    return !!Noco.config?.ncSiteUrl;
  }

  protected async notifySuperAdmin(ncMeta = Noco.ncMeta): Promise<void> {
    const cacheFlag = await NocoCache.get(
      'root',
      MailService.PUBLIC_URL_NOTIFIED_CACHE_KEY,
      CacheGetType.TYPE_STRING,
    );

    if (cacheFlag === 'true') return;

    await NocoCache.set(
      'root',
      MailService.PUBLIC_URL_NOTIFIED_CACHE_KEY,
      'true',
    );

    try {
      const superUser = await ncMeta
        .knexConnection(MetaTable.USERS)
        .where('roles', 'like', '%super%')
        .first();

      if (!superUser?.email) return;

      const mailerAdapter = await this.getAdapter(ncMeta);
      if (!mailerAdapter) return;

      await mailerAdapter.mailSend({
        to: superUser.email,
        subject: 'NocoDB: NC_SITE_URL is not configured',
        html: [
          '<p>Your NocoDB instance does not have <strong>NC_SITE_URL</strong> configured.</p>',
          '<p>Without this setting, emails cannot be sent because the system cannot generate safe URLs. ',
          'The host header from incoming requests can be spoofed, making it unsafe to use as a base URL in emails.</p>',
          '<p>Please set the <code>NC_SITE_URL</code> environment variable to the publicly accessible URL of your NocoDB instance ',
          '(e.g. <code>https://nocodb.example.com</code>) and restart the server.</p>',
        ].join(''),
      });
    } catch (e) {
      this.logger.error('Failed to send NC_SITE_URL notification', e.stack);
    }
  }

  protected async ensurePublicUrl(ncMeta = Noco.ncMeta): Promise<boolean> {
    if (this.isPublicUrlConfigured()) return true;

    await this.notifySuperAdmin(ncMeta);

    this.logger.error(
      'NC_SITE_URL is not configured. Email cannot be sent because the system cannot generate safe URLs.',
    );

    return false;
  }

  protected async renderMail<K extends keyof typeof MailTemplates>(
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
      automationId?: string;
      executionId?: string;
      hookId?: string;
      hookTab?: string;
    } = {},
  ) {
    if (params.token && !config.auth.disableEmailAuth) {
      return `${req.ncSiteUrl}/signup/${params.token}`;
    }

    let url = req?.ncSiteUrl || ncSiteUrl;

    // Reset password link is served from the backend. So no need to append the dashboard path
    if (params.resetPassword) {
      url += `/auth/password/reset/${params.resetPassword}`;
      return url;
    }

    // Email verification link is served from the backend. So no need to append the dashboard path
    if (params.verificationToken) {
      url += `/email/validate/${params.verificationToken}`;
      return url;
    }

    if (params.workspaceId) {
      url += `/${params.workspaceId}`;
    }

    if (params.baseId) {
      url += `/${params.baseId}`;

      if (params.tableId) {
        url += `/${params.tableId}`;

        if (params.hookId) {
          const searchParams = new URLSearchParams();
          searchParams.set('hookId', params.hookId);
          if (params.hookTab) {
            searchParams.set('hookTab', params.hookTab);
          }
          url += `?${searchParams.toString()}`;
        } else {
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

      if (params.automationId) {
        url += `/workflows/${params.automationId}`;

        if (params.executionId) {
          const searchParams = new URLSearchParams();
          searchParams.set('tab', 'logs');
          searchParams.set('executionId', params.executionId);
          url += `?${searchParams.toString()}`;
        }
      }
    }

    return url;
  }

  async sendMailRaw(params: RawMailParams, ncMeta = Noco.ncMeta) {
    const mailerAdapter = await this.getAdapter(ncMeta);
    if (!mailerAdapter) {
      this.logger.error('Email Plugin not configured / active');
      return false;
    }

    if (!params.to || !params.subject || (!params.html && !params.text)) {
      this.logger.error('Missing required parameters');
      return false;
    }

    try {
      await mailerAdapter.mailSend({
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        cc: ncIsArray(params.cc) ? params?.cc?.join(',') : params?.cc,
        bcc: ncIsArray(params.bcc) ? params?.bcc?.join(',') : params?.bcc,
        attachments: params.attachments,
      });
    } catch (e) {
      this.logger.error(e);
      return false;
    }

    return true;
  }

  async sendMail(params: MailParams, ncMeta = Noco.ncMeta) {
    const mailerAdapter = await this.getAdapter(ncMeta);
    if (!mailerAdapter) {
      this.logger.error('Email Plugin not configured / active');
      return false;
    }

    const { payload, mailEvent } = params;

    // Validate NC_SITE_URL is configured for events that generate URLs
    // FORM_SUBMISSION is exempt — it has no req and builds no links
    if (mailEvent !== MailEvent.FORM_SUBMISSION) {
      if (!(await this.ensurePublicUrl(ncMeta))) return false;
    }

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

          break;
        }
      }
      return true;
    } catch (e) {
      this.logger.error('Error sending email', e);
      return false;
    }
  }
}
