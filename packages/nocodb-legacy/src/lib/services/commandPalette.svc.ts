// import Model from '../../models/Model';
import Project from '../models/Project';
import { WorkspaceUser } from '../models';
import { NcError } from '../meta/helpers/catchError';
import { tableService } from '.';
import type { UserType } from 'nocodb-sdk';

export async function commandPalette(param: { body: any; user: UserType }) {
  const cmdData = [];
  try {
    const { scope, data } = param.body;
    switch (scope) {
      case 'workspace':
        {
          const workspaces = await WorkspaceUser.workspaceList({
            fk_user_id: param.user?.id,
          });

          if (workspaces.length) {
            cmdData.push({
              id: 'workspaces',
              title: 'Workspaces',
              children: [...workspaces.map((w) => `ws-${w.id}`)],
            });
          }

          const allProjects = [];

          for (const workspace of workspaces) {
            cmdData.push({
              id: `ws-${workspace.id}`,
              title: workspace.title,
              parent: 'workspaces',
              handler: {
                type: 'navigate',
                payload: `/?workspaceId=${workspace.id}&page=workspace`,
              },
            });

            const projects = await Project.listByWorkspaceAndUser(
              workspace.id,
              param.user?.id
            );

            allProjects.push(...projects);
          }

          if (allProjects.length) {
            cmdData.push({
              id: 'projects',
              title: 'Projects',
              children: [...allProjects.map((p) => `p-${p.id}`)],
            });
          }

          for (const project of allProjects) {
            cmdData.push({
              id: `p-${project.id}`,
              title: project.title,
              parent: 'projects',
              handler: {
                type: 'navigate',
                payload: `/nc/${project.id}`,
              },
            });
          }
        }
        break;
      case 'project':
        {
          const viewList = (
            (await tableService.xcVisibilityMetaGet(data.project_id)) as any[]
          ).filter((v) => {
            return Object.keys(param.user.roles).some(
              (role) => param.user.roles[role] && !v.disabled[role]
            );
          });

          const tableList = [];
          const vwList = [];

          for (const v of viewList) {
            if (!tableList.find((el) => el.id === `tbl-${v.fk_model_id}`)) {
              tableList.push({
                id: `tbl-${v.fk_model_id}`,
                title: v._ptn,
                parent: 'tables',
                handler: {
                  type: 'navigate',
                  payload: `/nc/${data.project_id}/table/${v.fk_model_id}`,
                },
              });
            }
            vwList.push({
              id: `vw-${v.id}`,
              title: `${v._ptn}: ${v.title}`,
              parent: 'views',
              handler: {
                type: 'navigate',
                payload: `/nc/${data.project_id}/table/${
                  v.fk_model_id
                }/${encodeURIComponent(v.title)}`,
              },
            });
          }

          cmdData.push(...tableList);
          cmdData.push(...vwList);

          if (tableList.length) {
            cmdData.push({
              id: 'tables',
              title: 'Tables',
              parent: scope,
              children: [...tableList.map((w) => `tbl-${w.id}`)],
            });
          }

          if (vwList.length) {
            cmdData.push({
              id: 'views',
              title: 'Views',
              parent: scope,
              children: [...vwList.map((w) => `vw-${w.id}`)],
            });
          }
        }
        break;
    }
  } catch (e) {
    console.log(e);
    NcError.internalServerError('Unable to process request, please try again!');
  }
  return cmdData;
}
