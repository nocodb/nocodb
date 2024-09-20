import { Injectable } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
import WorkspaceUser from '~/models/WorkspaceUser';
import { TablesService } from '~/services/tables.service';
import { deserializeJSON } from '~/utils/serialize';
import { getCommandPaletteForUserWorkspace } from '~/helpers/commandPaletteHelpers';

const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
  [ViewTypes.CALENDAR]: 'calendar',
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

        for (const workspace of workspaces) {
          cmdData.push({
            id: `ws-nav-${workspace.id}`,
            title: workspace.title,
            icon: 'workspace',
            iconColor: deserializeJSON(workspace.meta)?.color,
            section: 'Workspaces',
            scopePayload: {
              scope: `ws-${workspace.id}`,
              data: {
                workspace_id: workspace.id,
              },
            },
          });
        }
      } else if (scope.startsWith('ws-')) {
        const list: {
          workspace_id: string;
          workspace_title: string;
          workspace_meta: string;
          workspace_role: string;
          base_id: string;
          base_title: string;
          base_meta: string;
          base_role: string;
          table_id: string;
          table_title: string;
          table_type: string;
          table_meta: string;
          view_id: string;
          view_title: string;
          view_is_default: boolean;
          view_type: string;
          view_meta: string;
        }[] = await getCommandPaletteForUserWorkspace(
          param.user?.id,
          data.workspace_id,
        );

        const workspaces = new Map<
          string,
          { id: string; title: string; meta: any }
        >();
        const bases = new Map<
          string,
          {
            id: string;
            title: string;
            workspace_id: string;
            meta: any;
          }
        >();
        const tables = new Map<
          string,
          {
            id: string;
            title: string;
            workspace_id: string;
            base_id: string;
            type: string;
            meta: any;
          }
        >();
        const views = new Map<
          string,
          {
            id: string;
            title: string;
            workspace_id: string;
            base_id: string;
            table_id: string;
            is_default: boolean;
            type: string;
            meta: any;
          }
        >();

        for (const item of list) {
          if (!workspaces.has(item.workspace_id)) {
            workspaces.set(item.workspace_id, {
              id: item.workspace_id,
              title: item.workspace_title,
              meta: deserializeJSON(item.workspace_meta),
            });
          }

          if (!bases.has(item.base_id)) {
            bases.set(item.base_id, {
              id: item.base_id,
              title: item.base_title,
              meta: deserializeJSON(item.base_meta),
              workspace_id: item.workspace_id,
            });
          }

          if (!tables.has(item.table_id)) {
            tables.set(item.table_id, {
              id: item.table_id,
              title: item.table_title,
              meta: deserializeJSON(item.table_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              type: item.table_type,
            });
          }

          if (!views.has(item.view_id)) {
            views.set(item.view_id, {
              id: item.view_id,
              title: item.view_title,
              meta: deserializeJSON(item.view_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              table_id: item.table_id,
              is_default: item.view_is_default,
              type: item.view_type,
            });
          }
        }

        for (const [id, workspace] of workspaces) {
          cmdData.push({
            id: `ws-nav-${id}`,
            title: workspace.title,
            icon: 'workspace',
            iconColor: deserializeJSON(workspace.meta)?.color,
            section: 'Workspaces',
            scopePayload: {
              scope: `ws-${id}`,
              data: {
                workspace_id: id,
              },
            },
            handler: {
              type: 'navigate',
              payload: `/${id}/settings`,
            },
          });
        }

        for (const [id, base] of bases) {
          cmdData.push({
            id: `p-${id}`,
            title: base.title,
            parent: `ws-${base.workspace_id}`,
            icon: 'project',
            iconColor: deserializeJSON(base.meta)?.iconColor,
            section: 'Bases',
          });
        }

        for (const [id, table] of tables) {
          cmdData.push({
            id: `tbl-${id}`,
            title: table.title,
            parent: `p-${table.base_id}`,
            icon: table?.meta?.icon || table.type,
            projectName: bases.get(table.base_id)?.title,
            section: 'Tables',
          });
        }

        for (const [id, view] of views) {
          cmdData.push({
            id: `vw-${id}`,
            title: `${view.title}`,
            parent: `tbl-${view.table_id}`,
            icon: view?.meta?.icon || viewTypeAlias[view.type] || 'table',
            projectName: bases.get(view.base_id)?.title,
            section: 'Views',
            is_default: view.is_default,
            handler: {
              type: 'navigate',
              payload: `/${view.workspace_id}/${view.base_id}/${
                view.table_id
              }/${encodeURIComponent(id)}`,
            },
          });
        }

        /*
        const workspaces = await WorkspaceUser.workspaceList({
          fk_user_id: param.user?.id,
        });

        const workspace = workspaces.find((el) => el.id === data.workspace_id);

        for (const _workspace of workspaces) {
          cmdData.push({
            id: `ws-nav-${_workspace.id}`,
            title: _workspace.title,
            icon: 'workspace',
            iconColor: deserializeJSON(_workspace.meta)?.color,
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
          NcError.workspaceNotFound(data.workspace_id);
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
                { workspace_id: base.fk_workspace_id, base_id: base.id },
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
            iconColor: deserializeJSON(b.meta)?.iconColor,
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
            is_default: v?.is_default,
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
        */
      } else if (scope.startsWith('p-')) {
        return [];
      }
    } catch (e) {
      return [];
    }
    return cmdData;
  }
}
