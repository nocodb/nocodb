import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import WorkspaceUser from 'src/models/WorkspaceUser';
import { WorkspaceType } from 'nocodb-sdk';
import { PagedResponseImpl } from 'src/helpers/PagedResponse';

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
}
