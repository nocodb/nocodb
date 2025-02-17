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
import * as ejs from 'ejs';
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
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getWorkspaceSiteUrl, sanitiseEmailContent } from '~/utils';
import { rolesLabel } from '~/middlewares/extract-ids/extract-ids.middleware';
import { UsersService } from '~/services/users/users.service';
import { getWorkspaceRolePower } from '~/utils/roleHelper';
import Noco from '~/Noco';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

@Injectable()
export class WorkspaceUsersService {
  constructor(
    private appHooksService: AppHooksService,
    private usersService: UsersService,
    private config: ConfigService<AppConfig>,
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

    await WorkspaceUser.update(
      param.workspaceId,
      param.userId,
      {
        roles: param.roles,
      },
      ncMeta,
    );

    this.sendRoleUpdateEmail(
      {
        workspace,
        user,
        roles: param.roles,
        siteUrl: getWorkspaceSiteUrl({
          siteUrl: param.siteUrl,
          workspaceId: workspace.id,
          mainSubDomain: this.config.get('mainSubDomain', {
            infer: true,
          }),
        }),
      },
      ncMeta,
    ).then(() => {
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

  async delete(param: { workspaceId: string; userId: string; req: NcRequest }) {
    const { workspaceId, userId } = param;

    const workspace = await Workspace.get(workspaceId);

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const user = await User.get(userId);
      const workspaceUser = await WorkspaceUser.get(
        workspaceId,
        userId,
        ncMeta,
      );

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

      // get all bases workspaceUser is part of and delete them
      const workspaceBases = await Base.listByWorkspace(
        workspaceId,
        true,
        ncMeta,
      );

      for (const base of workspaceBases) {
        await BaseUser.delete(
          {
            workspace_id: workspaceId,
            base_id: base.id,
          },
          base.id,
          userId,
          ncMeta,
        );
      }

      const res = await WorkspaceUser.softDelete(workspaceId, userId, ncMeta);

      await ncMeta.commit();

      this.appHooksService.emit(AppEvents.WORKSPACE_USER_DELETE, {
        workspace,
        workspaceUser: workspaceUser,
        user,
        req: param.req,
      } as WorkspaceUserDeleteEvent);

      return res;
    } catch (e) {
      await ncMeta.rollback();
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

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {
      // add user to base if user already exist
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
            req: param.req,
            workspace_invite: true,
          },
          ncMeta,
        );
      }

      // check if this user has been added to this base
      const workspaceUser = await WorkspaceUser.get(
        workspaceId,
        user.id,
        ncMeta,
      );
      if (workspaceUser) {
        NcError.badRequest(
          `${user.email} with role ${workspaceUser.roles} already exists in this base`,
        );
      }

      await WorkspaceUser.insert(
        {
          fk_workspace_id: workspaceId,
          fk_user_id: user.id,
          roles: roles || WorkspaceUserRoles.VIEWER,
          invited_by: param.req?.user?.id,
          ...(param.invitePassive
            ? { deleted: true, deleted_at: ncMeta.now() }
            : {}),
        },
        ncMeta,
      );
      if (!param.skipEmailInvite) {
        this.sendInviteEmail(
          {
            workspace,
            user,
            roles: roles || WorkspaceUserRoles.NO_ACCESS,
            siteUrl: getWorkspaceSiteUrl({
              siteUrl: param.siteUrl,
              workspaceId: workspace.id,
              mainSubDomain: this.config.get('mainSubDomain', {
                infer: true,
              }),
            }),
          },
          ncMeta,
        )
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

  private async sendInviteEmail(
    {
      user,
      workspace,
      roles,
      siteUrl,
    }: {
      workspace: Workspace;
      roles: any;
      user: any;
      siteUrl: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    try {
      const template = (await import('~/helpers/email-templates/invite'))
        .default;
      await NcPluginMgrv2.emailAdapter(undefined, ncMeta)
        .then((adapter) => {
          if (!adapter)
            return Promise.reject(
              'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
            );
          adapter
            .mailSend({
              to: user.email,
              subject: "You've been invited to a Noco Cloud Workspace\n",
              text: `Visit following link to access the workspace : ${siteUrl}${this.config.get(
                'dashboardPath',
                {
                  infer: true,
                },
              )}#/${workspace.id}`,
              html: ejs.render(template, {
                workspaceLink:
                  siteUrl +
                  `${this.config.get('dashboardPath', {
                    infer: true,
                  })}#/${workspace.id}`,
                workspaceName: sanitiseEmailContent(workspace.title),
                roles: sanitiseEmailContent(rolesLabel[roles]),
              }),
            })
            .catch((e) => {
              console.error(e);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    } catch (e) {
      console.log(e);
      return NcError.badRequest(
        'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
      );
    }
  }

  private async sendRoleUpdateEmail(
    {
      user,
      workspace,
      roles,
      siteUrl,
    }: {
      workspace: Workspace;
      roles: any;
      user: any;
      siteUrl: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    try {
      const template = (await import('~/helpers/email-templates/roleUpdate'))
        .default;
      await NcPluginMgrv2.emailAdapter(undefined, ncMeta)
        .then((adapter) => {
          if (!adapter)
            return Promise.reject(
              'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
            );
          adapter
            .mailSend({
              to: user.email,
              subject: 'Your workspace role has been updated',
              text: `Your role in workspace ${workspace.title} has been updated to ${rolesLabel[roles]}`,
              html: ejs.render(template, {
                workspaceLink:
                  siteUrl +
                  `${this.config.get('dashboardPath', {
                    infer: true,
                  })}#/${workspace.id}`,
                workspaceName: sanitiseEmailContent(workspace.title),
                roles: sanitiseEmailContent(rolesLabel[roles]),
              }),
            })
            .catch((e) => {
              console.error(e);
            });
        })
        .catch((e) => {
          console.error(e);
        });
    } catch (e) {
      console.log(e);
      return NcError.badRequest(
        'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
      );
    }
  }
}
