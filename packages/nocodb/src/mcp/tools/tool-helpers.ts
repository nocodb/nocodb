import { ProjectRoles } from 'nocodb-sdk';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import { hasMinimumRole } from '~/utils/roleHelper';

export type McpToolUser = UserType & {
  base_roles?: Record<string, boolean>;
  workspace_roles?: Record<string, boolean>;
};

export interface McpRoleFlags {
  isCommenterPlus: boolean;
  isEditorPlus: boolean;
  isCreatorPlus: boolean;
}

export interface McpToolRegisterCtx {
  server: McpServer;
  context: NcContext;
  req: NcRequest;
  user: McpToolUser;
  roles: McpRoleFlags;
}

export function getRoleFlags(user: McpToolUser): McpRoleFlags {
  return {
    isCommenterPlus: hasMinimumRole(user, ProjectRoles.COMMENTER),
    isEditorPlus: hasMinimumRole(user, ProjectRoles.EDITOR),
    isCreatorPlus: hasMinimumRole(user, ProjectRoles.CREATOR),
  };
}

// Wraps a tool handler with the standard NocoDB MCP result shape and error
// handling so every tool returns a consistent text payload.
export async function runTool(
  fn: () => Promise<unknown>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const result = await fn();
    return {
      content: [
        { type: 'text', text: JSON.stringify(result ?? null, null, 2) },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
