import { Request, Response } from 'express';
// import Model from '../../models/Model';
import Project from '../models/Project';
import { WorkspaceUser } from '../models/WorkspaceUser';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { xcVisibilityMetaGet } from './modelVisibilityApis';

export async function commandPalette(req: Request, res: Response) {
  try {
    const cmdData = [];
    const { scope, data } = req.body;
    switch (scope) {
      case 'workspace':
        const workspaces = await WorkspaceUser.workspaceList({
          fk_user_id: (req as any).user?.id,
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
            (req as any).user?.id
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
        break;
      case 'project':
        const viewList = (
          (await xcVisibilityMetaGet(data.project_id)) as any[]
        ).filter((v) => {
          return Object.keys((req as any).session?.passport?.user?.roles).some(
            (role) =>
              (req as any)?.session?.passport?.user?.roles[role] &&
              !v.disabled[role]
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
        break;
    }
    return res.status(200).json(cmdData);
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ msg: 'Unable to process request, please try again!' });
  }
}

export default (router) => {
  router.post(
    '/api/v1/command_palette',
    ncMetaAclMw(commandPalette, 'commandPalette')
  );
};
