import { Injectable, Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { NcError } from '~/helpers/catchError';
import { Workspace, WorkspaceUser } from '~/models';

@Injectable()
export class WorkspaceV3Service {
  protected readonly logger = new Logger(WorkspaceV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<any, Partial<any>>;

  constructor() {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'title',
        'created_at',
        'updated_at',
        'individual_members',
      ],
      mappings: {},
      transformFn(data) {
        return data;
      },
    });
  }

  async workspaceRead(
    context: NcContext,
    param: { workspaceId: string; include?: string[] },
  ) {
    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) {
      NcError.workspaceNotFound(param.workspaceId);
    }

    const result: any = {
      id: workspace.id,
      title: workspace.title,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
    };

    // Include members if requested
    if (param.include?.includes('members')) {
      const workspaceUsers = await WorkspaceUser.userList({
        fk_workspace_id: param.workspaceId,
        include_deleted: false,
      });

      const members = workspaceUsers.map((user) => ({
        email: user.email,
        user_id: user.fk_user_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        workspace_role: user.roles,
      }));

      result.individual_members = {
        workspace_members: members,
      };
    }

    return this.builder().build(result);
  }
}
