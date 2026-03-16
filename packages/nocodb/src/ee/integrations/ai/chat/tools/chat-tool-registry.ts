import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { extractRolesObj, OrderedProjectRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { NcContext } from '~/interface/config';
import type { ToolSet } from 'ai';
import type { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import type {
  ChatToolDefinition,
  ToolVisibility,
} from '~/integrations/ai/chat/tools/define-chat-tool';
import { TRUNCATE_RESULT_MAX_LENGTH } from '~/integrations/ai/chat/constants';
import { buildToolErrorHint } from '~/integrations/ai/chat/helpers/error-hints';

import { listTablesTool } from '~/integrations/ai/chat/tools/schema/list-tables.tool';
import { describeTableTool } from '~/integrations/ai/chat/tools/schema/describe-table.tool';
import { createTableTool } from '~/integrations/ai/chat/tools/schema/create-table.tool';
import { addFieldTool } from '~/integrations/ai/chat/tools/schema/add-field.tool';
import { modifyFieldTool } from '~/integrations/ai/chat/tools/schema/modify-field.tool';
import { deleteTableTool } from '~/integrations/ai/chat/tools/schema/delete-table.tool';
import { deleteFieldTool } from '~/integrations/ai/chat/tools/schema/delete-field.tool';
import { renameTableTool } from '~/integrations/ai/chat/tools/schema/rename-table.tool';
import { createViewTool } from '~/integrations/ai/chat/tools/schema/create-view.tool';
import { deleteViewTool } from '~/integrations/ai/chat/tools/schema/delete-view.tool';
import { renameViewTool } from '~/integrations/ai/chat/tools/schema/rename-view.tool';
import { listViewsTool } from '~/integrations/ai/chat/tools/schema/list-views.tool';
import { queryRecordsTool } from '~/integrations/ai/chat/tools/data/query-records.tool';
import { createRecordsTool } from '~/integrations/ai/chat/tools/data/create-records.tool';
import { updateRecordsTool } from '~/integrations/ai/chat/tools/data/update-records.tool';
import { deleteRecordsTool } from '~/integrations/ai/chat/tools/data/delete-records.tool';
import { aggregateTool } from '~/integrations/ai/chat/tools/data/aggregate.tool';
import { listLinkedRecordsTool } from '~/integrations/ai/chat/tools/data/list-linked-records.tool';
import { linkRecordsTool } from '~/integrations/ai/chat/tools/data/link-records.tool';
import { unlinkRecordsTool } from '~/integrations/ai/chat/tools/data/unlink-records.tool';
import { askUserTool } from '~/integrations/ai/chat/tools/ask-user.tool';
import { generateArtifactSchemaTool } from '~/integrations/ai/chat/tools/interaction/generate-artifact-schema.tool';
import { announceTool } from '~/integrations/ai/chat/tools/interaction/announce.tool';
import { openTableTool } from '~/integrations/ai/chat/tools/ui/open-table.tool';
import { openViewTool } from '~/integrations/ai/chat/tools/ui/open-view.tool';
import { openDashboardTool } from '~/integrations/ai/chat/tools/ui/open-dashboard.tool';
import { listViewFieldsTool } from '~/integrations/ai/chat/tools/view/list-view-fields.tool';
import { updateViewFieldsTool } from '~/integrations/ai/chat/tools/view/update-view-fields.tool';
import { setDisplayFieldTool } from '~/integrations/ai/chat/tools/view/set-display-field.tool';
import { addFilterTool } from '~/integrations/ai/chat/tools/view/add-filter.tool';
import { listFiltersTool } from '~/integrations/ai/chat/tools/view/list-filters.tool';
import { removeFilterTool } from '~/integrations/ai/chat/tools/view/remove-filter.tool';
import { addSortTool } from '~/integrations/ai/chat/tools/view/add-sort.tool';
import { listSortsTool } from '~/integrations/ai/chat/tools/view/list-sorts.tool';
import { removeSortTool } from '~/integrations/ai/chat/tools/view/remove-sort.tool';
import { setGroupByTool } from '~/integrations/ai/chat/tools/view/set-group-by.tool';
import { clearGroupByTool } from '~/integrations/ai/chat/tools/view/clear-group-by.tool';
import { listDashboardsTool } from '~/integrations/ai/chat/tools/dashboard/list-dashboards.tool';
import { getDashboardTool } from '~/integrations/ai/chat/tools/dashboard/get-dashboard.tool';
import { createDashboardTool } from '~/integrations/ai/chat/tools/dashboard/create-dashboard.tool';
import { updateDashboardTool } from '~/integrations/ai/chat/tools/dashboard/update-dashboard.tool';
import { deleteDashboardTool } from '~/integrations/ai/chat/tools/dashboard/delete-dashboard.tool';
import { listWidgetsTool } from '~/integrations/ai/chat/tools/dashboard/list-widgets.tool';
import { getWidgetTool } from '~/integrations/ai/chat/tools/dashboard/get-widget.tool';
import { createWidgetTool } from '~/integrations/ai/chat/tools/dashboard/create-widget.tool';
import { updateWidgetTool } from '~/integrations/ai/chat/tools/dashboard/update-widget.tool';
import { deleteWidgetTool } from '~/integrations/ai/chat/tools/dashboard/delete-widget.tool';
import { duplicateWidgetTool } from '~/integrations/ai/chat/tools/dashboard/duplicate-widget.tool';
import { getWidgetDataTool } from '~/integrations/ai/chat/tools/dashboard/get-widget-data.tool';
import { addWidgetFilterTool } from '~/integrations/ai/chat/tools/dashboard/add-widget-filter.tool';
import { listWidgetFiltersTool } from '~/integrations/ai/chat/tools/dashboard/list-widget-filters.tool';
import { removeWidgetFilterTool } from '~/integrations/ai/chat/tools/dashboard/remove-widget-filter.tool';
import { webSearchTool } from '~/integrations/ai/chat/tools/web/web-search.tool';
import { webScrapeTool } from '~/integrations/ai/chat/tools/web/web-scrape.tool';
import { isExaEnabled } from '~/integrations/ai/chat/tools/web/exa-client';
import {
  executeCodeTool,
  isE2bEnabled,
} from '~/integrations/ai/chat/tools/sandbox/execute-code.tool';
import { hasPermission } from '~/helpers/aclHelper';

export type {
  ChatToolDefinition,
  ToolCategory,
  ToolVisibility,
} from '~/integrations/ai/chat/tools/define-chat-tool';

const ALL_TOOLS: ChatToolDefinition[] = [
  listTablesTool,
  describeTableTool,
  createTableTool,
  deleteTableTool,
  renameTableTool,
  addFieldTool,
  modifyFieldTool,
  deleteFieldTool,
  createViewTool,
  deleteViewTool,
  renameViewTool,
  listViewsTool,
  queryRecordsTool,
  createRecordsTool,
  updateRecordsTool,
  deleteRecordsTool,
  aggregateTool,
  listLinkedRecordsTool,
  linkRecordsTool,
  unlinkRecordsTool,
  listViewFieldsTool,
  updateViewFieldsTool,
  setDisplayFieldTool,
  addFilterTool,
  listFiltersTool,
  removeFilterTool,
  addSortTool,
  listSortsTool,
  removeSortTool,
  setGroupByTool,
  clearGroupByTool,
  openTableTool,
  openViewTool,
  openDashboardTool,
  listDashboardsTool,
  getDashboardTool,
  createDashboardTool,
  updateDashboardTool,
  deleteDashboardTool,
  listWidgetsTool,
  getWidgetTool,
  createWidgetTool,
  updateWidgetTool,
  deleteWidgetTool,
  duplicateWidgetTool,
  getWidgetDataTool,
  addWidgetFilterTool,
  listWidgetFiltersTool,
  removeWidgetFilterTool,
  webSearchTool,
  webScrapeTool,
  executeCodeTool,
  askUserTool,
  generateArtifactSchemaTool,
  announceTool,
];

function buildHierarchy(ordered: readonly string[]): Record<string, number> {
  const hierarchy: Record<string, number> = {};
  for (let i = 0; i < ordered.length; i++) {
    hierarchy[ordered[i]] = ordered.length - 1 - i;
  }
  return hierarchy;
}

const BASE_ROLE_HIERARCHY = buildHierarchy(OrderedProjectRoles);

@Injectable()
export class ChatToolRegistry {
  private readonly logger = new Logger(ChatToolRegistry.name);
  private readonly tools: ChatToolDefinition[] = ALL_TOOLS;

  getToolDefinitions(): Array<{
    name: string;
    description: string;
    scope: 'base' | 'common';
    isDangerous: boolean;
    readonly: boolean;
    uiOnly: boolean;
    category: string;
  }> {
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      scope: t.scope,
      isDangerous: t.isDangerous,
      readonly: !!t.readonly,
      uiOnly: !!t.uiOnly,
      category: t.category,
    }));
  }

  getToolSet(
    names: readonly ChatToolName[],
    context: NcContext,
    req: NcRequest,
    approvals: Record<string, 'approved' | 'denied'> = {},
  ): ToolSet {
    const nameSet = new Set<string>(names);
    const tools: ToolSet = {};

    for (const t of this.tools) {
      if (!nameSet.has(t.name)) continue;

      // Skip web tools if Exa API key is not configured
      if (t.category === 'web' && !isExaEnabled()) continue;

      // Skip sandbox tools if E2B is not configured
      if (t.category === 'sandbox' && !isE2bEnabled()) continue;

      if (t.scope !== 'common') {
        const roles = extractRolesObj(req.user?.base_roles);
        if (!this.meetsRequiredRole(roles, t.requiredRole)) continue;
        if (t.permission && !hasPermission(roles, t.permission)) continue;
      }

      tools[t.name] = tool({
        description: t.description,
        inputSchema: t.schema,
        execute: async (args: any, { toolCallId }: { toolCallId: string }) => {
          try {
            const cleanArgs = args;

            if (t.isDangerous) {
              const decision = approvals[toolCallId];
              if (!decision) {
                return JSON.stringify({
                  __requires_approval: true,
                  toolCallId,
                });
              }
              if (decision === 'denied') {
                return JSON.stringify({
                  status: 'denied',
                  message: 'Operation denied by user.',
                });
              }
            }

            const { result, isError } = await this.executeTool(
              context,
              t.name,
              cleanArgs,
              req,
            );
            if (isError) {
              return result;
            }
            return typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2);
          } catch (e) {
            this.logger.error(
              `Tool ${t.name} unhandled error: ${(e as Error).message}`,
              (e as Error).stack,
            );
            return buildToolErrorHint(t.name, e);
          }
        },
      });
    }

    return tools;
  }

  getToolVisibility(toolName: string): ToolVisibility {
    const t = this.tools.find((tool) => tool.name === toolName);
    return t?.visibility || 'hidden';
  }

  async executeTool(
    context: NcContext,
    toolName: string,
    args: any,
    req: NcRequest,
  ): Promise<{ result: any; isError: boolean }> {
    const toolDef = this.tools.find((t) => t.name === toolName);
    if (!toolDef) {
      return { result: `Unknown tool: ${toolName}`, isError: true };
    }

    if (context.schema_locked && !toolDef.readonly) {
      return {
        result:
          'Schema is locked. This base has a published managed app version — ' +
          'create a new draft with create_managed_app_draft before making changes.',
        isError: true,
      };
    }

    if (toolDef.scope === 'base' && !context.base_id) {
      return {
        result:
          'No base context available. Please ask the user to select a base first.',
        isError: true,
      };
    }

    if (toolDef.scope !== 'common') {
      const roles = extractRolesObj(req.user?.base_roles);
      if (!this.meetsRequiredRole(roles, toolDef.requiredRole)) {
        return {
          result: 'Insufficient permissions for this tool.',
          isError: true,
        };
      }
      if (toolDef.permission && !hasPermission(roles, toolDef.permission)) {
        return {
          result: `You do not have permission to perform "${toolDef.permission}".`,
          isError: true,
        };
      }
    }

    try {
      const toolContext = { ...context, socket_id: undefined };
      let result = await toolDef.execute(toolContext, args, req);
      result = this.truncateMiddleOut(result, TRUNCATE_RESULT_MAX_LENGTH);

      // Build metadata via the tool's own buildMeta function
      if (toolDef.buildMeta) {
        try {
          const __metadata = await toolDef.buildMeta(toolContext, args, result);
          if (__metadata && typeof result === 'object' && result !== null) {
            result = { ...result, __metadata };
          }
        } catch {
          // Metadata is best-effort — don't fail the tool
        }
      }

      return { result, isError: false };
    } catch (e) {
      this.logger.error(`Tool ${toolName} failed: ${e.message}`, e.stack);
      return { result: buildToolErrorHint(toolName, e), isError: true };
    }
  }

  private meetsRequiredRole(
    roles: Record<string, boolean> | undefined,
    requiredRole: string | null,
  ): boolean {
    if (requiredRole === null) return true;
    if (!roles || !Object.keys(roles).length) return false;

    const requiredLevel = BASE_ROLE_HIERARCHY[requiredRole] || 0;
    for (const [role, hasRole] of Object.entries(roles)) {
      if (hasRole && (BASE_ROLE_HIERARCHY[role] || 0) >= requiredLevel) {
        return true;
      }
    }
    return false;
  }

  private truncateMiddleOut(result: any, maxLength: number): any {
    let text: string;
    let wasObject = false;

    if (typeof result === 'string') {
      text = result;
    } else if (result && typeof result !== 'string') {
      text = JSON.stringify(result, null, 2);
      wasObject = true;
    } else {
      return result;
    }

    if (text.length <= maxLength) {
      return wasObject ? result : text;
    }

    const keepStart = Math.floor(maxLength * 0.6);
    const keepEnd = maxLength - keepStart - 50;

    const start = text.slice(0, keepStart);
    const end = text.slice(-keepEnd);

    return `${start}\n\n... [${
      text.length - maxLength
    } characters truncated] ...\n\n${end}`;
  }
}
