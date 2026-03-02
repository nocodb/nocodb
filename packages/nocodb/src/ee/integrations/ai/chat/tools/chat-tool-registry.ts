import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { tool } from 'ai';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';

// Schema tools
import { listTablesTool } from './schema/list-tables.tool';
import { describeTableTool } from './schema/describe-table.tool';
import { createTableTool } from './schema/create-table.tool';
import { addFieldTool } from './schema/add-field.tool';
import { modifyFieldTool } from './schema/modify-field.tool';
import { createViewTool } from './schema/create-view.tool';
import { listViewsTool } from './schema/list-views.tool';

// Data tools
import { queryRecordsTool } from './data/query-records.tool';
import { getRecordTool } from './data/get-record.tool';
import { createRecordTool } from './data/create-record.tool';
import { updateRecordTool } from './data/update-record.tool';
import { deleteRecordTool } from './data/delete-record.tool';
import { bulkInsertTool } from './data/bulk-insert.tool';
import { countRecordsTool } from './data/count-records.tool';

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
  permission: string;
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
      listTablesTool,
      describeTableTool,
      createTableTool,
      addFieldTool,
      modifyFieldTool,
      createViewTool,
      listViewsTool,
      // Data tools
      queryRecordsTool,
      getRecordTool,
      createRecordTool,
      updateRecordTool,
      deleteRecordTool,
      bulkInsertTool,
      countRecordsTool,
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

    // Role-based filtering already applied in getAvailableTools()
    // The controller endpoint also enforces ACL via @Acl decorator

    try {
      const result = await toolDef.execute(context, args, req);
      return { result, isError: false };
    } catch (e) {
      this.logger.error(`Tool ${toolName} failed: ${e.message}`, e.stack);
      return {
        result: `Error executing ${toolName}: ${e.message}`,
        isError: true,
      };
    }
  }

  toVercelTools(
    availableTools: ChatToolDefinition[],
    context: NcContext,
    req: NcRequest,
  ): ToolSet {
    const tools: ToolSet = {};

    for (const t of availableTools) {
      tools[t.name] = tool({
        description: t.description,
        inputSchema: z.object(t.parameters),
        execute: async (args: any) => {
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
