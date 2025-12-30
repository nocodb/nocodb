import { Injectable, Logger } from '@nestjs/common';
import { parseMetaProp } from 'src/utils/modelUtils';
import type { NcContext } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import type {
  WorkspaceV3Create,
  WorkspaceV3Update,
} from '~/ee/services/v3/workspace-v3.types';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { NcError } from '~/helpers/catchError';
import { Workspace, WorkspaceUser } from '~/models';
import { WorkspacesService } from '~/services/workspaces.service';

@Injectable()
export class WorkspaceV3Service {
  protected readonly logger = new Logger(WorkspaceV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<any, Partial<any>>;

  constructor(private readonly workspaceService: WorkspacesService) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'title',
        'fk_org_id',
        'meta',
        'created_at',
        'updated_at',
        'individual_members',
      ],
      mappings: {
        fk_org_id: 'org_id',
      },
      transformFn(data) {
        if (data.meta) {
          data.meta = parseMetaProp(data);
        }
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

  async workspaceList(
    context: NcContext,
    param: {
      cookie: any;
    },
  ) {
    const workspaces = await this.workspaceService.list({
      user: context.user,
      req: param.cookie,
    });
    return { list: this.builder().build(workspaces.list) };
  }

  async workspaceCreate(
    context: NcContext,
    { body, cookie }: { body: WorkspaceV3Create; cookie: any },
  ) {
    const workspace = await this.workspaceService.create({
      user: context.user,
      workspaces: {
        title: body.title,
        fk_org_id: body.org_id,
      },
      req: cookie,
    });
    return this.builder().build(workspace);
  }

  async workspaceUpdate(
    _context: NcContext,
    {
      workspaceId,
      body,
      cookie,
    }: { workspaceId: string; body: WorkspaceV3Update; cookie: any },
  ) {
    const workspace = await this.workspaceService.update({
      user: cookie.user,
      workspaceId,
      workspace: {
        title: body.title,
      },
      req: cookie,
    });
    return this.builder().build(workspace);
  }
  async workspaceDelete(
    _context: NcContext,
    { workspaceId, cookie }: { workspaceId: string; cookie: any },
  ) {
    const workspace = await this.workspaceService.delete({
      user: cookie.user,
      workspaceId,
      req: cookie,
    });
    return this.builder().build(workspace);
  }
}
