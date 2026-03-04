import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { tool } from 'ai';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import {
  ERROR_HINT_MAX_LENGTH,
  TRUNCATE_RESULT_MAX_LENGTH,
} from '../constants';

// Schema tools
import { listBasesTool } from './schema/list-bases.tool';
import { listTablesTool } from './schema/list-tables.tool';
import { describeTableTool } from './schema/describe-table.tool';
import { createTableTool } from './schema/create-table.tool';
import { addFieldTool } from './schema/add-field.tool';
import { modifyFieldTool } from './schema/modify-field.tool';
import { deleteTableTool } from './schema/delete-table.tool';
import { deleteFieldTool } from './schema/delete-field.tool';
import { renameTableTool } from './schema/rename-table.tool';
import { createViewTool } from './schema/create-view.tool';
import { deleteViewTool } from './schema/delete-view.tool';
import { renameViewTool } from './schema/rename-view.tool';
import { listViewsTool } from './schema/list-views.tool';

// Data tools
import { queryRecordsTool } from './data/query-records.tool';
import { getRecordTool } from './data/get-record.tool';
import { createRecordsTool } from './data/create-records.tool';
import { updateRecordsTool } from './data/update-records.tool';
import { deleteRecordsTool } from './data/delete-records.tool';
import { countRecordsTool } from './data/count-records.tool';
import { listLinkedRecordsTool } from './data/list-linked-records.tool';
import { linkRecordsTool } from './data/link-records.tool';
import { unlinkRecordsTool } from './data/unlink-records.tool';

// Ask user tool
import { askUserTool } from './ask-user.tool';

// View tools
import { listViewFieldsTool } from './view/list-view-fields.tool';
import { updateViewFieldsTool } from './view/update-view-fields.tool';
import { setDisplayFieldTool } from './view/set-display-field.tool';
import { addFilterTool } from './view/add-filter.tool';
import { listFiltersTool } from './view/list-filters.tool';
import { removeFilterTool } from './view/remove-filter.tool';
import { addSortTool } from './view/add-sort.tool';
import { listSortsTool } from './view/list-sorts.tool';
import { removeSortTool } from './view/remove-sort.tool';
import { setGroupByTool } from './view/set-group-by.tool';
import { clearGroupByTool } from './view/clear-group-by.tool';
import type { NcRequest } from '~/interface/config';
import type { NcContext } from '~/interface/config';
import type { ToolSet } from 'ai';

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, z.ZodType>;
  permission?: string;
  scope: 'base' | 'workspace';
  requiredRole: ProjectRoles;
  isDangerous: boolean;
  execute(context: NcContext, args: any, req: NcRequest): Promise<any>;
}

const ROLE_HIERARCHY: Record<string, number> = {
  [ProjectRoles.OWNER]: 5,
  [ProjectRoles.CREATOR]: 4,
  [ProjectRoles.EDITOR]: 3,
  [ProjectRoles.COMMENTER]: 2,
  [ProjectRoles.VIEWER]: 1,
  [ProjectRoles.NO_ACCESS]: 0,
};

@Injectable()
export class ChatToolRegistry {
  private readonly logger = new Logger(ChatToolRegistry.name);
  private tools: ChatToolDefinition[] = [];

  constructor() {
    this.registerAllTools();
  }

  private registerAllTools() {
    this.tools = [
      // Schema tools
      listBasesTool,
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
      // Data tools
      queryRecordsTool,
      getRecordTool,
      createRecordsTool,
      updateRecordsTool,
      deleteRecordsTool,
      countRecordsTool,
      listLinkedRecordsTool,
      linkRecordsTool,
      unlinkRecordsTool,
      // View tools
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
      // Interaction tool
      askUserTool,
    ];
  }

  getAvailableTools(req: NcRequest): ChatToolDefinition[] {
    const userRoles = extractRolesObj(
      (req as any).user?.base_roles || (req as any).user?.roles,
    );

    return this.tools.filter((t) => {
      const requiredLevel = ROLE_HIERARCHY[t.requiredRole] || 0;

      // User has sufficient role if any of their roles meets the threshold
      for (const [role, hasRole] of Object.entries(userRoles)) {
        if (hasRole && (ROLE_HIERARCHY[role] || 0) >= requiredLevel) {
          return true;
        }
      }
      return false;
    });
  }

  async executeTool(
    context: NcContext,
    toolName: string,
    args: any,
    req: NcRequest,
  ): Promise<{ result: any; isError: boolean }> {
    const toolDef = this.tools.find((t) => t.name === toolName);
    if (!toolDef) {
      return {
        result: `Unknown tool: ${toolName}`,
        isError: true,
      };
    }

    // Enforce scope: base-scoped tools require base_id in context.
    // This is the structural guardrail — individual tools don't need to check.
    if (toolDef.scope === 'base' && !context.base_id) {
      return {
        result:
          'No base context available. Please ask the user to select a base first.',
        isError: true,
      };
    }

    try {
      // Strip socket_id so realtime broadcasts reach all clients including the requester.
      // The chat request carries the user's socket ID via xc-socket-id header, which would
      // otherwise cause the frontend to suppress the event (assuming it originated from itself).
      const toolContext = { ...context, socket_id: undefined };
      let result = await toolDef.execute(toolContext, args, req);

      // Truncate large results to prevent blowing up the LLM context window.
      // Applied centrally so individual tools don't need to remember.
      if (
        typeof result === 'string' &&
        result.length > TRUNCATE_RESULT_MAX_LENGTH
      ) {
        result =
          result.slice(0, TRUNCATE_RESULT_MAX_LENGTH) + '\n... (truncated)';
      } else if (result && typeof result !== 'string') {
        const serialized = JSON.stringify(result, null, 2);
        if (serialized.length > TRUNCATE_RESULT_MAX_LENGTH) {
          result =
            serialized.slice(0, TRUNCATE_RESULT_MAX_LENGTH) +
            '\n... (truncated)';
        }
      }

      return { result, isError: false };
    } catch (e) {
      this.logger.error(`Tool ${toolName} failed: ${e.message}`, e.stack);
      // Trim the error message — enough for the LLM to give a useful hint (e.g. "field not found")
      // without leaking internal DB details that appear further into long error strings.
      const hint = String(e.message || '').slice(0, ERROR_HINT_MAX_LENGTH);
      return {
        result: `Tool "${toolName}" failed: ${hint}`,
        isError: true,
      };
    }
  }

  toVercelTools(
    availableTools: ChatToolDefinition[],
    context: NcContext,
    req: NcRequest,
    approvals: Record<string, 'approved' | 'denied'> = {},
  ): ToolSet {
    const tools: ToolSet = {};

    for (const t of availableTools) {
      tools[t.name] = tool({
        description: t.description,
        inputSchema: z.object(t.parameters),
        execute: async (args: any, { toolCallId }: { toolCallId: string }) => {
          // Dangerous tools require explicit approval before executing
          if (t.isDangerous) {
            const decision = approvals[toolCallId];
            if (!decision) {
              return JSON.stringify({ __requires_approval: true, toolCallId });
            }
            if (decision === 'denied') {
              return JSON.stringify({
                status: 'denied',
                message: 'Operation denied by user.',
              });
            }
            // decision === 'approved' → fall through to execute
          }

          const { result, isError } = await this.executeTool(
            context,
            t.name,
            args,
            req,
          );
          if (isError) {
            return `ERROR: ${result}`;
          }
          return typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2);
        },
      });
    }

    return tools;
  }
}
