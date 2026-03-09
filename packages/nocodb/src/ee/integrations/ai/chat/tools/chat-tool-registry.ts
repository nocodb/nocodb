import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { tool } from 'ai';
import {
  extractRolesObj,
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
} from 'nocodb-sdk';
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

// Dynamic tool loading
import { loadToolsTool } from './load-tools.tool';

// UI tools
import { navigateBaseTool } from './ui/navigate-base.tool';
import { openTableTool } from './ui/open-table.tool';
import { openViewTool } from './ui/open-view.tool';
import { openDashboardTool } from './ui/open-dashboard.tool';

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

// Dashboard & Widget tools
import { listDashboardsTool } from './dashboard/list-dashboards.tool';
import { getDashboardTool } from './dashboard/get-dashboard.tool';
import { createDashboardTool } from './dashboard/create-dashboard.tool';
import { updateDashboardTool } from './dashboard/update-dashboard.tool';
import { deleteDashboardTool } from './dashboard/delete-dashboard.tool';
import { listWidgetsTool } from './dashboard/list-widgets.tool';
import { getWidgetTool } from './dashboard/get-widget.tool';
import { createWidgetTool } from './dashboard/create-widget.tool';
import { updateWidgetTool } from './dashboard/update-widget.tool';
import { deleteWidgetTool } from './dashboard/delete-widget.tool';
import { duplicateWidgetTool } from './dashboard/duplicate-widget.tool';
import { getWidgetDataTool } from './dashboard/get-widget-data.tool';
import { addWidgetFilterTool } from './dashboard/add-widget-filter.tool';
import { listWidgetFiltersTool } from './dashboard/list-widget-filters.tool';
import { removeWidgetFilterTool } from './dashboard/remove-widget-filter.tool';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { NcContext } from '~/interface/config';
import type { ToolSet } from 'ai';
import deepClone from '~/helpers/deepClone';
import Base from '~/models/Base';
import User from '~/models/User';
import { hasPermission } from '~/helpers/aclHelper';

export interface ChatToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, z.ZodType>;
  permission?: string;
  /** 'base' = requires base context + role check, 'workspace' = workspace-level (no base needed),
   *  'common' = always available regardless of scope (e.g. ask_user) */
  scope: 'base' | 'workspace' | 'common';
  requiredRole: ProjectRoles | WorkspaceUserRoles | null;
  isDangerous: boolean;
  /** True for pure read operations. Defaults to false (mutating) — the safe default.
   *  Only readonly tools can be executed cross-base via base_proxy. */
  readonly?: boolean;
  /** True for tools that only work in browser UI sessions (navigate_base, open_table, open_view, ask_user).
   *  These are auto-injected for internal chat preview sessions but excluded from external agent channels. */
  uiOnly?: boolean;
  /** Tool category for the frontend tool picker: 'schema' | 'data' | 'view' | 'ui' | 'interaction' */
  category?: string;
  /** Whether this tool is included in the default tool set. Defaults to true.
   *  Tools with loadByDefault=false must be loaded via load_tools first. */
  loadByDefault?: boolean;
  /** Resolve `{{KEY}}` placeholders in the description at startup.
   *  Receives the full tool list, returns key-value pairs to replace. */
  descriptionVars?: (tools: ChatToolDefinition[]) => Record<string, string>;
  execute(context: NcContext, args: any, req: NcRequest): Promise<any>;
}

// Derive role-hierarchy maps from the SDK ordered arrays so they stay in sync
// automatically. OrderedProjectRoles / OrderedWorkspaceRoles are sorted from
// most-powerful (index 0) to least-powerful — we invert the index so higher
// numbers mean more power, matching the comparison in meetsRequiredRole.
function buildHierarchy(ordered: readonly string[]): Record<string, number> {
  const hierarchy: Record<string, number> = {};
  for (let i = 0; i < ordered.length; i++) {
    hierarchy[ordered[i]] = ordered.length - 1 - i;
  }
  return hierarchy;
}

const BASE_ROLE_HIERARCHY = buildHierarchy(OrderedProjectRoles);
const WS_ROLE_HIERARCHY = buildHierarchy(OrderedWorkspaceRoles);

@Injectable()
export class ChatToolRegistry {
  private readonly logger = new Logger(ChatToolRegistry.name);
  private tools: ChatToolDefinition[] = [];

  constructor() {
    this.registerAllTools();
  }

  private registerAllTools() {
    // Schema tools
    const schemaTools: ChatToolDefinition[] = [
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
    ].map((t) => ({ ...t, category: 'schema' }));

    // Data tools
    const dataTools: ChatToolDefinition[] = [
      queryRecordsTool,
      getRecordTool,
      createRecordsTool,
      updateRecordsTool,
      deleteRecordsTool,
      countRecordsTool,
      listLinkedRecordsTool,
      linkRecordsTool,
      unlinkRecordsTool,
    ].map((t) => ({ ...t, category: 'data' }));

    // View tools
    const viewTools: ChatToolDefinition[] = [
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
    ].map((t) => ({ ...t, category: 'view', loadByDefault: false }));

    // UI tools — browser-only, auto-injected for internal sessions
    const uiTools: ChatToolDefinition[] = [
      navigateBaseTool,
      openTableTool,
      openViewTool,
      openDashboardTool,
    ].map((t) => ({ ...t, category: 'ui', uiOnly: true }));

    // Dashboard & Widget tools
    const dashboardTools: ChatToolDefinition[] = [
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
    ].map((t) => ({ ...t, category: 'dashboard', loadByDefault: false }));

    // Interaction tool — browser-only
    const interactionTools: ChatToolDefinition[] = [
      { ...askUserTool, category: 'interaction', uiOnly: true },
    ];

    // Cross-base proxy
    const proxyTools: ChatToolDefinition[] = [
      { ...baseProxyTool, category: 'schema' },
    ];

    // Dynamic tool loading — always available
    const metaTools: ChatToolDefinition[] = [
      { ...loadToolsTool, category: 'meta' },
    ];

    this.tools = [
      ...schemaTools,
      ...dataTools,
      ...viewTools,
      ...uiTools,
      ...dashboardTools,
      ...interactionTools,
      ...proxyTools,
      ...metaTools,
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

  getToolDefinitions(): Array<{
    name: string;
    description: string;
    scope: 'base' | 'workspace' | 'common';
    isDangerous: boolean;
    readonly: boolean;
    uiOnly: boolean;
    category: string;
  }> {
    return this.tools
      .filter(
        (t) =>
          // Agents are base-bound — exclude workspace-scoped tools (list_bases, navigate_base, base_proxy)
          // 'common' tools (ask_user) pass through — they work in any scope
          t.scope !== 'workspace',
      )
      .map((t) => ({
        name: t.name,
        description: t.description,
        scope: t.scope,
        isDangerous: t.isDangerous,
        readonly: !!t.readonly,
        uiOnly: !!t.uiOnly,
        category: t.category || 'schema',
      }));
  }

  /**
   * Resolve roles and hierarchy for a tool scope — mirrors getUserRoleForScope
   * from extract-ids middleware.
   */
  private getRolesForScope(
    scope: 'base' | 'workspace' | 'common',
    req: NcRequest,
  ): {
    roles: Record<string, boolean> | undefined;
    hierarchy: Record<string, number>;
  } {
    if (scope === 'workspace') {
      return {
        roles: extractRolesObj(req.user?.workspace_roles),
        hierarchy: WS_ROLE_HIERARCHY,
      };
    }
    // 'base' (default) and any future scopes
    return {
      roles: extractRolesObj(req.user?.base_roles),
      hierarchy: BASE_ROLE_HIERARCHY,
    };
  }

  /**
   * Check if user meets the minimum role level for a tool.
   */
  private meetsRequiredRole(
    roles: Record<string, boolean> | undefined,
    requiredRole: string | null,
    scope: 'base' | 'workspace',
  ): boolean {
    // null = no role required, any authenticated user passes
    if (requiredRole === null) return true;

    if (!roles || !Object.keys(roles).length) return false;

    const hierarchy =
      scope === 'workspace' ? WS_ROLE_HIERARCHY : BASE_ROLE_HIERARCHY;
    const requiredLevel = hierarchy[requiredRole] || 0;
    for (const [role, hasRole] of Object.entries(roles)) {
      if (hasRole && (hierarchy[role] || 0) >= requiredLevel) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get tools available to the current user, filtered by role/ACL
   * and optionally by loaded categories.
   *
   * When `loadedCategories` is provided, tools with `loadByDefault: false`
   * are excluded unless their category is in the set. The `load_tools`
   * meta-tool is always included so the AI can load more categories.
   */
  getAvailableTools(
    req: NcRequest,
    loadedCategories?: Set<string>,
  ): ChatToolDefinition[] {
    return this.tools.filter((t) => {
      // ── Category gate (when loadedCategories is provided) ──
      if (loadedCategories) {
        if (
          t.loadByDefault === false &&
          !(t.category && loadedCategories.has(t.category))
        ) {
          return false;
        }
      }

      // ── Role / ACL gate ──
      // Common tools are available to any authenticated user —
      // controller-level ACL already verified workspace membership.
      if (t.scope === 'common') return true;

      // Resolve roles based on tool scope (workspace_roles or base_roles)
      const { roles } = this.getRolesForScope(t.scope, req);

      // Role hierarchy gate — user must meet the minimum role level.
      if (!this.meetsRequiredRole(roles, t.requiredRole, t.scope)) {
        return false;
      }

      // Granular ACL gate — if the tool declares a permission, verify
      // the user's roles actually grant it (include/exclude check).
      if (t.permission && !hasPermission(roles, t.permission)) {
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

    // Enforce schema lock: when a managed app has a published version (no draft)
    // or the base is a sandbox master, mutating tools are blocked.
    if (context.schema_locked && !toolDef.readonly) {
      return {
        result:
          'Schema is locked. This base has a published managed app version — ' +
          'create a new draft with create_managed_app_draft before making changes.',
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

    // Defense in depth — re-verify role hierarchy at execution time.
    // getAvailableTools already filtered, but this guards against stale tool
    // lists or direct calls. Common-scope tools skip (only need authentication).
    if (toolDef.scope !== 'common') {
      const { roles } = this.getRolesForScope(toolDef.scope, req);
      if (!this.meetsRequiredRole(roles, toolDef.requiredRole, toolDef.scope)) {
        return {
          result: 'Insufficient permissions for this tool.',
          isError: true,
        };
      }

      // Granular ACL — roles already resolved for the correct scope above.
      if (toolDef.permission && !hasPermission(roles, toolDef.permission)) {
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
    // Base proxy only proxies base-scoped tools, so always use base hierarchy.
    if (!this.meetsRequiredRole(baseRoles, innerTool.requiredRole, 'base')) {
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
    // Clone user via rfdc to avoid mutating the shared req object
    // (concurrent base_proxy calls would race on req.user.base_roles otherwise).
    const proxiedContext = { ...context, base_id: targetBaseId };
    const clonedUser = deepClone(req.user);
    clonedUser.base_roles = userWithRoles.base_roles;
    const proxiedReq = Object.create(req, {
      user: { value: clonedUser, writable: true, enumerable: true },
    });

    return this.executeTool(
      proxiedContext,
      innerToolName,
      tool_args,
      proxiedReq,
    );
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
