import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionEntity,
  PermissionKey,
  ProjectRoles,
  type UserType,
  viewTypeAlias,
} from 'nocodb-sdk';
import { forwardRef, Inject } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { deserializeJSON } from '~/utils/serialize';
import { getCommandPaletteForUserWorkspace } from '~/helpers/commandPaletteHelpers';
import { TablesService } from '~/services/tables.service';
import { Permission } from '~/models';

@Injectable()
export class CommandPaletteService {
  logger = new Logger('CommandPaletteService');

  constructor(
    @Inject(forwardRef(() => TablesService))
    private tablesService: TablesService,
  ) {}

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
          table_synced?: boolean;
          view_id: string;
          view_title: string;
          view_type: string;
          view_meta: string;
          script_id: string;
          script_title: string;
          script_meta: string;
          script_order: number;
          dashboard_id: string;
          dashboard_title: string;
          dashboard_meta: string;
          dashboard_order: number;
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
            synced?: boolean;
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
            type: string;
            meta: any;
          }
        >();

        const scripts = new Map<
          string,
          {
            id: string;
            title: string;
            workspace_id: string;
            base_id: string;
            order: number;
            meta: any;
          }
        >();

        const dashboards = new Map<
          string,
          {
            id: string;
            title: string;
            workspace_id: string;
            base_id: string;
            order: number;
            meta: any;
          }
        >();

        // First, collect all unique table IDs per base and track base roles
        const baseTableIdsMap = new Map<string, Set<string>>();
        const baseContextMap = new Map<string, NcContext>();
        const baseRoleMap = new Map<string, string>(); // Track base role for each base

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

          // Collect unique table IDs per base and track base role
          if (!baseTableIdsMap.has(item.base_id)) {
            baseTableIdsMap.set(item.base_id, new Set<string>());
            baseContextMap.set(item.base_id, {
              workspace_id: item.workspace_id,
              base_id: item.base_id,
            } as NcContext);
          }
          if (item.table_id) {
            baseTableIdsMap.get(item.base_id)!.add(item.table_id);
          }
          // Store base role (should be consistent for all items in same base)
          if (item.base_role && !baseRoleMap.has(item.base_id)) {
            baseRoleMap.set(item.base_id, item.base_role);
          }
        }

        // Check table visibility permissions for each base
        const accessibleTableIds = new Set<string>();
        for (const [baseId, tableIds] of baseTableIdsMap) {
          const context = baseContextMap.get(baseId)!;
          const baseRole = baseRoleMap.get(baseId);

          // Base owners always have access to all tables
          if (baseRole === ProjectRoles.OWNER) {
            for (const tableId of tableIds) {
              accessibleTableIds.add(tableId);
            }
            continue;
          }

          const permissions = await Permission.list(context, baseId);

          // Check each table's visibility
          for (const tableId of tableIds) {
            // Find TABLE_VISIBILITY permission for this table
            const visibilityPermission = permissions.find(
              (p) =>
                p.entity === PermissionEntity.TABLE &&
                p.entity_id === tableId &&
                p.permission === PermissionKey.TABLE_VISIBILITY,
            );

            // If no permission exists, default to everyone (accessible)
            if (!visibilityPermission) {
              accessibleTableIds.add(tableId);
              continue;
            }

            // Check if user's base role has permission
            // Use Permission.isAllowed with the base_role from items
            if (baseRole) {
              const hasPermission = await Permission.isAllowed(
                context,
                visibilityPermission,
                {
                  id: param.user?.id,
                  role: baseRole as any,
                },
              );
              if (hasPermission) {
                accessibleTableIds.add(tableId);
              }
            } else {
              // If no base role, check using hasTableVisibilityAccess as fallback
              const hasAccess =
                await this.tablesService.hasTableVisibilityAccess(
                  context,
                  tableId,
                  param.user,
                  permissions,
                );
              if (hasAccess) {
                accessibleTableIds.add(tableId);
              }
            }
          }
        }

        // Filter and process items - only include accessible tables
        for (const item of list) {
          // Skip if table is not accessible
          // hasTableVisibilityAccess already handles base owners, so if it returns false,
          // the table is truly not accessible
          if (item.table_id && !accessibleTableIds.has(item.table_id)) {
            continue; // Skip this table/view
          }

          if (!tables.has(item.table_id) && item.table_id) {
            tables.set(item.table_id, {
              id: item.table_id,
              title: item.table_title,
              meta: deserializeJSON(item.table_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              type: item.table_type,
              synced: item.table_synced,
            });
          }

          // Only include views for accessible tables
          if (
            !views.has(item.view_id) &&
            item.view_id &&
            item.table_id &&
            accessibleTableIds.has(item.table_id)
          ) {
            views.set(item.view_id, {
              id: item.view_id,
              title: item.view_title,
              meta: deserializeJSON(item.view_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              table_id: item.table_id,
              type: item.view_type,
            });
          }

          if (!scripts.has(item.script_id) && item.script_id) {
            scripts.set(item.script_id, {
              id: item.script_id,
              title: item.script_title,
              meta: deserializeJSON(item.script_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              order: item.script_order,
            });
          }

          if (!dashboards.has(item.dashboard_id) && item.dashboard_id) {
            dashboards.set(item.dashboard_id, {
              id: item.dashboard_id,
              title: item.dashboard_title,
              meta: deserializeJSON(item.dashboard_meta),
              workspace_id: item.workspace_id,
              base_id: item.base_id,
              order: item.dashboard_order,
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
            synced: table?.synced,
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
            handler: {
              type: 'navigate',
              payload: `/${view.workspace_id}/${view.base_id}/${
                view.table_id
              }/${encodeURIComponent(id)}`,
            },
          });
        }

        for (const [id, script] of scripts) {
          cmdData.push({
            id: `script-${id}`,
            title: script.title,
            parent: `p-${script.base_id}`,
            icon: script?.meta?.icon || 'ncScript',
            projectName: bases.get(script.base_id)?.title,
            section: 'Scripts',
            handler: {
              type: 'navigate',
              payload: `/${script.workspace_id}/${
                script.base_id
              }/automations/${encodeURIComponent(script.id)}`,
            },
          });
        }

        for (const [id, dashboard] of dashboards) {
          cmdData.push({
            id: `dashboard-${id}`,
            title: dashboard.title,
            parent: `p-${dashboard.base_id}`,
            icon: dashboard?.meta?.icon || 'dashboards',
            projectName: bases.get(dashboard.base_id)?.title,
            section: 'Dashboards',
            handler: {
              type: 'navigate',
              payload: `/${dashboard.workspace_id}/${
                dashboard.base_id
              }/dashboards/${encodeURIComponent(dashboard.id)}`,
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
