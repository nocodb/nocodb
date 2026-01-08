import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionEntity,
  PermissionKey,
  ProjectRoles,
  type UserType,
  viewTypeAlias,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { CommandPaletteResult } from '~/helpers/commandPaletteHelpers';
import { deserializeJSON } from '~/utils/serialize';
import { getCommandPaletteForUserWorkspaceV2 } from '~/helpers/commandPaletteHelpers';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import { Permission } from '~/models';

@Injectable()
export class CommandPaletteService {
  logger = new Logger('CommandPaletteService');

  constructor() {}

  async commandPalette(param: { body: any; user: UserType }) {
    const cmdData = [];
    try {
      const { scope, data } = param.body;

      if (scope.startsWith('ws-')) {
        const commandPaletteData: CommandPaletteResult =
          await getCommandPaletteForUserWorkspaceV2(
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

        const workflows = new Map<
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

        for (const wsAndBases of commandPaletteData.wsAndBases) {
          if (!workspaces.has(wsAndBases.workspace_id)) {
            workspaces.set(wsAndBases.workspace_id, {
              id: wsAndBases.workspace_id,
              title: wsAndBases.workspace_title,
              meta: deserializeJSON(wsAndBases.workspace_meta),
            });
          }

          if (!bases.has(wsAndBases.base_id)) {
            bases.set(wsAndBases.base_id, {
              id: wsAndBases.base_id,
              title: wsAndBases.base_title,
              meta: deserializeJSON(wsAndBases.base_meta),
              workspace_id: wsAndBases.workspace_id,
            });
            // Store base role (should be consistent for all items in same base)
            if (wsAndBases.base_role && !baseRoleMap.has(wsAndBases.base_id)) {
              baseRoleMap.set(wsAndBases.base_id, wsAndBases.base_role);
            }
          }
        }

        for (const item of commandPaletteData.items.filter(
          (item) => item.kind === 'model',
        )) {
          // Collect unique table IDs per base and track base role
          if (!baseTableIdsMap.has(item.base_id)) {
            baseTableIdsMap.set(item.base_id, new Set<string>());
            baseContextMap.set(item.base_id, {
              workspace_id: item.workspace_id,
              base_id: item.base_id,
            } as NcContext);
          }
          if (item.item_id) {
            baseTableIdsMap.get(item.base_id)!.add(item.item_id);
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
              const hasAccess = await hasTableVisibilityAccess(
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
        for (const item of commandPaletteData.items) {
          switch (item.kind) {
            case 'model': {
              if (!tables.has(item.item_id)) {
                tables.set(item.item_id, {
                  id: item.item_id,
                  title: item.item_title,
                  meta: deserializeJSON(item.item_meta),
                  workspace_id: item.workspace_id,
                  base_id: item.base_id,
                  type: item.item_type,
                  synced: item.item_sync,
                });
              }
              break;
            }

            case 'view': {
              // Only include views for accessible tables
              if (!views.has(item.item_id)) {
                views.set(item.item_id, {
                  id: item.item_id,
                  title: item.item_title,
                  meta: deserializeJSON(item.item_meta),
                  workspace_id: item.workspace_id,
                  base_id: item.base_id,
                  table_id: item.item_id,
                  type: item.item_type,
                });
              }

              break;
            }

            case 'script': {
              if (!scripts.has(item.item_id)) {
                scripts.set(item.item_id, {
                  id: item.item_id,
                  title: item.item_title,
                  meta: deserializeJSON(item.item_meta),
                  workspace_id: item.workspace_id,
                  base_id: item.base_id,
                  order: item.item_order,
                });
              }
              break;
            }

            case 'dashboard': {
              if (!dashboards.has(item.item_id) && item.item_id) {
                dashboards.set(item.item_id, {
                  id: item.item_id,
                  title: item.item_title,
                  meta: deserializeJSON(item.item_meta),
                  workspace_id: item.workspace_id,
                  base_id: item.base_id,
                  order: item.item_order,
                });
              }
              break;
            }

            case 'workflow': {
              if (!workflows.has(item.item_id) && item.item_id) {
                workflows.set(item.item_id, {
                  id: item.item_id,
                  title: item.item_title,
                  meta: deserializeJSON(item.item_meta),
                  workspace_id: item.workspace_id,
                  base_id: item.base_id,
                  order: item.item_order,
                });
              }
              break;
            }
          }
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
            section: 'Automations',
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

        for (const [id, workflow] of workflows) {
          cmdData.push({
            id: `workflow-${id}`,
            title: workflow.title,
            parent: `p-${workflow.base_id}`,
            icon: workflow?.meta?.icon || 'ncAutomation',
            projectName: bases.get(workflow.base_id)?.title,
            section: 'Automations',
            handler: {
              type: 'navigate',
              payload: `/${workflow.workspace_id}/${
                workflow.base_id
              }/workflows/${encodeURIComponent(workflow.id)}`,
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
