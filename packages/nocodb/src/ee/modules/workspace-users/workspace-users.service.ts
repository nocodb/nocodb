import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import { AppEvents, WorkspaceUserRoles } from 'nocodb-sdk';
import * as ejs from 'ejs';
import { ConfigService } from '@nestjs/config';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import type { AppConfig } from '~/interface/config';
import WorkspaceUser from '~/models/WorkspaceUser';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import validateParams from '~/helpers/validateParams';
import { NcError } from '~/helpers/catchError';
import { Project, ProjectUser, User } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Workspace from '~/models/Workspace';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getWorkspaceSiteUrl } from '~/utils';
import { rolesLabel } from '~/middlewares/extract-ids/extract-ids.middleware';
import { UsersService } from '~/services/users/users.service';

@Injectable()
export class WorkspaceUsersService {
  constructor(
    private appHooksService: AppHooksService,
    private usersService: UsersService,
    private config: ConfigService<AppConfig>,
  ) {}

  async list(param: { workspaceId }) {
    const users = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
    });

    // todo: pagination
    return new PagedResponseImpl<WorkspaceType>(users, {
      count: users.length,
    });
  }

  async get({ workspaceId, userId }) {
    const user = await WorkspaceUser.get(workspaceId, userId);

    if (!user) NcError.notFound('User not found');

    return user;
  }

  async update(param: {
    workspaceId: string;
    userId: string;
    roles: WorkspaceUserRoles;
    siteUrl: string;
  }) {
    const workspaceUser = await WorkspaceUser.get(
      param.workspaceId,
      param.userId,
    );

    if (!workspaceUser)
      NcError.notFound('User is not a member of this workspace');

    const user = await User.get(param.userId);

    if (!user) NcError.notFound('User not found');

    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.notFound('Workspace not found');

    if (workspaceUser.roles === WorkspaceUserRoles.OWNER)
      NcError.badRequest('Owner cannot be updated');

    if (
      ![
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
      ].includes(param.roles)
    ) {
      NcError.badRequest('Invalid role');
    }

    await WorkspaceUser.update(param.workspaceId, param.userId, {
      roles: param.roles,
    });

    this.sendRoleUpdateEmail({
      workspace,
      user,
      roles: param.roles,
      siteUrl: getWorkspaceSiteUrl({
        siteUrl: param.siteUrl,
        workspaceId: workspace.id,
      }),
    }).then(() => {
      /* ignore */
    });

    return workspaceUser;
  }

  async delete(param: { workspaceId: string; userId: string }) {
    const { workspaceId, userId } = param;

    const user = await WorkspaceUser.get(workspaceId, userId);

    if (!user) NcError.notFound('User not found');

    if (user.roles === WorkspaceUserRoles.OWNER)
      NcError.badRequest('Owner cannot be deleted');

    // get all projects user is part of and delete them
    const workspaceProjects = await Project.listByWorkspaceAndUser(
      workspaceId,
      userId,
    );

    for (const project of workspaceProjects) {
      await ProjectUser.delete(project.id, userId);
    }

    return await WorkspaceUser.delete(workspaceId, userId);
  }

  async invite(param: {
    workspaceId: string;
    body: any;
    invitedBy?: UserType;
    siteUrl: string;
  }) {
    validateParams(['email', 'roles'], param.body);

    const {
      workspaceId,
      body: { email, roles },
    } = param;

    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      NcError.notFound('Workspace not found');
    }

    if (roles?.split(',').length > 1) {
      NcError.badRequest('Only one role can be assigned');
    }

    if (
      ![
        WorkspaceUserRoles.CREATOR,
        WorkspaceUserRoles.VIEWER,
        WorkspaceUserRoles.EDITOR,
        WorkspaceUserRoles.COMMENTER,
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

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {
      // add user to project if user already exist
      let user = await User.getByEmail(email);
      if (!user) {
        const salt = await promisify(bcrypt.genSalt)(10);
        user = await this.usersService.registerNewUserIfAllowed({
          email,
          password: '',
          email_verification_token: null,
          avatar: null,
          user_name: null,
          display_name: '',
          salt,
        });
      }

      // check if this user has been added to this project
      const workspaceUser = await WorkspaceUser.get(workspaceId, user.id);
      if (workspaceUser) {
        NcError.badRequest(
          `${user.email} with role ${workspaceUser.roles} already exists in this project`,
        );
      }

      await WorkspaceUser.insert({
        fk_workspace_id: workspaceId,
        fk_user_id: user.id,
        roles: roles || 'editor',
      });

      this.sendInviteEmail({
        workspace,
        user,
        roles: roles || 'viewer',
        siteUrl: getWorkspaceSiteUrl({
          siteUrl: param.siteUrl,
          workspaceId: workspace.id,
        }),
      })
        .then(() => {
          /* ignore */
        })
        .catch((e) => {
          console.error(e);
        });

      this.appHooksService.emit(AppEvents.WORKSPACE_INVITE, {
        workspace,
        user,
        invitedBy: param.invitedBy,
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

  private async sendInviteEmail({
    user,
    workspace,
    roles,
    siteUrl,
  }: {
    workspace: Workspace;
    roles: any;
    user: any;
    siteUrl: string;
  }) {
    try {
      const template = (await import('./emailTemplates/invite')).default;
      await NcPluginMgrv2.emailAdapter()
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
                workspaceName: workspace.title,
                roles: rolesLabel[roles],
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

  private async sendRoleUpdateEmail({
    user,
    workspace,
    roles,
    siteUrl,
  }: {
    workspace: Workspace;
    roles: any;
    user: any;
    siteUrl: string;
  }) {
    try {
      const template = (await import('./emailTemplates/roleUpdate')).default;
      await NcPluginMgrv2.emailAdapter()
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
                workspaceName: workspace.title,
                roles: rolesLabel[roles],
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
