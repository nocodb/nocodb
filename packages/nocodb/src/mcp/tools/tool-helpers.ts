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

// `Links` is NocoDB's deprecated v1-style relation field (flagged with an
// upgrade banner in the UI regardless of its internal LTAR version).
// `LinkToAnotherRecord` always resolves to the current v2 LTAR relation —
// the MCP tools only ever offer that one, whether creating a field directly
// or bundling one into table creation.
export const REJECT_DEPRECATED_LINKS_MESSAGE =
  "type 'Links' creates a deprecated relation field; use 'LinkToAnotherRecord' instead";

export function isNotDeprecatedLinksType(field: unknown) {
  return (field as { type?: string } | undefined)?.type !== 'Links';
}

export function hasNoDeprecatedLinksType(fields: unknown) {
  return !Array.isArray(fields) || fields.every(isNotDeprecatedLinksType);
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
