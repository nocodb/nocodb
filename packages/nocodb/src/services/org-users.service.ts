import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  PluginCategory,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { NC_APP_SETTINGS } from '~/constants';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { randomTokenString } from '~/helpers/stringHelpers';
import { BaseUser, PresignedUrl, Store, SyncSource, User } from '~/models';

import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

@Injectable()
export class OrgUsersService {
  constructor(
    protected readonly baseUsersService: BaseUsersService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async userList(param: {
    // todo: add better typing
    query: Record<string, any>;
  }) {
    const users = await User.list(param.query);

    await PresignedUrl.signMetaIconImage(users);

    return users;
  }

  async userUpdate(param: {
    // todo: better typing
    user: Partial<UserType>;
    userId: string;
  }) {
    validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

    const updateBody = extractProps(param.user, ['roles']);

    const user = await User.get(param.userId);

    if (extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      NcError.badRequest('Cannot update super admin roles');
    }

    return await User.update(param.userId, {
      ...updateBody,
    });
  }

  async userDelete(param: { userId: string }) {
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      const user = await User.get(param.userId, ncMeta);

      if (extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN]) {
        NcError.badRequest('Cannot delete super admin');
      }

      // delete base user entry and assign to super admin
      const baseUsers = await BaseUser.getProjectsIdList(param.userId, ncMeta);

      // todo: clear cache

      // TODO: assign super admin as base owner
      for (const baseUser of baseUsers) {
        await BaseUser.delete(
          {
            workspace_id: baseUser.fk_workspace_id,
            base_id: baseUser.base_id,
          },
          baseUser.base_id,
          baseUser.fk_user_id,
          ncMeta,
        );
      }

      // delete sync source entry
      await SyncSource.deleteByUserId(param.userId, ncMeta);

      // delete user
      await User.delete(param.userId, ncMeta);
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback(e);
      throw e;
    }

    return true;
  }

  async userAdd(param: {
    user: UserType;
    // todo: refactor
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

    // allow only viewer or creator role
    if (
      param.user.roles &&
      ![OrgUserRoles.VIEWER, OrgUserRoles.CREATOR].includes(
        param.user.roles as OrgUserRoles,
      )
    ) {
      NcError.badRequest('Invalid role');
    }

    // extract emails from request body
    const emails = (param.user.email || '')
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
      let user = await User.getByEmail(email);

      if (user) {
        NcError.badRequest('User already exist');
      } else {
        try {
          // create new user with invite token
          user = await User.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email,
            roles: param.user.roles || OrgUserRoles.VIEWER,
            token_version: randomTokenString(),
          });

          const count = await User.count();

          this.appHooksService.emit(AppEvents.ORG_USER_INVITE, {
            user,
            count,
            req: param.req,
          });

          // in case of single user check for smtp failure
          // and send back token if failed
          if (emails.length === 1) {
            if (
              !(await this.baseUsersService.sendInviteEmail({
                email,
                token: invite_token,
                useOrgTemplate: true,
                req: param.req,
                roles: param.user.roles || OrgUserRoles.VIEWER,
              }))
            )
              return { invite_token, email };
          } else {
            await this.baseUsersService.sendInviteEmail({
              email,
              token: invite_token,
              req: param.req,
              useOrgTemplate: true,
              roles: param.user.roles || OrgUserRoles.VIEWER,
            });
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
        msg: 'success',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async userSettings(_param): Promise<any> {
    NcError.notImplemented();
  }

  async userInviteResend(param: {
    userId: string;
    req: NcRequest;
  }): Promise<any> {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.userNotFound(param.userId);
    }

    const invite_token = uuidv4();

    await User.update(user.id, {
      invite_token,
      invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const pluginData = await Noco.ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
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

    await this.baseUsersService.sendInviteEmail({
      email: user.email,
      token: invite_token,
      req: param.req,
      useOrgTemplate: true,
      roles: user.roles,
    });

    this.appHooksService.emit(AppEvents.ORG_USER_RESEND_INVITE, {
      user: user as UserType,
      req: param.req,
    });

    return true;
  }

  async generateResetUrl(param: { userId: string; siteUrl: string }) {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.userNotFound(param.userId);
    }
    const token = uuidv4();
    await User.update(user.id, {
      email: user.email,
      reset_password_token: token,
      reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
      token_version: randomTokenString(),
    });

    return {
      reset_password_token: token,
      reset_password_url: param.siteUrl + `/dashboard/#/reset/${token}`,
    };
  }

  async appSettingsGet() {
    let settings = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    } catch {}
    return settings;
  }

  async appSettingsSet(param: { settings: any }) {
    await Store.saveOrUpdate({
      value: JSON.stringify(param.settings),
      key: NC_APP_SETTINGS,
    });
    return true;
  }
}
