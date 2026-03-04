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

// Cross-base proxy
import { baseProxyTool } from './base-proxy.tool';

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
import Base from '~/models/Base';
import User from '~/models/User';
import { hasPermission } from '~/helpers/aclHelper';

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, z.ZodType>;
  permission?: string;
  scope: 'base' | 'workspace';
  requiredRole: ProjectRoles;
  isDangerous: boolean;
  /** True for pure read operations. Defaults to false (mutating) — the safe default.
   *  Only readonly tools can be executed cross-base via base_proxy. */
  readonly?: boolean;
  /** Resolve `{{KEY}}` placeholders in the description at startup.
   *  Receives the full tool list, returns key-value pairs to replace. */
  descriptionVars?: (tools: ChatToolDefinition[]) => Record<string, string>;
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
      // Cross-base proxy
      baseProxyTool,
    ];

    // Hydrate {{placeholders}} in tool descriptions with computed values.
    for (const t of this.tools) {
      if (!t.descriptionVars) continue;
      for (const [key, value] of Object.entries(
        t.descriptionVars(this.tools),
      )) {
        t.description = t.description.replace(`{{${key}}}`, value);
      }
    }
  }

  getAvailableTools(req: NcRequest): ChatToolDefinition[] {
    const baseRoles = extractRolesObj((req as any).user?.base_roles);

    return this.tools.filter((t) => {
      // Workspace-scoped tools are available to any authenticated user —
      // controller-level ACL already verified workspace membership.
      if (t.scope === 'workspace') return true;

      // Base-scoped tools require base_roles. No base context = no base tools.
      if (!baseRoles || !Object.keys(baseRoles).length) return false;

      // Role hierarchy gate — user must meet the minimum role level.
      const requiredLevel = ROLE_HIERARCHY[t.requiredRole] || 0;
      let meetsRoleLevel = false;
      for (const [role, hasRole] of Object.entries(baseRoles)) {
        if (hasRole && (ROLE_HIERARCHY[role] || 0) >= requiredLevel) {
          meetsRoleLevel = true;
          break;
        }
      }
      if (!meetsRoleLevel) return false;

      // Granular ACL gate — if the tool declares a permission, verify
      // the user's roles actually grant it (include/exclude check).
      if (t.permission && !hasPermission(baseRoles, t.permission)) {
        return false;
      }

      return true;
    });
  }

  async executeTool(
    context: NcContext,
    toolName: string,
    args: any,
    req: NcRequest,
  ): Promise<{ result: any; isError: boolean }> {
    // base_proxy is intercepted here — its execute() is never called directly.
    // All cross-base access funnels through this single code path.
    if (toolName === 'base_proxy') {
      return this.executeBaseProxy(context, args, req);
    }

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

    // Enforce granular ACL — even if getAvailableTools filtered, this is the
    // authoritative gate (defense in depth against stale tool lists or direct calls).
    if (toolDef.permission) {
      const roles = extractRolesObj((req as any).user?.base_roles);
      if (!hasPermission(roles, toolDef.permission)) {
        return {
          result: `You do not have permission to perform "${toolDef.permission}".`,
          isError: true,
        };
      }
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

  // ---------------------------------------------------------------------------
  // Cross-base proxy — single gateway for all cross-base tool execution.
  // Resolves the target base, verifies user access, checks per-base roles,
  // then delegates to the inner tool via executeTool.
  // ---------------------------------------------------------------------------

  private async executeBaseProxy(
    context: NcContext,
    args: {
      base_id: string;
      tool_name: string;
      tool_args: Record<string, any>;
    },
    req: NcRequest,
  ): Promise<{ result: any; isError: boolean }> {
    const { base_id: targetBaseId, tool_name: innerToolName, tool_args } = args;

    // 1. Reject self-reference
    if (innerToolName === 'base_proxy') {
      return { result: 'Cannot proxy base_proxy recursively.', isError: true };
    }

    // 2. Look up inner tool
    const innerTool = this.tools.find((t) => t.name === innerToolName);
    if (!innerTool) {
      return { result: `Unknown tool: ${innerToolName}`, isError: true };
    }

    // 3. Only base-scoped tools can be proxied
    if (innerTool.scope !== 'base') {
      return {
        result: `Tool "${innerToolName}" does not require base context — call it directly.`,
        isError: true,
      };
    }

    // 4. Only read-only tools can be proxied — block all write/mutating operations
    if (!innerTool.readonly) {
      return {
        result:
          `Tool "${innerToolName}" is not a read-only operation and cannot be executed cross-base. ` +
          'Ask the user to navigate to the target base first.',
        isError: true,
      };
    }

    // 5. Resolve base — must exist and belong to this workspace
    const base = await Base.get(context, targetBaseId);
    if (!base || base.fk_workspace_id !== context.workspace_id) {
      return { result: 'Base not found in this workspace.', isError: true };
    }

    // 6. Verify user has access and resolve per-base roles
    const userWithRoles = await User.getWithRoles(
      { ...context, base_id: targetBaseId },
      req.user.id,
      { baseId: targetBaseId, workspaceId: context.workspace_id },
    );

    const baseRoles = extractRolesObj(userWithRoles.base_roles);
    if (!baseRoles || !Object.values(baseRoles).some(Boolean)) {
      // Intentionally vague — don't reveal whether the base exists
      return { result: 'Base not found in this workspace.', isError: true };
    }

    // 7. Check user's role on the TARGET base meets the inner tool's requiredRole
    const requiredLevel = ROLE_HIERARCHY[innerTool.requiredRole] || 0;
    let meetsRoleLevel = false;
    for (const [role, hasRole] of Object.entries(baseRoles)) {
      if (hasRole && (ROLE_HIERARCHY[role] || 0) >= requiredLevel) {
        meetsRoleLevel = true;
        break;
      }
    }
    if (!meetsRoleLevel) {
      return {
        result: `Insufficient permissions on this base for "${innerToolName}".`,
        isError: true,
      };
    }

    // 7b. Granular ACL check on the TARGET base's roles
    if (
      innerTool.permission &&
      !hasPermission(baseRoles, innerTool.permission)
    ) {
      return {
        result: `Insufficient permissions on this base for "${innerToolName}".`,
        isError: true,
      };
    }

    // 8. Execute inner tool with the target base context.
    // Temporarily set base_roles so downstream services see the correct roles.
    const proxiedContext = { ...context, base_id: targetBaseId };
    const originalBaseRoles = req.user.base_roles;
    req.user.base_roles = userWithRoles.base_roles;

    try {
      return await this.executeTool(
        proxiedContext,
        innerToolName,
        tool_args,
        req,
      );
    } finally {
      req.user.base_roles = originalBaseRoles;
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
