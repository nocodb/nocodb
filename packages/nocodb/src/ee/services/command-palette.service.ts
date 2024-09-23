import { Injectable, Logger } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
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
  logger = new Logger('CommandPaletteService');

  async commandPalette(param: { body: any; user: UserType }) {
    const cmdData = [];
    try {
      const { scope, data } = param.body;

      if (scope.startsWith('ws-')) {
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

        /*
          Avoid returning workspaces as we use them from state
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
        */

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
      } else if (scope.startsWith('p-')) {
        return [];
      }
    } catch (e) {
      this.logger.warn(e);
      return [];
    }
    return cmdData;
  }
}
