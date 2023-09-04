import { Injectable } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
import WorkspaceUser from '~/models/WorkspaceUser';
import { Project } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';

const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
};

@Injectable()
export class CommandPaletteService {
  constructor(private tablesService: TablesService) {}

  async commandPalette(param: { body: any; user: UserType }) {
    const cmdData = [];
    try {
      const { scope, data } = param.body;
      switch (scope) {
        case 'root':
          {
            const workspaces = await WorkspaceUser.workspaceList({
              fk_user_id: param.user?.id,
            });

            const allProjects = [];

            for (const workspace of workspaces) {
              cmdData.push({
                id: `ws-${workspace.id}`,
                title: workspace.title,
                parent: 'workspaces',
                icon: 'workspace',
                handler: {
                  type: 'navigate',
                  payload: `/${workspace.id}`,
                },
              });

              const projects = await Project.listByWorkspaceAndUser(
                workspace.id,
                param.user?.id,
              );

              allProjects.push(...projects);
            }

            for (const project of allProjects) {
              cmdData.push({
                id: `p-${project.id}`,
                title: project.title,
                parent: 'projects',
                icon: 'database',
                handler: {
                  type: 'navigate',
                  payload: `/${project.fk_workspace_id}/${project.id}`,
                },
              });
            }
          }
          break;
        case 'workspace':
          {
            const projects = await Project.listByWorkspaceAndUser(
              data.workspace_id,
              param.user?.id,
            );

            const viewList = [];

            for (const project of projects) {
              viewList.push(
                ...(
                  (await this.tablesService.xcVisibilityMetaGet(
                    project.id,
                    null,
                    false,
                  )) as any[]
                ).filter((v) => {
                  return Object.keys(param.user.roles).some(
                    (role) => param.user.roles[role] && !v.disabled[role],
                  );
                }),
              );
            }

            const tableList = [];
            const vwList = [];

            for (const v of viewList) {
              if (!tableList.find((el) => el.id === `tbl-${v.fk_model_id}`)) {
                tableList.push({
                  id: `tbl-${v.fk_model_id}`,
                  title: v._ptn,
                  parent: 'tables',
                  icon: 'table',
                  section: projects.find((el) => el.id === v.project_id)?.title,
                  handler: {
                    type: 'navigate',
                    payload: `/${data.workspace_id}/${v.project_id}/${v.fk_model_id}`,
                  },
                });
              }
              vwList.push({
                id: `vw-${v.id}`,
                title: `${v.title}`,
                parent: 'views',
                icon: viewTypeAlias[v.type] || 'table',
                section: `${
                  projects.find((el) => el.id === v.project_id)?.title
                } / ${v._ptn}`,
                handler: {
                  type: 'navigate',
                  payload: `/${data.workspace_id}/${v.project_id}/${
                    v.fk_model_id
                  }/${encodeURIComponent(v.id)}`,
                },
              });
            }

            cmdData.push(...tableList);
            cmdData.push(...vwList);
          }
          break;
      }
    } catch (e) {
      console.log(e);
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }
    return cmdData;
  }
}
