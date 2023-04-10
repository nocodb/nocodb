import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import WorkspaceUser from 'src/models/WorkspaceUser';
import { WorkspaceType, WorkspaceUserRoles } from 'nocodb-sdk';
import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import Workspace from 'src/models/Workspace';
import validateParams from 'src/helpers/validateParams';

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
}
