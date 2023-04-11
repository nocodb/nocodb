import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import WorkspaceUser from 'src/models/WorkspaceUser';
import { WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk';
import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import Workspace from 'src/models/Workspace';
import validateParams from 'src/helpers/validateParams';
import { NcError } from 'src/helpers/catchError';

@Injectable()
export class WorkspacesService {
  async list(param: {
    user: {
      id: string;
      roles: string[];
    };
  }) {
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: param.user.id,
    });

    return new PagedResponseImpl<WorkspaceType>(workspaces, {
      count: workspaces.length,
    });
  }

  // TODO: Break the bulk creation logic into a separate api
  async create(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaces: WorkspaceType | WorkspaceType[];
  }) {
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
  }

  async get(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
  }) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) NcError.notFound('Workspace not found');

    return workspace;
  }

  async update(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
    workspace: WorkspaceType;
  }) {
    const { workspace, user, workspaceId } = param;
    // todo: allow order update for all user
    //       and block rest of the options
    if ('order' in workspace) {
      await WorkspaceUser.update(workspaceId, user.id, {
        order: workspace.order,
      });
      delete workspace.order;
    }

    // todo: validate params
    // validateParams(['title', 'description'], req.body);

    const updatedWorkspace = await Workspace.update(workspaceId, workspace);

    return updatedWorkspace;
  }

  async delete(param: {
    user: {
      id: string;
      roles: string[];
    };
    workspaceId: string;
  }) {
    // todo: avoid removing owner

    // block unauthorized user form deleting

    // todo: unlink any project linked
    await Workspace.delete(param.workspaceId);
    return true;
  }
}
