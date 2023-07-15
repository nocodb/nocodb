import { Injectable } from '@nestjs/common';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import { AppEvents, WorkspaceUserRoles } from 'nocodb-sdk';
import WorkspaceUser from '../../models/WorkspaceUser';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import validateParams from '../../helpers/validateParams';
import { NcError } from '../../helpers/catchError';
import { Project, ProjectUser, User } from '../../models';
import { AppHooksService } from '../../services/app-hooks/app-hooks.service';
import Workspace from '../../models/Workspace';
import type { UserType, WorkspaceType } from 'nocodb-sdk';

@Injectable()
export class WorkspaceUsersService {
  constructor(private appHooksService: AppHooksService) {}

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
  }) {
    const user = await WorkspaceUser.get(param.workspaceId, param.userId);

    if (!user) NcError.notFound('User not found');

    if (user.roles === WorkspaceUserRoles.OWNER)
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

    return user;
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
      const user = await User.getByEmail(email);

      if (user) {
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

        this.appHooksService.emit(AppEvents.WORKSPACE_INVITE, {
          workspace,
          user,
          invitedBy: param.invitedBy,
        });
      } else {
        // todo: send invite email
        NcError.badRequest(`${email} is not registerd in noco`);
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
