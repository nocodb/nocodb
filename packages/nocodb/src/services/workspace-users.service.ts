import { Injectable, Logger } from '@nestjs/common';
import { extractRolesObj, OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import Noco from '~/Noco';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { NcError } from '~/helpers/catchError';
import validateParams from '~/helpers/validateParams';
import { User } from '~/models';
import Workspace from '~/models/Workspace';
import WorkspaceUser from '~/models/WorkspaceUser';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';
import { UsersService } from '~/services/users/users.service';
import { getWorkspaceRolePower } from '~/utils/roleHelper';
import { sanitizeEmail } from '~/utils/emailUtils';
import { MailEvent } from '~/interface/Mail';

@Injectable()
export class WorkspaceUsersService {
  protected logger = new Logger('WorkspaceUsersService');

  constructor(
    protected appHooksService: AppHooksService,
    protected usersService: UsersService,
    protected mailService: MailService,
  ) {}

  async list(param: { workspaceId: string }, ncMeta = Noco.ncMeta) {
    const users = await WorkspaceUser.userList(
      { fk_workspace_id: param.workspaceId },
      ncMeta,
    );

    return new PagedResponseImpl(users, {
      count: users.length,
    });
  }

  async update(
    param: {
      workspaceId: string;
      userId: string;
      roles: WorkspaceUserRoles;
      siteUrl?: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceUser = await WorkspaceUser.get(
      param.workspaceId,
      param.userId,
      {},
      ncMeta,
    );

    if (!workspaceUser) NcError.userNotFound(param.userId);

    // Validate role value
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

    // Super admin bypasses role power checks
    const isSuperAdmin =
      param.req.user?.roles &&
      extractRolesObj(param.req.user.roles)[OrgUserRoles.SUPER_ADMIN];

    if (!isSuperAdmin) {
      // Check current user has permission to update this user (role power check)
      if (
        getWorkspaceRolePower({
          workspace_roles: extractRolesObj(workspaceUser.roles),
        }) > getWorkspaceRolePower(param.req.user)
      ) {
        NcError.badRequest('Insufficient privilege to update user');
      }

      // Check current user can assign target role
      if (
        getWorkspaceRolePower({
          workspace_roles: extractRolesObj(param.roles),
        }) > getWorkspaceRolePower(param.req.user)
      ) {
        NcError.badRequest(
          'Insufficient privilege to update user with this role',
        );
      }
    }

    // Owner guard: ensure at least one owner remains
    if (workspaceUser.roles === WorkspaceUserRoles.OWNER) {
      const owners = await WorkspaceUser.userList(
        { fk_workspace_id: param.workspaceId },
        ncMeta,
      );
      const ownerCount = owners.filter(
        (u) => u.roles === WorkspaceUserRoles.OWNER,
      ).length;
      if (ownerCount <= 1) {
        NcError.badRequest('At least one owner should be there');
      }
    }

    await WorkspaceUser.update(
      param.workspaceId,
      param.userId,
      { roles: param.roles },
      ncMeta,
    );

    return workspaceUser;
  }

  async invite(
    param: {
      workspaceId: string;
      body: any;
      invitedBy?: UserType;
      siteUrl: string;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    validateParams(['email', 'roles'], param.body);

    const { workspaceId } = param;
    const { email, roles } = param.body;

    // Validate role
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

    // Role power check (super admin bypasses)
    const isSuperAdmin =
      param.req.user?.roles &&
      extractRolesObj(param.req.user.roles)[OrgUserRoles.SUPER_ADMIN];

    if (
      !isSuperAdmin &&
      getWorkspaceRolePower({
        workspace_roles: extractRolesObj(roles),
      }) > getWorkspaceRolePower(param.req.user)
    ) {
      NcError.badRequest('Insufficient privilege to invite with this role');
    }

    const workspace = await Workspace.get(workspaceId, false, ncMeta);
    if (!workspace) NcError.workspaceNotFound(workspaceId);

    // Parse emails
    const emails = (email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => sanitizeEmail(v))
      .filter(Boolean);

    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }

    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    const error = [];
    // Only set when the token was saved on the user row, i.e. usable for signup
    let invite_token: string | null = null;

    for (const emailAddr of emails) {
      const token = uuidv4();
      // Check if user exists
      let user = await User.getByCanonicalEmail(emailAddr, ncMeta);
      let signupToken: string | null = null;

      if (!user) {
        // Create new user
        user = await User.insert(
          {
            invite_token: token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            email: emailAddr,
            roles: OrgUserRoles.VIEWER,
            token_version: uuidv4(),
          },
          ncMeta,
        );
        signupToken = token;
      }

      // Check if already a workspace member
      const existingWsUser = await WorkspaceUser.get(
        workspaceId,
        user.id,
        {},
        ncMeta,
      );

      if (existingWsUser) {
        // If user was pre-created with NO_ACCESS (e.g. from migration), upgrade their role
        if (existingWsUser.roles === WorkspaceUserRoles.NO_ACCESS) {
          await WorkspaceUser.update(
            workspaceId,
            user.id,
            { roles: roles || WorkspaceUserRoles.VIEWER },
            ncMeta,
          );

          // Clear BASE_USER cache for all bases in workspace since workspace_roles changed
          await WorkspaceUser.clearBaseUserCacheForWorkspace(
            workspaceId,
            ncMeta,
          );
        } else {
          error.push({
            email: emailAddr,
            msg: `${emailAddr} already exists in this workspace`,
          });
          continue;
        }
      } else {
        // Insert workspace user
        await WorkspaceUser.insert(
          {
            fk_workspace_id: workspaceId,
            fk_user_id: user.id,
            roles: roles || WorkspaceUserRoles.VIEWER,
            invite_token: token,
          },
          ncMeta,
        );
      }

      // Existing user who never finished signup: refresh their invite token
      if (!signupToken && !user.password) {
        await User.update(
          user.id,
          {
            invite_token: token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          ncMeta,
        );
        signupToken = token;
      }
      invite_token = signupToken;

      // Best-effort; mail failure must not fail the invite.
      this.mailService
        .sendMail({
          mailEvent: MailEvent.WORKSPACE_INVITE,
          payload: {
            workspace,
            user,
            req: param.req,
            token: signupToken,
          },
        })
        .catch((e) => this.logger.error(e.message, e.stack));
    }

    if (emails.length === 1 && error.length === 0) {
      return invite_token
        ? { msg: 'success', invite_token }
        : { msg: 'success' };
    }

    return { msg: 'success', emails, error };
  }
}
