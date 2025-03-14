import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import {
  AppEvents,
  CloudOrgUserRoles,
  extractRolesObj,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { ConfigService } from '@nestjs/config';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { WorkspaceUserDeleteEvent } from '~/services/app-hooks/interfaces';
import WorkspaceUser from '~/models/WorkspaceUser';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import validateParams from '~/helpers/validateParams';
import { NcError } from '~/helpers/catchError';
import { Base, BaseUser, PresignedUrl, User } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Workspace from '~/models/Workspace';
import { UsersService } from '~/services/users/users.service';
import { MailService } from '~/services/mail/mail.service';
import { getWorkspaceRolePower } from '~/utils/roleHelper';
import Noco from '~/Noco';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { MailEvent } from '~/interface/Mail';
import { PaymentService } from '~/modules/payment/payment.service';

@Injectable()
export class WorkspaceUsersService {
  constructor(
    private appHooksService: AppHooksService,
    private usersService: UsersService,
    private config: ConfigService<AppConfig>,
    private mailService: MailService,
    private paymentService: PaymentService,
  ) {}

  async list(param: { workspaceId; includeDeleted?: boolean }) {
    const users = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: param.includeDeleted,
    });

    await PresignedUrl.signMetaIconImage(users);
    // todo: pagination
    return new PagedResponseImpl<WorkspaceType>(users, {
      count: users.length,
    });
  }

  async count(param: { workspaceId; includeDeleted?: boolean }) {
    return await WorkspaceUser.count({
      workspaceId: param.workspaceId,
      include_deleted: param.includeDeleted,
    });
  }

  async get({ workspaceId, userId }) {
    const user = await WorkspaceUser.get(workspaceId, userId);

    if (!user) NcError.userNotFound(userId);

    await PresignedUrl.signMetaIconImage(user);

    return user;
  }

  async update(
    param: {
      workspaceId: string;
      userId: string;
      roles: WorkspaceUserRoles;
      siteUrl: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceUser = await WorkspaceUser.get(
      param.workspaceId,
      param.userId,
      ncMeta,
    );

    if (!workspaceUser)
      NcError.userNotFound('User is not a member of this workspace');

    const isOrgOwner = extractRolesObj(
      (param.req.user as any).org_roles as any,
    )?.[CloudOrgUserRoles.OWNER];

    // check current user have permission to update user by checking role power
    if (
      !isOrgOwner &&
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(workspaceUser.roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    // check user have update role to target role by checking role power
    if (
      !isOrgOwner &&
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(param.roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(
        `Insufficient privilege to update user with this role`,
      );
    }

    const user = await User.get(param.userId, ncMeta);

    if (!user) NcError.userNotFound(param.userId);

    const workspace = await Workspace.get(param.workspaceId, undefined, ncMeta);

    if (!workspace) NcError.workspaceNotFound(param.workspaceId);

    if (
      ![
        WorkspaceUserRoles.OWNER,
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
        WorkspaceUserRoles.NO_ACCESS,
      ].includes(param.roles)
    ) {
      NcError.badRequest('Invalid role');
    }

    // if old role is owner and there is only one owner then restrict to update
    if (workspaceUser.roles === WorkspaceUserRoles.OWNER) {
      const wsOwners = await WorkspaceUser.userList(
        {
          fk_workspace_id: workspace.id,
          roles: WorkspaceUserRoles.OWNER,
        },
        ncMeta,
      );

      if (wsOwners.length === 1) {
        NcError.badRequest('At least one owner should be there');
      }
    }

    const transaction = await ncMeta.startTransaction();

    try {
      await WorkspaceUser.update(
        param.workspaceId,
        param.userId,
        {
          roles: param.roles,
        },
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

    this.mailService
      .sendMail({
        mailEvent: MailEvent.WORKSPACE_ROLE_UPDATE,
        payload: {
          workspace,
          user,
          oldRole: workspaceUser.roles as WorkspaceUserRoles,
          req: param.req,
          newRole: param.roles,
        },
      })
      .then(() => {
        /* ignore */
      });

    await PresignedUrl.signMetaIconImage(workspaceUser);

    this.appHooksService.emit(AppEvents.WORKSPACE_USER_UPDATE, {
      workspace,
      user,
      req: param.req,
      workspaceUser: {
        roles: param.roles,
      },
      oldWorkspaceUser: workspaceUser,
    });

    return workspaceUser;
  }

  async delete(
    param: { workspaceId: string; userId: string; req: NcRequest },
    ncMeta = Noco.ncMeta,
  ) {
    const { workspaceId, userId } = param;

    const workspace = await Workspace.get(workspaceId);

    const user = await User.get(userId);
    const workspaceUser = await WorkspaceUser.get(workspaceId, userId, ncMeta);

    if (!workspaceUser) NcError.userNotFound(userId);

    if (workspaceUser.roles === WorkspaceUserRoles.OWNER) {
      // current workspaceUser should have owner role to delete owner
      if (
        !extractRolesObj(param.req.user.workspace_roles)?.[
          WorkspaceUserRoles.OWNER
        ]
      ) {
        NcError.badRequest('Insufficient privilege to delete owner');
      }

      // at least one owner should be there after deletion
      const owners = await WorkspaceUser.userList({
        fk_workspace_id: workspaceId,
        roles: WorkspaceUserRoles.OWNER,
      });

      if (owners.length < 2) {
        NcError.badRequest('At least one owner should be there');
      }
    }

    // for other workspaceUser delete workspaceUser should have higher or equal role
    if (
      getWorkspaceRolePower(workspaceUser) >
      getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to delete user`);
    }

    // if not owner/creator then workspaceUser can only delete self
    if (
      ![WorkspaceUserRoles.OWNER, WorkspaceUserRoles.CREATOR].some((r) => {
        return extractRolesObj(param.req.user.workspace_roles)?.[r];
      }) &&
      workspaceUser.fk_user_id !== param.req.user.id
    ) {
      NcError.badRequest('Insufficient privilege to delete workspaceUser');
    }

    const transaction = await ncMeta.startTransaction();

    try {
      // get all bases workspaceUser is part of and delete them
      const workspaceBases = await Base.listByWorkspace(
        workspaceId,
        true,
        transaction,
      );

      for (const base of workspaceBases) {
        await BaseUser.delete(
          {
            workspace_id: workspaceId,
            base_id: base.id,
          },
          base.id,
          userId,
          transaction,
        );
      }

      const res = await WorkspaceUser.softDelete(
        workspaceId,
        userId,
        transaction,
      );

      await this.paymentService.reseatSubscription(
        workspace.fk_org_id ?? workspace.id,
        transaction,
      );

      await transaction.commit();

      this.appHooksService.emit(AppEvents.WORKSPACE_USER_DELETE, {
        workspace,
        workspaceUser: workspaceUser,
        user,
        req: param.req,
      } as WorkspaceUserDeleteEvent);

      return res;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  async invite(
    param: {
      workspaceId: string;
      body: any;
      invitedBy?: UserType;
      siteUrl: string;
      req: NcRequest;
      skipEmailInvite?: boolean;
      // invite user as soft deleted from workspace
      invitePassive?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validateParams(['email', 'roles'], param.body);

    const {
      workspaceId,
      body: { email, roles },
    } = param;

    if (
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to invite with this role`);
    }

    const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

    if (!workspace) {
      NcError.workspaceNotFound(workspaceId);
    }

    if (roles?.split(',').length > 1) {
      NcError.badRequest('Only one role can be assigned');
    }

    if (
      ![
        WorkspaceUserRoles.OWNER,
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
        WorkspaceUserRoles.NO_ACCESS,
      ].includes(roles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const emails = (email || '')
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

    if (workspace.payment.plan.free) {
      const usersInWorkspace = await WorkspaceUser.count(
        {
          workspaceId,
        },
        ncMeta,
      );

      const userLimitForWorkspace = await getLimit(
        PlanLimitTypes.WORKSPACE_USER_LIMIT,
        workspaceId,
        ncMeta,
      );

      // check if user limit is reached or going to be exceeded
      if (
        usersInWorkspace + emails.length > userLimitForWorkspace &&
        // if invitePassive is true then don't check for user limit
        !param.invitePassive
      ) {
        NcError.badRequest(
          `Only ${userLimitForWorkspace} users are allowed, for more please upgrade your plan`,
        );
      }
    }

    const invite_token = uuidv4();
    const error = [];
    const emailUserMap = new Map<string, User>();
    const invitedEmails = [];
    const registeredEmails = [];

    for (const email of emails) {
      // register user if not exists
      let user = await User.getByEmail(email, ncMeta);
      if (!user) {
        const salt = await promisify(bcrypt.genSalt)(10);
        user = await this.usersService.registerNewUserIfAllowed(
          {
            email,
            password: '',
            email_verification_token: null,
            avatar: null,
            user_name: null,
            display_name: '',
            salt,
            invite_token,
            req: param.req,
            workspace_invite: true,
          },
          ncMeta,
        );
        registeredEmails.push(email);
      }

      emailUserMap.set(email, user);
    }

    // invite users
    for (const email of emails) {
      const transaction = await ncMeta.startTransaction();

      const user = emailUserMap.get(email);

      try {
        const workspaceUser = await WorkspaceUser.get(
          workspaceId,
          user.id,
          transaction,
        );

        if (workspaceUser) {
          error.push({
            email,
            msg: `${user.email} with role ${workspaceUser.roles} already exists in this base`,
          });
          continue;
        }

        await WorkspaceUser.insert(
          {
            fk_workspace_id: workspaceId,
            fk_user_id: user.id,
            roles: roles || WorkspaceUserRoles.VIEWER,
            invited_by: param.req?.user?.id,
            ...(param.invitePassive
              ? { deleted: true, deleted_at: transaction.now() }
              : {}),
          },
          transaction,
        );

        await this.paymentService.reseatSubscription(
          workspace.fk_org_id ?? workspace.id,
          transaction,
        );

        await transaction.commit();

        invitedEmails.push(email);
      } catch (e) {
        await transaction.rollback();
        error.push({
          email,
          msg: e.message,
        });
      }
    }

    // send email and add audit log
    for (const email of invitedEmails) {
      const user = emailUserMap.get(email);

      if (!param.skipEmailInvite) {
        this.mailService
          .sendMail({
            mailEvent: MailEvent.WORKSPACE_INVITE,
            payload: {
              workspace,
              user,
              req: param.req,
              token: invitedEmails.includes(email) ? user.invite_token : null,
            },
          })
          .then(() => {
            /* ignore */
          })
          .catch((e) => {
            console.error(e);
          });
      }

      this.appHooksService.emit(AppEvents.WORKSPACE_USER_INVITE, {
        workspace,
        user,
        roles: roles || WorkspaceUserRoles.NO_ACCESS,
        invitedBy: param.req?.user,
        req: param.req,
      });
    }

    if (emails.length === 1) {
      return {
        msg: 'success',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async acceptInvite(param: { invitationToken: string; userId: string }) {
    const workspaceUser = await WorkspaceUser.getByToken(
      param.invitationToken,
      param.userId,
    );
    if (!workspaceUser) {
      NcError.badRequest('Invitation not found');
    }

    return await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: true,
        invite_token: null,
      },
    );
  }

  async rejectInvite(param: { invitationToken: string; userId: string }) {
    const workspaceUser = await WorkspaceUser.getByToken(
      param.invitationToken,
      param.userId,
    );
    if (!workspaceUser) {
      NcError.badRequest('Invitation not found');
    }

    return await WorkspaceUser.update(
      workspaceUser.fk_workspace_id,
      workspaceUser.fk_user_id,
      {
        invite_accepted: false,
        invite_token: null,
      },
    );
  }
}
