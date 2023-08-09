import { ProjectUsersService as ProjectUsersServiceCE } from 'src/services/project-users/project-users.service';
import { Injectable } from '@nestjs/common';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Project, ProjectUser, WorkspaceUser } from '~/models';

@Injectable()
export class ProjectUsersService extends ProjectUsersServiceCE {
  constructor(protected appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async userList(param: { projectId: string; query: any }) {
    const project = await Project.get(param.projectId);

    return new PagedResponseImpl(
      await ProjectUser.getUsersList({
        ...param.query,
        project_id: param.projectId,
        workspace_id: (project as Project).fk_workspace_id,
      }),
      {
        ...param.query,
        count: await WorkspaceUser.count({
          workspaceId: (project as Project).fk_workspace_id,
        }),
      },
    );
  }
}
