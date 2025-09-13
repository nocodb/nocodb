import { BaseUsersService as BaseUsersServiceCE } from 'src/services/base-users/base-users.service';
import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  extractRolesObj,
  OrderedProjectRoles,
  OrgUserRoles,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import type { MetaService } from '~/meta/meta.service';
import type { ProjectUserReqType, ProjectUserUpdateReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { randomTokenString } from '~/helpers/stringHelpers';
import { Base, BaseUser, User, Workspace } from '~/models';
import { getProjectRole, getProjectRolePower } from '~/utils/roleHelper';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { PaymentService } from '~/modules/payment/payment.service';
import { checkSeatLimit } from '~/helpers/paymentHelpers';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class BaseUsersService extends BaseUsersServiceCE {
  constructor(
    protected appHooksService: AppHooksService,
    protected readonly mailService: MailService,
    protected readonly paymentService: PaymentService,
  ) {
    super(appHooksService, mailService);
  }

  // restrict user management for non-owner users in private bases
  protected isUserManagementRestricted({
    base,
    req,
  }: {
    base: Base;
    req: NcRequest;
  }) {
    // if non-private base then allow user management
    if (!base.default_role) return;

    // if user is base owner then allow user management
    if (req.user?.base_roles?.[ProjectRoles.OWNER]) return;

    throw NcError.forbidden(
      'User management is restricted to base owners in private bases',
    );
  }
  async preUserInvite(
    context: NcContext,
    param: {
      baseId: string;
      baseUser: ProjectUserReqType;
      req: NcRequest;
      workspaceInvited?: boolean;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUserReq',
      param.baseUser,
    );

    const base = await Base.get(context, param.baseId, ncMeta);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    this.isUserManagementRestricted({
      base,
      req: param.req,
    });

    // restrict user management for non-owners in private bases

    if (
      getProjectRolePower({
        base_roles: extractRolesObj(param.baseUser.roles),
      }) > getProjectRolePower(param.req.user)
    ) {
      NcError.baseUserError(`Insufficient privilege to invite with this role`);
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
      NcError.baseUserError('Invalid role');
    }

    const emails = (param.baseUser.email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim());

    // check for invalid emails
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (!emails.length) {
      NcError.baseUserError('Invalid email address');
    }
    if (invalidEmails.length) {
      NcError.baseUserError(
        'Invalid email address : ' + invalidEmails.join(', '),
      );
    }

    const workspace = await Workspace.get(base.fk_workspace_id, false, ncMeta);

    if (!workspace) {
      NcError.workspaceNotFound(base.fk_workspace_id);
    }
    return { base, emails, workspace };
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
    const { base, emails, workspace } = await this.preUserInvite(
      context,
      param,
      ncMeta,
    );
    const invite_token = uuidv4();
    const error = [];
    const emailUserMap = new Map<string, User>();
    const postOperations = [];

    const transaction = await ncMeta.startTransaction();

    try {
      for (const email of emails) {
        const { postOperations: eachPostOperations } =
          await this.unhandledUserInviteByEmail(
            context,
            {
              email,
              roles: param.baseUser.roles as ProjectRoles,
              base,
              req: param.req,
              emailUserMap,
              invite_token,
              workspaceInvited: param.workspaceInvited,
            },
            transaction,
          );
        postOperations.push(...eachPostOperations);
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      // rollback cache
      const cacheTransaction = [];

      for (const email of emails) {
        const user = emailUserMap.get(email);
        cacheTransaction.push(
          `${CacheScope.BASE_USER}:${param.baseId}:${user.id}`,
        );
        cacheTransaction.push(
          `${CacheScope.WORKSPACE_USER}:${context.workspace_id}:${user.id}`,
        );
      }

      await NocoCache.del(cacheTransaction);

      throw e;
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    await Promise.all(postOperations.map((fn) => fn()));

    if (emails.length === 1) {
      return {
        msg: 'The user has been invited successfully',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async prepareUserInviteByEmail(
    context: NcContext,
    param: {
      email: string;
      roles?: ProjectRoles;
      req: NcRequest;
      baseId: string;
      workspaceInvited?: boolean;
      invite_token?: string;
      // to keep refactor at minimum, we pass emailUserMap
      emailUserMap?: Map<string, User>;
    },
    ncMeta?: MetaService,
  ) {
    const { email, emailUserMap = new Map(), baseId } = param;

    const { base } = await this.preUserInvite(
      context,
      {
        baseId,
        baseUser: {
          email: param.email,
          roles: param.roles,
        },
        req: param.req,
        workspaceInvited: param.workspaceInvited,
      },
      ncMeta,
    );
    return {
      execute: () => {
        return this.unhandledUserInviteByEmail(
          context,
          {
            ...param,
            emailUserMap,
            base,
          },
          ncMeta,
        );
      },
      rollback: async () => {
        // rollback cache
        const cacheTransaction = [];

        const user = emailUserMap.get(email);
        if (user) {
          cacheTransaction.push(
            `${CacheScope.BASE_USER}:${base.id}:${user.id}`,
          );
          cacheTransaction.push(
            `${CacheScope.WORKSPACE_USER}:${context.workspace_id}:${user.id}`,
          );

          await NocoCache.del(cacheTransaction);
        }
      },
    };
  }

  async unhandledUserInviteByEmail(
    context: NcContext,
    param: {
      email: string;
      roles?: ProjectRoles;
      req: NcRequest;
      base: Base;
      workspaceInvited?: boolean;
      invite_token?: string;
      // to keep refactor at minimum, we pass emailUserMap
      emailUserMap?: Map<string, User>;
    },
    ncMeta?: MetaService,
  ) {
    const postOperations = [];
    const { email, invite_token = uuidv4(), emailUserMap, roles, base } = param;
    // add user to base if user already exist
    const user = await User.getByEmail(email, ncMeta);
    if (user) {
      emailUserMap?.set(email, user);
      // check if this user has been added to this base
      const baseUser = await BaseUser.get(context, base.id, user.id, ncMeta);

      const targetUser =
        baseUser &&
        (await User.getWithRoles(
          context,
          user.id,
          {
            user,
            baseId: base.id,
            workspaceId: base.fk_workspace_id,
          },
          ncMeta,
        ));

      // if old role is owner and there is only one owner then restrict update
      if (targetUser && this.isOldRoleIsOwner(targetUser)) {
        const baseUsers = await BaseUser.getUsersList(
          context,
          {
            base_id: base.id,
          },
          ncMeta,
        );
        this.checkMultipleOwnerExist(baseUsers, base);
        await this.ensureBaseOwner(
          context,
          {
            baseUsers,
            ignoreUserId: user.id,
            baseId: base.id,
            req: param.req,
          },
          ncMeta,
        );
      }

      // if already exists and has a role then return error
      if (baseUser?.is_mapped && baseUser?.roles) {
        NcError.get(context).invalidRequestBody(
          `${user.email} with role ${baseUser.roles} already exists in this base`,
        );
      }

      // if user exist and role is not assigned then assign role by updating base user
      else if (baseUser?.is_mapped) {
        await checkSeatLimit(
          base.fk_workspace_id,
          baseUser.fk_user_id,
          baseUser.roles as ProjectRoles,
          roles as ProjectRoles,
          ncMeta,
        );

        await BaseUser.updateRoles(context, base.id, user.id, roles, ncMeta);

        postOperations.push(() => {
          this.mailService
            .sendMail({
              mailEvent: MailEvent.BASE_ROLE_UPDATE,
              payload: {
                req: param.req,
                user: user,
                base: base,
                oldRole: (getProjectRole(baseUser) ??
                  WorkspaceRolesToProjectRoles[
                    (baseUser as any)?.workspace_roles
                  ]) as ProjectRoles,
                newRole: (roles || 'editor') as ProjectRoles,
              },
            })
            .catch(() => {});
          NocoSocket.broadcastEventToBaseUsers(
            context,
            {
              event: EventType.USER_EVENT,
              payload: {
                action: 'base_user_update',
                payload: baseUser,
              },
            },
            context.socket_id,
          );
        });
      } else {
        await checkSeatLimit(
          base.fk_workspace_id,
          null,
          ProjectRoles.NO_ACCESS,
          roles as ProjectRoles,
          ncMeta,
        );

        await BaseUser.insert(
          context,
          {
            base_id: base.id,
            fk_user_id: user.id,
            roles: roles || 'editor',
            invited_by: param.req?.user?.id,
          },
          ncMeta,
        );

        if (param?.workspaceInvited) {
          postOperations.push(() =>
            this.mailService
              .sendMail({
                mailEvent: MailEvent.BASE_INVITE,
                payload: {
                  req: param.req,
                  user: user,
                  base: base,
                  role: (roles || 'editor') as ProjectRoles,
                  token: invite_token,
                },
              })
              .catch(() => {}),
          );
        } else {
          postOperations.push(() =>
            this.mailService
              .sendMail({
                mailEvent: MailEvent.BASE_ROLE_UPDATE,
                payload: {
                  req: param.req,
                  user: user,
                  base: base,
                  oldRole: (getProjectRole(baseUser) ??
                    WorkspaceRolesToProjectRoles[
                      (baseUser as any)?.workspace_roles
                    ]) as ProjectRoles,
                  newRole: (roles || 'editor') as ProjectRoles,
                },
              })
              .catch(() => {}),
          );
        }
      }

      postOperations.push(() =>
        this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
          base,
          user,
          role: roles,
          invitedBy: param.req?.user,
          req: param.req,
          context,
        }),
      );
    } else {
      await checkSeatLimit(
        base.fk_workspace_id,
        null,
        ProjectRoles.NO_ACCESS,
        roles,
        ncMeta,
      );

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

      emailUserMap?.set(email, user);

      const newBaseUser = await BaseUser.insert(
        context,
        {
          base_id: base.id,
          fk_user_id: user.id,
          roles: roles,
          invited_by: param.req?.user?.id,
        },
        ncMeta,
      );

      postOperations.push(() => {
        this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
          base,
          user,
          role: roles,
          req: param.req,
          invitedBy: param.req?.user,
          context,
        });
        NocoSocket.broadcastEventToBaseUsers(
          context,
          {
            event: EventType.USER_EVENT,
            payload: {
              action: 'base_user_add',
              payload: {
                baseUser: newBaseUser,
                base,
              },
            },
          },
          context.socket_id,
        );
      });

      postOperations.push(() =>
        this.mailService
          .sendMail({
            mailEvent: MailEvent.BASE_INVITE,
            payload: {
              req: param.req,
              user: user,
              base: base,
              token: invite_token,
              role: (roles || 'editor') as ProjectRoles,
            },
          })
          .catch(() => {}),
      );
    }

    return {
      postOperations,
      user,
    };
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
      NcError.baseUserError('Missing base id');
    }

    const base = await Base.get(context, param.baseId, ncMeta);

    if (!base) {
      return NcError.baseNotFound(param.baseId);
    }

    this.isUserManagementRestricted({
      base,
      req: param.req,
    });

    const workspace = await Workspace.get(base.fk_workspace_id, false, ncMeta);

    if (!workspace) {
      return NcError.workspaceNotFound(base.fk_workspace_id);
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
      NcError.baseUserError('Invalid role');
    }

    const user = await User.get(param.userId, ncMeta);

    if (!user) {
      NcError.baseUserError(`User with id '${param.userId}' doesn't exist`);
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
      NcError.baseUserError(
        `User with id '${param.userId}' doesn't exist in this base`,
      );
    }

    const oldBaseUser = await BaseUser.get(
      context,
      param.baseId,
      param.userId,
      ncMeta,
    );

    const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
    const newRolePower = reverseOrderedProjectRoles.indexOf(
      param.baseUser.roles as ProjectRoles,
    );

    // Check if current user has sufficient privilege to assign this role
    if (newRolePower > getProjectRolePower(param.req.user)) {
      NcError.forbidden(`Insufficient privilege to assign this role`);
    }

    const transaction = await ncMeta.startTransaction();

    try {
      if (
        getProjectRolePower(targetUser) > getProjectRolePower(param.req.user)
      ) {
        NcError.forbidden(`Insufficient privilege to update user`);
      }

      // if old role is owner and there is only one owner then restrict update
      if (this.isOldRoleIsOwner(targetUser)) {
        const baseUsers = await BaseUser.getUsersList(
          context,
          {
            base_id: param.baseId,
          },
          transaction,
        );
        this.checkMultipleOwnerExist(baseUsers, base);
        await this.ensureBaseOwner(
          context,
          {
            baseUsers,
            ignoreUserId: param.userId,
            baseId: param.baseId,
            req: param.req,
          },
          transaction,
        );
      }

      await checkSeatLimit(
        workspace.id,
        oldBaseUser.fk_user_id,
        oldBaseUser.roles as ProjectRoles,
        param.baseUser.roles as ProjectRoles,
        transaction,
      );

      await BaseUser.updateRoles(
        context,
        param.baseId,
        param.userId,
        param.baseUser.roles,
        transaction,
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    await this.mailService.sendMail({
      mailEvent: MailEvent.BASE_ROLE_UPDATE,
      payload: {
        req: param.req,
        user: user,
        base,
        oldRole: getProjectRole(targetUser),
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

    const newBaseUser = await BaseUser.get(
      context,
      param.baseId,
      param.userId,
      ncMeta,
    );

    NocoSocket.broadcastEventToBaseUsers(
      context,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_user_update',
          payload: newBaseUser,
        },
      },
      context.socket_id,
    );

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
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base_id = param.baseId;

    if (param.req.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    const base = await Base.get(context, base_id);

    if (!base) {
      NcError.baseNotFound(base_id);
    }

    this.isUserManagementRestricted({
      base,
      req: param.req,
    });

    const user = await User.get(param.userId);

    if (!user) {
      NcError.userNotFound(param.userId);
    }

    const workspace = await Workspace.get(base.fk_workspace_id);

    if (!workspace) {
      NcError.workspaceNotFound(base.fk_workspace_id);
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

    const transaction = await ncMeta.startTransaction();

    try {
      // check if user have access to delete user based on role power
      if (
        getProjectRolePower(baseUser.base_roles) >
        getProjectRolePower(param.req.user)
      ) {
        NcError.forbidden('Insufficient privilege to delete user');
      }

      // if old role is owner and there is only one owner then restrict to delete
      if (this.isOldRoleIsOwner(baseUser)) {
        const baseUsers = await BaseUser.getUsersList(
          context,
          {
            base_id: param.baseId,
          },
          transaction,
        );
        this.checkMultipleOwnerExist(baseUsers, base);
        await this.ensureBaseOwner(
          context,
          {
            baseUsers,
            ignoreUserId: param.userId,
            baseId: param.baseId,
            req: param.req,
          },
          transaction,
        );
      }

      // block self delete if user is owner or super
      if (
        param.req.user.id === param.userId &&
        param.req.user.roles.includes('owner')
      ) {
        NcError.forbidden("Admin can't delete themselves!");
      }
      await BaseUser.delete(context, base_id, param.userId, transaction);

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    await this.paymentService.reseatSubscription(workspace.id, ncMeta);

    this.appHooksService.emit(AppEvents.PROJECT_USER_DELETE, {
      base,
      user,
      req: param.req,
      context,
    });

    // base user is not deleted fully as it is scoped to workspace hence we get inherited role
    const newBaseUser = await BaseUser.get(
      context,
      base_id,
      param.userId,
      ncMeta,
    );

    // broadcast to user which we removed
    NocoSocket.broadcastEventToUser(
      param.userId,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_user_remove',
          payload: newBaseUser,
        },
      },
      context.socket_id,
    );

    // broadcast to base users
    NocoSocket.broadcastEventToBaseUsers(
      context,
      {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_user_remove',
          payload: newBaseUser,
        },
      },
      context.socket_id,
    );

    return true;
  }
}
