import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
  OrgUserRoles,
  PluginCategory,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { NC_APP_SETTINGS } from '../constants';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { extractProps } from '../helpers/extractProps';
import { randomTokenString } from '../helpers/stringHelpers';
import { Audit, ProjectUser, Store, SyncSource, User } from '../models';

import Noco from '../Noco';
import extractRolesObj from '../utils/extractRolesObj';
import { MetaTable } from '../utils/globals';
import { AppHooksService } from './app-hooks/app-hooks.service';
import { ProjectUsersService } from './project-users/project-users.service';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class OrgUsersService {
  constructor(
    private readonly projectUSerService: ProjectUsersService,
    private readonly appHooksService: AppHooksService,
  ) {}

  async userList(param: {
    // todo: add better typing
    query: Record<string, any>;
  }) {
    return await User.list(param.query);
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
      token_version: null,
    });
  }

  async userDelete(param: { userId: string }) {
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      const user = await User.get(param.userId, ncMeta);

      if (extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN]) {
        NcError.badRequest('Cannot delete super admin');
      }

      // delete project user entry and assign to super admin
      const projectUsers = await ProjectUser.getProjectsIdList(
        param.userId,
        ncMeta,
      );

      // todo: clear cache

      // TODO: assign super admin as project owner
      for (const projectUser of projectUsers) {
        await ProjectUser.delete(
          projectUser.project_id,
          projectUser.fk_user_id,
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
    req: any;
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
      // add user to project if user already exist
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
            invitedBy: param.req.user,
            user,
            count,
            ip: param.req.clientIp,
          });

          // in case of single user check for smtp failure
          // and send back token if failed
          if (
            emails.length === 1 &&
            !(await this.projectUSerService.sendInviteEmail(
              email,
              invite_token,
              param.req,
            ))
          ) {
            return { invite_token, email };
          } else {
            this.projectUSerService.sendInviteEmail(
              email,
              invite_token,
              param.req,
            );
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

  async userInviteResend(param: { userId: string; req: any }): Promise<any> {
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

    await this.projectUSerService.sendInviteEmail(
      user.email,
      invite_token,
      param.req,
    );

    this.appHooksService.emit(AppEvents.ORG_USER_RESEND_INVITE, {
      invitedBy: param.req.user,
      user,
      ip: param.req.clientIp,
    });

    return true;
  }

  async generateResetUrl(param: { userId: string; siteUrl: string }) {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' not found`);
    }
    const token = uuidv4();
    await User.update(user.id, {
      email: user.email,
      reset_password_token: token,
      reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
      token_version: null,
    });

    return {
      reset_password_token: token,
      reset_password_url: param.siteUrl + `/auth/password/reset/${token}`,
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
