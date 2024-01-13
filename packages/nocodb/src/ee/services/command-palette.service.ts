import { Injectable } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
import WorkspaceUser from '~/models/WorkspaceUser';
import { Base } from '~/models';
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

      if (scope === 'root') {
        const workspaces = await WorkspaceUser.workspaceList({
          fk_user_id: param.user?.id,
        });

        const allBases = [];

        for (const workspace of workspaces) {
          cmdData.push({
            id: `ws-nav-${workspace.id}`,
            title: workspace.title,
            icon: 'workspace',
            section: 'Workspaces',
            scopePayload: {
              scope: `ws-${workspace.id}`,
              data: {
                workspace_id: workspace.id,
              },
            },
          });

          const bases = await Base.listByWorkspaceAndUser(
            workspace.id,
            param.user?.id,
          );

          allBases.push(...bases);
        }

        for (const base of allBases) {
          cmdData.push({
            id: `p-${base.id}`,
            title: base.title,
            parent: `ws-nav-${base.fk_workspace_id}`,
            icon: 'project',
            scopePayload: {
              scope: `p-${base.id}`,
              data: {
                workspace_id: base.fk_workspace_id,
                base_id: base.id,
              },
            },
          });
        }
      } else if (scope.startsWith('ws-')) {
        const workspaces = await WorkspaceUser.workspaceList({
          fk_user_id: param.user?.id,
        });

        const workspace = workspaces.find((el) => el.id === data.workspace_id);

        for (const _workspace of workspaces) {
          if (_workspace.id === data.workspace_id) continue;
          cmdData.push({
            id: `ws-nav-${_workspace.id}`,
            title: _workspace.title,
            icon: 'workspace',
            section: 'Workspaces',
            scopePayload: {
              scope: `ws-${_workspace.id}`,
              data: {
                workspace_id: _workspace.id,
              },
            },
            handler: {
              type: 'navigate',
              payload: `/${_workspace.id}/settings`,
            },
          });
        }

        if (!workspace) {
          NcError.notFound('Workspace not found!');
        }
        const allBases = [];

        const bases = await Base.listByWorkspaceAndUser(
          data.workspace_id,
          param.user?.id,
        );

        allBases.push(...bases);

        const viewList = [];

        for (const base of bases) {
          viewList.push(
            ...(
              (await this.tablesService.xcVisibilityMetaGet(
                base.id,
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

        for (const b of allBases) {
          cmdData.push({
            id: `p-${b.id}`,
            title: b.title,
            parent: `ws-${workspace.id}`,
            icon: 'project',
            section: 'Bases',
          });
        }

        for (const v of viewList) {
          if (!tableList.find((el) => el.id === `tbl-${v.fk_model_id}`)) {
            tableList.push({
              id: `tbl-${v.fk_model_id}`,
              title: v._ptn,
              parent: `p-${v.base_id}`,
              icon: v?.table_meta?.icon || v.ptype,
              projectName: bases.find((el) => el.id === v.base_id)?.title,
              section: 'Tables',
            });
          }
          vwList.push({
            id: `vw-${v.id}`,
            title: `${v.title}`,
            parent: `tbl-${v.fk_model_id}`,
            icon: v?.meta?.icon || viewTypeAlias[v.type] || 'table',
            projectName: bases.find((el) => el.id === v.base_id)?.title,
            section: 'Views',
            is_default: v?.is_default || 0,
            handler: {
              type: 'navigate',
              payload: `/${data.workspace_id}/${v.base_id}/${
                v.fk_model_id
              }/${encodeURIComponent(v.id)}`,
            },
          });
        }

        cmdData.push(...tableList);
        cmdData.push(...vwList);
      } else if (scope.startsWith('p-')) {
        return [];
      }
    } catch (e) {
      console.log(e);
      return [];
    }
    return cmdData;
  }
}
