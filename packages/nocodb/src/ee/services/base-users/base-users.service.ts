import { BaseUsersService as BaseUsersServiceCE } from 'src/services/base-users/base-users.service';
import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrderedProjectRoles,
  OrgUserRoles,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
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

@Injectable()
export class BaseUsersService extends BaseUsersServiceCE {
  constructor(
    protected appHooksService: AppHooksService,
    protected readonly mailService: MailService,
    protected readonly paymentService: PaymentService,
  ) {
    super(appHooksService, mailService);
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
      return NcError.baseUserError('Invalid email address');
    }
    if (invalidEmails.length) {
      NcError.baseUserError(
        'Invalid email address : ' + invalidEmails.join(', '),
      );
    }

    const base = await Base.get(context, param.baseId, ncMeta);

    if (!base) {
      return NcError.baseNotFound(param.baseId);
    }

    const workspace = await Workspace.get(base.fk_workspace_id, false, ncMeta);

    if (!workspace) {
      return NcError.workspaceNotFound(base.fk_workspace_id);
    }

    const invite_token = uuidv4();
    const error = [];
    const emailUserMap = new Map<string, User>();
    const postOperations = [];

    const transaction = await ncMeta.startTransaction();

    try {
      for (const email of emails) {
        // add user to base if user already exist
        const user = await User.getByEmail(email, transaction);
        if (user) {
          emailUserMap.set(email, user);
          // check if this user has been added to this base
          const baseUser = await BaseUser.get(
            context,
            param.baseId,
            user.id,
            transaction,
          );

          const targetUser =
            baseUser &&
            (await User.getWithRoles(
              context,
              user.id,
              {
                user,
                baseId: param.baseId,
                workspaceId: context.workspace_id,
              },
              ncMeta,
            ));

          // if old role is owner and there is only one owner then restrict update
          if (targetUser && this.isOldRoleIsOwner(targetUser)) {
            const baseUsers = await BaseUser.getUsersList(
              context,
              {
                base_id: param.baseId,
              },
              ncMeta,
            );
            this.checkMultipleOwnerExist(baseUsers);
            await this.ensureBaseOwner(context, {
              baseUsers,
              ignoreUserId: user.id,
              baseId: param.baseId,
              req: param.req,
            });
          }

          // if already exists and has a role then return error
          if (baseUser?.is_mapped && baseUser?.roles) {
            throw new Error(
              `${user.email} with role ${baseUser.roles} already exists in this base`,
            );
          }

          // if user exist and role is not assigned then assign role by updating base user
          else if (baseUser?.is_mapped) {
            await checkSeatLimit(
              workspace.id,
              baseUser.fk_user_id,
              baseUser.roles as ProjectRoles,
              param.baseUser.roles as ProjectRoles,
              transaction,
            );

            await BaseUser.updateRoles(
              context,
              param.baseId,
              user.id,
              param.baseUser.roles,
              transaction,
            );

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
                    newRole: (param.baseUser.roles || 'editor') as ProjectRoles,
                  },
                })
                .catch(() => {}),
            );
          } else {
            await checkSeatLimit(
              workspace.id,
              null,
              ProjectRoles.NO_ACCESS,
              param.baseUser.roles as ProjectRoles,
              transaction,
            );

            await BaseUser.insert(
              context,
              {
                base_id: param.baseId,
                fk_user_id: user.id,
                roles: param.baseUser.roles || 'editor',
                invited_by: param.req?.user?.id,
              },
              transaction,
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
                      role: (param.baseUser.roles || 'editor') as ProjectRoles,
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
                      newRole: (param.baseUser.roles ||
                        'editor') as ProjectRoles,
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
              role: param.baseUser.roles,
              invitedBy: param.req?.user,
              req: param.req,
              context,
            }),
          );
        } else {
          await checkSeatLimit(
            workspace.id,
            null,
            ProjectRoles.NO_ACCESS,
            param.baseUser.roles as ProjectRoles,
            transaction,
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
            transaction,
          );

          emailUserMap.set(email, user);

          await BaseUser.insert(
            context,
            {
              base_id: param.baseId,
              fk_user_id: user.id,
              roles: param.baseUser.roles,
              invited_by: param.req?.user?.id,
            },
            transaction,
          );

          postOperations.push(() =>
            this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
              base,
              user,
              role: param.baseUser.roles,
              req: param.req,
              invitedBy: param.req?.user,
              context,
            }),
          );

          if (emails.length === 1) {
            postOperations.push(() =>
              this.mailService
                .sendMail({
                  mailEvent: MailEvent.BASE_INVITE,
                  payload: {
                    req: param.req,
                    user: user,
                    base: base,
                    role: (param.baseUser.roles || 'editor') as ProjectRoles,
                    token: invite_token,
                  },
                })
                .catch(() => {}),
            );
          } else {
            postOperations.push(() =>
              this.mailService
                .sendMail({
                  mailEvent: MailEvent.BASE_INVITE,
                  payload: {
                    req: param.req,
                    user: user,
                    base: base,
                    token: invite_token,
                    role: (param.baseUser.roles || 'editor') as ProjectRoles,
                  },
                })
                .catch(() => {}),
            );
          }
        }
      }

      await this.paymentService.reseatSubscription(
        workspace.fk_org_id ?? workspace.id,
        transaction,
      );

      await transaction.commit();

      await Promise.all(postOperations.map((fn) => fn()));
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
      NcError.baseUserError('Missing base id');
    }

    const base = await Base.get(context, param.baseId, ncMeta);

    if (!base) {
      return NcError.baseNotFound(param.baseId);
    }

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
      NcError.baseUserError(`Insufficient privilege to assign this role`);
    }

    const transaction = await ncMeta.startTransaction();

    try {
      if (
        getProjectRolePower(targetUser) > getProjectRolePower(param.req.user)
      ) {
        NcError.baseUserError(`Insufficient privilege to update user`);
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
        this.checkMultipleOwnerExist(baseUsers);
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

      await this.paymentService.reseatSubscription(
        workspace.fk_org_id ?? workspace.id,
        transaction,
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

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
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base_id = param.baseId;

    if (param.req.user?.id === param.userId) {
      NcError.baseUserError("Admin can't delete themselves!");
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.userNotFound(param.userId);
    }

    const base = await Base.get(context, base_id);

    if (!base) {
      NcError.baseNotFound(base_id);
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
        NcError.baseUserError('Insufficient privilege to delete user');
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
        this.checkMultipleOwnerExist(baseUsers);
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
        NcError.baseUserError("Admin can't delete themselves!");
      }
      await BaseUser.delete(context, base_id, param.userId, transaction);

      await this.paymentService.reseatSubscription(
        workspace.fk_org_id ?? workspace.id,
        transaction,
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    this.appHooksService.emit(AppEvents.PROJECT_USER_DELETE, {
      base,
      user,
      req: param.req,
      context,
    });

    return true;
  }
}
