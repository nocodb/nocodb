import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { WorkspaceUser } from '../models';
import { NcError } from '../meta/helpers/catchError';
import User from '../models/User';

import { Workspace } from '../models';
import Project from '../models/Project';
import validateParams from '../meta/helpers/validateParams';
import ProjectUser from '../models/ProjectUser';
import type { UserType, WorkspaceType } from 'nocodb-sdk';

export const workspaceCreate = async (param: {
  workspaces: WorkspaceType;
  user: UserType;
}) => {
  const workspacePayloads = Array.isArray(param.workspaces)
    ? param.workspaces
    : [param.workspaces];

  for (const workspacePayload of workspacePayloads) {
    validateParams(['title'], workspacePayload);
  }

  const workspaces = [];

  for (const workspacePayload of workspacePayloads) {
    const workspace = await Workspace.insert({
      ...workspacePayload,
      title: workspacePayload.title.trim(),
      // todo : extend request type
      fk_user_id: param.user.id,
    });

    await WorkspaceUser.insert({
      fk_workspace_id: workspace.id,
      fk_user_id: param.user.id,
      roles: WorkspaceUserRoles.OWNER,
    });

    workspaces.push(workspace);
  }
  return Array.isArray(param.workspaces) ? workspaces : workspaces[0];
};

export const workspaceGet = async (param: { workspaceId: string }) => {
  const workspace = await Workspace.get(param.workspaceId);

  if (!workspace) NcError.notFound('Workspace not found');

  return workspace;
};

export const workspaceList = async (param: { userId: string }) => {
  const workspaces = await WorkspaceUser.workspaceList({
    fk_user_id: param.userId,
  });

  return new PagedResponseImpl<WorkspaceType>(workspaces, {
    count: workspaces.length,
  });
};

export const workspaceUpdate = async (param: {
  workspaceId: string;
  // todo: define type in nocodb-sdk
  body: any;
  userId: string;
}) => {
  // todo: allow order update for all user
  //       and block rest of the options
  if ('order' in param.body) {
    await WorkspaceUser.update(param.workspaceId, param.userId, {
      order: param.body.order,
    });
    delete param.body.order;
  }

  // todo: validate params
  // validateParams(['title', 'description'], req.body);

  const workspace = await Workspace.update(param.workspaceId, param.body);

  return workspace;
};
export const workspaceDelete = async (param: { workspaceId: string }) => {
  // todo: avoid removing owner

  // block unauthorized user form deleting

  // todo: unlink any project linked
  await Workspace.delete(param.workspaceId);
  return true;
};

export const workspaceUserList = async (param: { workspaceId: string }) => {
  const users = await WorkspaceUser.userList({
    fk_workspace_id: param.workspaceId,
  });

  // todo: pagination
  return new PagedResponseImpl<WorkspaceType>(users, {
    count: users.length,
  });
};

export const workspaceUserUpdate = async (param: {
  workspaceId: string;
  userId: string;
  body: {
    roles: string;
  };
}) => {
  // todo
  const {
    workspaceId,
    userId,
    body: { roles },
  } = param;

  return await WorkspaceUser.update(workspaceId, userId, { roles });
};

export const workspaceUserDelete = async (param: {
  workspaceId: string;
  userId: string;
}) => {
  const { workspaceId, userId } = param;

  return await WorkspaceUser.delete(workspaceId, userId);
};

export const workspaceInvite = async (param: {
  workspaceId: string;
  body: {
    email: string;
    roles: string;
  };
}) => {
  validateParams(['email', 'roles'], param.body);

  const {
    workspaceId,
    body: { email, roles },
  } = param;

  if (roles?.split(',').length > 1) {
    NcError.badRequest('Only one role can be assigned');
  }

  if (
    roles !== WorkspaceUserRoles.CREATOR &&
    roles !== WorkspaceUserRoles.VIEWER
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
          `${user.email} with role ${workspaceUser.roles} already exists in this project`
        );
      }

      await WorkspaceUser.insert({
        fk_workspace_id: workspaceId,
        fk_user_id: user.id,
        roles: roles || 'editor',
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
};

export const workspaceProjectList = async (param: {
  workspaceId: string;
  userId: string;
}) => {
  const projects = await Project.listByWorkspaceAndUser(
    param.workspaceId,
    param.userId
  );

  return new PagedResponseImpl<WorkspaceType>(projects, {
    count: projects.length,
  });
};

export const workspaceInvitationAccept = async (param: {
  invitationToken: string;
  userId: string;
}) => {
  const workspaceUser = await WorkspaceUser.getByToken(
    param.invitationToken,
    param.userId
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
    }
  );
};
export const workspaceInvitationReject = async (param: {
  invitationToken: string;
  userId: string;
}) => {
  const workspaceUser = await WorkspaceUser.getByToken(
    param.invitationToken,
    param.userId
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
    }
  );
};

export const moveProjectToWorkspace = async (param: {
  projectId: string;
  workspaceId: string;
  userId: string;
}) => {
  // verify user is current project owner or workspace owner

  const project = await Project.get(param.projectId);

  const projectUser = await ProjectUser.get(param.projectId, param.userId);
  const currentWorkspaceUser = await WorkspaceUser.get(
    project.fk_workspace_id,
    param.userId
  );

  if (
    projectUser?.roles !== ProjectRoles.OWNER &&
    currentWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER
  ) {
    NcError.forbidden('You are not the project owner');
  }

  // verify user is workaggerspace owner

  const destWorkspaceUser = await WorkspaceUser.get(
    param.workspaceId,
    param.userId
  );

  if (destWorkspaceUser?.roles !== WorkspaceUserRoles.OWNER) {
    NcError.forbidden('You are not the workspace owner');
  }

  // update the project workspace id
  await Project.update(param.projectId, {
    fk_workspace_id: param.workspaceId,
  });

  return true;
};
