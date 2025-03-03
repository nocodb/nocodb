import { Injectable } from '@nestjs/common';
import * as ejs from 'ejs';
import type { MailParams } from '~/interface/Mail';
import type { NcRequest } from 'nocodb-sdk';
import { MailEvent } from '~/interface/Mail';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { BaseInvite } from '~/services/mail/templates';
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
    params: {
      token?: string;
      workspaceId?: string;
      baseId?: string;
      tableId?: string;
      rowId?: string;
      commentId?: string;
      columnId?: string;
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

    switch (params.mailEvent) {
      case MailEvent.BASE_INVITE: {
        const {
          payload: { base, user, req, token },
        } = params;

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
    }
  }
}
