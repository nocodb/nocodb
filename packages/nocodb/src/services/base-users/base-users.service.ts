import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrderedProjectRoles,
  OrgUserRoles,
  PluginCategory,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import type {
  ProjectUserReqType,
  ProjectUserUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { randomTokenString } from '~/helpers/stringHelpers';
import { Base, BaseUser, PresignedUrl, User } from '~/models';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { getProjectRole, getProjectRolePower } from '~/utils/roleHelper';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';

@Injectable()
export class BaseUsersService {
  protected readonly logger = new Logger(BaseUsersService.name);

  constructor(
    protected appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {}

  async userList(
    context: NcContext,
    param: { baseId: string; mode?: 'full' | 'viewer' },
  ) {
    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: param.baseId,
      mode: param.mode,
    });

    await PresignedUrl.signMetaIconImage(baseUsers);

    return new PagedResponseImpl(baseUsers, {
      count: baseUsers.length,
    });
  }

  async userInvite(
    context: NcContext,
    param: {
      baseId: string;
      baseUser: ProjectUserReqType;
      req: NcRequest;
      workspaceInvited?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
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
        ProjectRoles.OWNER,
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
      const user = await User.getByEmail(email, ncMeta);

      const base = await Base.get(context, param.baseId, ncMeta);

      if (!base) {
        return NcError.baseNotFound(param.baseId);
      }

      if (user) {
        // check if this user has been added to this base
        const baseUser = await BaseUser.get(
          context,
          param.baseId,
          user.id,
          ncMeta,
        );
        // if already exists and has a role then throw error
        if (baseUser?.is_mapped && baseUser?.roles) {
          NcError.badRequest(
            `${user.email} with role ${baseUser.roles} already exists in this base`,
          );
        }
        // if user exist and role is not assigned then assign role by updating base user
        else if (baseUser?.is_mapped) {
          await BaseUser.updateRoles(
            context,
            param.baseId,
            user.id,
            param.baseUser.roles,
            ncMeta,
          );
          await this.mailService.sendMail({
            mailEvent: MailEvent.BASE_ROLE_UPDATE,
            payload: {
              req: param.req,
              user: user,
              base: base,
              oldRole: (getProjectRole(baseUser) ??
                WorkspaceRolesToProjectRoles[
                  (baseUser as any)?.workspace_roles
                ]) as ProjectRoles,
              newRole: (param.baseUser.roles || 'editor') as ProjectRoles,
            },
          });
        } else {
          await BaseUser.insert(
            context,
            {
              base_id: param.baseId,
              fk_user_id: user.id,
              roles: param.baseUser.roles || 'editor',
              invited_by: param.req?.user?.id,
            },
            ncMeta,
          );

          if (param?.workspaceInvited) {
            await this.mailService.sendMail({
              mailEvent: MailEvent.BASE_INVITE,
              payload: {
                req: param.req,
                user: user,
                base: base,
                role: (param.baseUser.roles || 'editor') as ProjectRoles,
                token: invite_token,
              },
            });
          } else {
            await this.mailService.sendMail({
              mailEvent: MailEvent.BASE_ROLE_UPDATE,
              payload: {
                req: param.req,
                user: user,
                base: base,
                oldRole: (getProjectRole(baseUser) ??
                  WorkspaceRolesToProjectRoles[
                    (baseUser as any)?.workspace_roles
                  ]) as ProjectRoles,
                newRole: (param.baseUser.roles || 'editor') as ProjectRoles,
              },
            });
          }
        }

        this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
          base,
          user,
          role: param.baseUser.roles,
          invitedBy: param.req?.user,
          req: param.req,
          context,
        });
      } else {
        try {
          // create new user with invite token
          const user = await User.insert(
            {
              invite_token,
              invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
              email,
              roles: OrgUserRoles.VIEWER,
              token_version: randomTokenString(),
            },
            ncMeta,
          );

          // add user to base
          await BaseUser.insert(
            context,
            {
              base_id: param.baseId,
              fk_user_id: user.id,
              roles: param.baseUser.roles,
              invited_by: param.req?.user?.id,
            },
            ncMeta,
          );

          this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
            base,
            user,
            role: param.baseUser.roles,
            req: param.req,
            invitedBy: param.req?.user,
            context,
          });

          if (emails.length === 1) {
            try {
              await this.mailService.sendMail({
                mailEvent: MailEvent.BASE_INVITE,
                payload: {
                  req: param.req,
                  user: user,
                  base: base,
                  role: (param.baseUser.roles || 'editor') as ProjectRoles,
                  token: invite_token,
                },
              });
            } catch (e) {
              this.logger.error(e.message, e.stack);
              return { invite_token, email };
            }
          } else {
            await this.mailService.sendMail({
              mailEvent: MailEvent.BASE_INVITE,
              payload: {
                req: param.req,
                user: user,
                base: base,
                token: invite_token,
                role: (param.baseUser.roles || 'editor') as ProjectRoles,
              },
            });
          }
        } catch (e) {
          this.logger.error(e.message, e.stack);
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

  async baseUserUpdate(
    context: NcContext,
    param: {
      userId: string;
      baseUser: ProjectUserUpdateReqType;
      req: NcRequest;
      baseId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserUpdateReq',
      param.baseUser,
    );

    if (!param.baseId) {
      NcError.badRequest('Missing base id');
    }

    const base = await Base.get(context, param.baseId, ncMeta);

    if (!base) {
      return NcError.baseNotFound(param.baseId);
    }

    if (
      ![
        ProjectRoles.OWNER,
        ProjectRoles.CREATOR,
        ProjectRoles.EDITOR,
        ProjectRoles.COMMENTER,
        ProjectRoles.VIEWER,
        ProjectRoles.NO_ACCESS,
      ].includes(param.baseUser.roles as ProjectRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const user = await User.get(param.userId, ncMeta);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' doesn't exist`);
    }

    const targetUser = await User.getWithRoles(
      context,
      param.userId,
      {
        user,
        baseId: param.baseId,
      },
      ncMeta,
    );

    if (!targetUser) {
      NcError.badRequest(
        `User with id '${param.userId}' doesn't exist in this base`,
      );
    }

    // if old role is owner and there is only one owner then restrict to update
    if (extractRolesObj(targetUser.base_roles)?.[ProjectRoles.OWNER]) {
      const baseUsers = await BaseUser.getUsersList(
        context,
        {
          base_id: param.baseId,
        },
        ncMeta,
      );
      if (
        baseUsers.filter((u) => u.roles?.includes(ProjectRoles.OWNER))
          .length === 1
      )
        NcError.badRequest('At least one owner is required');
    }
    const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
    const newRolePower = reverseOrderedProjectRoles.indexOf(
      param.baseUser.roles as ProjectRoles,
    );

    // Check if current user has sufficient privilege to assign this role
    if (newRolePower > getProjectRolePower(param.req.user)) {
      NcError.badRequest(`Insufficient privilege to assign this role`);
    }

    if (getProjectRolePower(targetUser) > getProjectRolePower(param.req.user)) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    const oldBaseUser = await BaseUser.get(
      context,
      param.baseId,
      param.userId,
      ncMeta,
    );

    await BaseUser.updateRoles(
      context,
      param.baseId,
      param.userId,
      param.baseUser.roles,
      ncMeta,
    );

    await this.mailService.sendMail({
      mailEvent: MailEvent.BASE_ROLE_UPDATE,
      payload: {
        req: param.req,
        user: user,
        base,
        oldRole: (getProjectRole(targetUser) ??
          WorkspaceRolesToProjectRoles[
            (targetUser as any)?.workspace_roles
          ]) as ProjectRoles,
        newRole: (param.baseUser.roles || 'editor') as ProjectRoles,
      },
    });

    this.appHooksService.emit(AppEvents.PROJECT_USER_UPDATE, {
      base,
      user,
      baseUser: param.baseUser,
      oldBaseUser: oldBaseUser as Partial<ProjectUserReqType>,
      req: param.req,
      context,
    });

    return {
      msg: 'User has been updated successfully',
    };
  }

  async baseUserDelete(
    context: NcContext,
    param: {
      baseId: string;
      userId: string;
      // todo: refactor
      req: any;
    },
  ): Promise<any> {
    const base_id = param.baseId;

    if (param.req.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    const user = await User.get(param.userId);

    const base = await Base.get(context, base_id);

    if (!user) {
      NcError.userNotFound(param.userId);
    }

    if (!param.req.user?.base_roles?.owner) {
      if (user.roles?.split(',').includes('super'))
        NcError.forbidden(
          'Insufficient privilege to delete a super admin user.',
        );
    }

    const baseUser = await User.getWithRoles(context, param.userId, {
      baseId: base_id,
    });

    // check if user have access to delete user based on role power
    if (
      getProjectRolePower(baseUser.base_roles) >
      getProjectRolePower(param.req.user)
    ) {
      NcError.badRequest('Insufficient privilege to delete user');
    }

    // if old role is owner and there is only one owner then restrict to delete
    if (extractRolesObj(baseUser.base_roles)?.[ProjectRoles.OWNER]) {
      const baseUsers = await BaseUser.getUsersList(context, {
        base_id: param.baseId,
      });
      if (
        baseUsers.filter((u) => u.roles?.includes(ProjectRoles.OWNER))
          .length === 1
      )
        NcError.badRequest('At least one owner is required');
    }

    // block self delete if user is owner or super
    if (
      param.req.user.id === param.userId &&
      param.req.user.roles.includes('owner')
    ) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    await BaseUser.delete(context, base_id, param.userId);

    this.appHooksService.emit(AppEvents.PROJECT_USER_DELETE, {
      base,
      user,
      req: param.req,
      context,
    });
    return true;
  }

  async baseUserInviteResend(
    context: NcContext,
    param: {
      userId: string;
      baseUser: ProjectUserReqType;
      baseId: string;
      // todo: refactor
      req: any;
    },
  ): Promise<any> {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' not found`);
    }

    const base = await Base.get(context, param.baseId);

    if (!base) {
      return NcError.baseNotFound(param.baseId);
    }

    const invite_token = uuidv4();

    await User.update(user.id, {
      invite_token,
      invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const baseUser = await BaseUser.get(context, param.baseId, user.id);

    const pluginData = await Noco.ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
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

    await this.mailService.sendMail({
      mailEvent: MailEvent.BASE_INVITE,
      payload: {
        req: param.req,
        user: user,
        base: base,
        role: (baseUser.roles || 'editor') as ProjectRoles,
        token: invite_token,
      },
    });

    this.appHooksService.emit(AppEvents.PROJECT_USER_RESEND_INVITE, {
      base,
      user,
      baseUser: param.baseUser,
      req: param.req,
      context,
    });

    return true;
  }

  async baseUserMetaUpdate(
    context: NcContext,
    param: {
      body: any;
      baseId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // update base user data
    const baseUserData = extractProps(param.body, [
      'starred',
      'order',
      'hidden',
    ]);

    const base = await Base.get(context, param.baseId);

    if (Object.keys(baseUserData).length) {
      const existingBaseUserData = await BaseUser.get(
        context,
        param.baseId,
        param.user?.id,
      );

      // create new base user if it doesn't exist
      if (!existingBaseUserData?.is_mapped) {
        await BaseUser.insert(context, {
          ...baseUserData,
          base_id: param.baseId,
          fk_user_id: param.user?.id,
        });
        this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
          base: base,
          updateObj: baseUserData,
          oldBaseObj: { ...base, ...existingBaseUserData },
          user: param.user,
          req: param.req,
          context,
        });
      } else {
        await BaseUser.update(
          context,
          param.baseId,
          param.user?.id,
          baseUserData,
        );
        this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
          base: base,
          updateObj: baseUserData,
          oldBaseObj: { ...base, ...existingBaseUserData },
          user: param.user,
          req: param.req,
          context,
        });
      }
    }

    return true;
  }
}
