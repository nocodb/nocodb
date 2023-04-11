import { Injectable } from '@nestjs/common';
import { OrgUserRoles, PluginCategory } from 'nocodb-sdk';
import { T } from 'nc-help';
import { v4 as uuidv4 } from 'uuid';
import * as ejs from 'ejs';
import validator from 'validator';
import NocoCache from '../../cache/NocoCache';
import { validatePayload } from '../../helpers';
import { NcError } from '../../helpers/catchError';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import { randomTokenString } from '../../helpers/stringHelpers';
import { Audit, ProjectUser, User } from '../../models';

import Noco from '../../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../../utils/globals';
import type { ProjectUserReqType } from 'nocodb-sdk';

@Injectable()
export class ProjectUsersService {
  async userList(param: { projectId: string; query: any }) {
    return new PagedResponseImpl(
      await ProjectUser.getUsersList({
        ...param.query,
        project_id: param.projectId,
      }),
      {
        ...param.query,
        count: await ProjectUser.getUsersCount(param.query),
      },
    );
  }

  async userInvite(param: {
    projectId: string;
    projectUser: ProjectUserReqType;
    req: any;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.projectUser,
    );

    const emails = (param.projectUser.email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim());

    // check for invalid emails
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }
    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {
      // add user to project if user already exist
      const user = await User.getByEmail(email);

      if (user) {
        // check if this user has been added to this project
        const projectUser = await ProjectUser.get(param.projectId, user.id);
        if (projectUser) {
          NcError.badRequest(
            `${user.email} with role ${projectUser.roles} already exists in this project`,
          );
        }

        await ProjectUser.insert({
          project_id: param.projectId,
          fk_user_id: user.id,
          roles: param.projectUser.roles || 'editor',
        });

        const cachedUser = await NocoCache.get(
          `${CacheScope.USER}:${email}___${param.projectId}`,
          CacheGetType.TYPE_OBJECT,
        );

        if (cachedUser) {
          cachedUser.roles = param.projectUser.roles || 'editor';
          await NocoCache.set(
            `${CacheScope.USER}:${email}___${param.projectId}`,
            cachedUser,
          );
        }

        await Audit.insert({
          project_id: param.projectId,
          op_type: 'AUTHENTICATION',
          op_sub_type: 'INVITE',
          user: param.req.user.email,
          description: `invited ${email} to ${param.projectId} project `,
          ip: param.req.clientIp,
        });
      } else {
        try {
          // create new user with invite token
          const { id } = await User.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email,
            roles: OrgUserRoles.VIEWER,
            token_version: randomTokenString(),
          });

          // add user to project
          await ProjectUser.insert({
            project_id: param.projectId,
            fk_user_id: id,
            roles: param.projectUser.roles,
          });

          const count = await User.count();
          T.emit('evt', { evt_type: 'project:invite', count });

          await Audit.insert({
            project_id: param.projectId,
            op_type: 'AUTHENTICATION',
            op_sub_type: 'INVITE',
            user: param.req.user.email,
            description: `invited ${email} to ${param.projectId} project `,
            ip: param.req.clientIp,
          });
          // in case of single user check for smtp failure
          // and send back token if failed
          if (
            emails.length === 1 &&
            !(await this.sendInviteEmail(email, invite_token, param.req))
          ) {
            return { invite_token, email };
          } else {
            this.sendInviteEmail(email, invite_token, param.req);
          }
        } catch (e) {
          console.log(e);
          if (emails.length === 1) {
            throw e;
          } else {
            error.push({ email, error: e.message });
          }
        }
      }
    }

    if (emails.length === 1) {
      return {
        msg: 'The user has been invited successfully',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async projectUserUpdate(param: {
    userId: string;
    // todo: update swagger
    projectUser: ProjectUserReqType & { project_id: string };
    // todo: refactor
    req: any;
    projectId: string;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.projectUser,
    );

    // todo: use param.projectId
    if (!param.projectUser?.project_id) {
      NcError.badRequest('Missing project id in request body.');
    }

    if (
      param.req.session?.passport?.user?.roles?.owner &&
      param.req.session?.passport?.user?.id === param.userId &&
      param.projectUser.roles.indexOf('owner') === -1
    ) {
      NcError.badRequest("Super admin can't remove Super role themselves");
    }
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' doesn't exist`);
    }

    // todo: handle roles which contains super
    if (
      !param.req.session?.passport?.user?.roles?.owner &&
      param.projectUser.roles.indexOf('owner') > -1
    ) {
      NcError.forbidden('Insufficient privilege to add super admin role.');
    }

    await ProjectUser.update(
      param.projectId,
      param.userId,
      param.projectUser.roles,
    );

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'ROLES_MANAGEMENT',
      user: param.req.user.email,
      description: `updated roles for ${user.email} with ${param.projectUser.roles} `,
      ip: param.req.clientIp,
    });

    return {
      msg: 'User has been updated successfully',
    };
  }

  async projectUserDelete(param: {
    projectId: string;
    userId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const project_id = param.projectId;

    if (param.req.session?.passport?.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    if (!param.req.session?.passport?.user?.roles?.owner) {
      const user = await User.get(param.userId);
      if (user.roles?.split(',').includes('super'))
        NcError.forbidden(
          'Insufficient privilege to delete a super admin user.',
        );

      const projectUser = await ProjectUser.get(project_id, param.userId);
      if (projectUser?.roles?.split(',').includes('super'))
        NcError.forbidden('Insufficient privilege to delete a owner user.');
    }

    await ProjectUser.delete(project_id, param.userId);
    return true;
  }

  async projectUserInviteResend(param: {
    userId: string;
    projectUser: ProjectUserReqType;
    projectId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' not found`);
    }

    const invite_token = uuidv4();

    await User.update(user.id, {
      invite_token,
      invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const pluginData = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.PLUGIN,
      {
        category: PluginCategory.EMAIL,
        active: true,
      },
    );

    if (!pluginData) {
      NcError.badRequest(
        `No Email Plugin is found. Please go to App Store to configure first or copy the invitation URL to users instead.`,
      );
    }

    await this.sendInviteEmail(user.email, invite_token, param.req);

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'RESEND_INVITE',
      user: user.email,
      description: `resent a invite to ${user.email} `,
      ip: param.req.clientIp,
      project_id: param.projectId,
    });

    return true;
  }

  // todo: refactor the whole function
  async sendInviteEmail(email: string, token: string, req: any): Promise<any> {
    try {
      const template = (await import('./ui/emailTemplates/invite')).default;

      const emailAdapter = await NcPluginMgrv2.emailAdapter();

      if (emailAdapter) {
        await emailAdapter.mailSend({
          to: email,
          subject: 'Verify email',
          html: ejs.render(template, {
            signupLink: `${req.ncSiteUrl}${
              Noco.getConfig()?.dashboardPath
            }#/signup/${token}`,
            projectName: req.body?.projectName,
            roles: (req.body?.roles || '')
              .split(',')
              .map((r) => r.replace(/^./, (m) => m.toUpperCase()))
              .join(', '),
            adminEmail: req.session?.passport?.user?.email,
          }),
        });
        return true;
      }
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
        e.message,
      );
      throw e;
    }
  }
}
