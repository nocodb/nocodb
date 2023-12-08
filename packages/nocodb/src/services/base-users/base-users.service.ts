import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  PluginCategory,
  ProjectRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as ejs from 'ejs';
import validator from 'validator';
import type { ProjectUserReqType, UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import NocoCache from '~/cache/NocoCache';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { randomTokenString } from '~/helpers/stringHelpers';
import { Base, BaseUser, User } from '~/models';

import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { getProjectRolePower } from '~/utils/roleHelper';

@Injectable()
export class BaseUsersService {
  constructor(protected appHooksService: AppHooksService) {}

  async userList(param: { baseId: string; query: any }) {
    return new PagedResponseImpl(
      await BaseUser.getUsersList({
        ...param.query,
        base_id: param.baseId,
      }),
      {
        ...param.query,
        count: await BaseUser.getUsersCount({
          base_id: param.baseId,
          ...param.query,
        }),
      },
    );
  }

  async userInvite(param: {
    baseId: string;
    baseUser: ProjectUserReqType;
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.baseUser,
    );

    if (
      getProjectRolePower({
        base_roles: extractRolesObj(param.baseUser.roles),
      }) > getProjectRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to invite with this role`);
    }

    if (
      ![
        ProjectRoles.CREATOR,
        ProjectRoles.EDITOR,
        ProjectRoles.COMMENTER,
        ProjectRoles.VIEWER,
        ProjectRoles.NO_ACCESS,
      ].includes(param.baseUser.roles as ProjectRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const emails = (param.baseUser.email || '')
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
      // add user to base if user already exist
      const user = await User.getByEmail(email);

      const base = await Base.get(param.baseId);

      if (!base) {
        return NcError.badRequest('Invalid base id');
      }

      if (user) {
        // check if this user has been added to this base
        const baseUser = await BaseUser.get(param.baseId, user.id);

        const base = await Base.get(param.baseId);

        if (!base) {
          return NcError.badRequest('Invalid base id');
        }

        if (baseUser) {
          NcError.badRequest(
            `${user.email} with role ${baseUser.roles} already exists in this base`,
          );
        }

        await BaseUser.insert({
          base_id: param.baseId,
          fk_user_id: user.id,
          roles: param.baseUser.roles || 'editor',
        });

        this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
          base,
          user,
          invitedBy: param.req.user,
          ip: param.req.clientIp,
          req: param.req,
        });

        const cachedUser = await NocoCache.get(
          `${CacheScope.USER}:${email}___${param.baseId}`,
          CacheGetType.TYPE_OBJECT,
        );

        if (cachedUser) {
          cachedUser.roles = param.baseUser.roles || 'editor';
          await NocoCache.set(
            `${CacheScope.USER}:${email}___${param.baseId}`,
            cachedUser,
          );
        }
      } else {
        try {
          // create new user with invite token
          const user = await User.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email,
            roles: OrgUserRoles.VIEWER,
            token_version: randomTokenString(),
          });

          // add user to base
          await BaseUser.insert({
            base_id: param.baseId,
            fk_user_id: user.id,
            roles: param.baseUser.roles,
          });

          this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
            base,
            user,
            invitedBy: param.req.user,
            ip: param.req.clientIp,
            req: param.req,
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

  async baseUserUpdate(param: {
    userId: string;
    // todo: update swagger
    baseUser: ProjectUserReqType & { base_id: string };
    // todo: refactor
    req: any;
    baseId: string;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.baseUser,
    );

    if (!param.baseId) {
      NcError.badRequest('Missing base id');
    }

    const base = await Base.get(param.baseId);

    if (!base) {
      return NcError.badRequest('Invalid base id');
    }

    if (param.baseUser.roles.includes(ProjectRoles.OWNER)) {
      NcError.badRequest('Owner cannot be updated');
    }

    if (
      ![
        ProjectRoles.CREATOR,
        ProjectRoles.EDITOR,
        ProjectRoles.COMMENTER,
        ProjectRoles.VIEWER,
        ProjectRoles.NO_ACCESS,
      ].includes(param.baseUser.roles as ProjectRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' doesn't exist`);
    }

    const targetUser = await User.getWithRoles(param.userId, {
      user,
      baseId: param.baseId,
    });

    if (!targetUser) {
      NcError.badRequest(
        `User with id '${param.userId}' doesn't exist in this base`,
      );
    }

    if (
      getProjectRolePower(targetUser) >= getProjectRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    await BaseUser.updateRoles(
      param.baseId,
      param.userId,
      param.baseUser.roles,
    );

    this.appHooksService.emit(AppEvents.PROJECT_USER_UPDATE, {
      base,
      user,
      updatedBy: param.req.user,
      ip: param.req.clientIp,
      baseUser: param.baseUser,
      req: param.req,
    });

    return {
      msg: 'User has been updated successfully',
    };
  }

  async baseUserDelete(param: {
    baseId: string;
    userId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const base_id = param.baseId;

    if (param.req.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    if (!param.req.user?.base_roles?.owner) {
      const user = await User.get(param.userId);
      if (user.roles?.split(',').includes('super'))
        NcError.forbidden(
          'Insufficient privilege to delete a super admin user.',
        );

      const baseUser = await BaseUser.get(base_id, param.userId);
      if (baseUser?.roles?.split(',').includes('owner'))
        NcError.forbidden('Insufficient privilege to delete a owner user.');
    }

    await BaseUser.delete(base_id, param.userId);
    return true;
  }

  async baseUserInviteResend(param: {
    userId: string;
    baseUser: ProjectUserReqType;
    baseId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' not found`);
    }

    const base = await Base.get(param.baseId);

    if (!base) {
      return NcError.badRequest('Invalid base id');
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

    this.appHooksService.emit(AppEvents.PROJECT_USER_RESEND_INVITE, {
      base,
      user,
      invitedBy: param.req.user,
      ip: param.req.clientIp,
      baseUser: param.baseUser,
      req: param.req,
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
            baseName: req.body?.baseName,
            roles: (req.body?.roles || '')
              .split(',')
              .map((r) => r.replace(/^./, (m) => m.toUpperCase()))
              .join(', '),
            adminEmail: req.user?.email,
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

  async baseUserMetaUpdate(param: {
    body: any;
    baseId: string;
    user: UserType;
  }) {
    // update base user data
    const baseUserData = extractProps(param.body, [
      'starred',
      'order',
      'hidden',
    ]);

    if (Object.keys(baseUserData).length) {
      // create new base user if it doesn't exist
      if (!(await BaseUser.get(param.baseId, param.user?.id))) {
        await BaseUser.insert({
          ...baseUserData,
          base_id: param.baseId,
          fk_user_id: param.user?.id,
        });
      } else {
        await BaseUser.update(param.baseId, param.user?.id, baseUserData);
      }
    }

    return true;
  }
}
