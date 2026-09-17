import { ProjectRoles } from 'nocodb-sdk';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type {
  McpToolAcl,
  McpToolScope,
  McpToolTarget,
} from '~/mcp/tools/tool-scope';
import { hasMinimumRole } from '~/utils/roleHelper';
import { assertTableVisible, resolveToolTableId } from '~/mcp/tool-guards';

export type McpToolUser = UserType & {
  base_roles?: Record<string, boolean>;
  workspace_roles?: Record<string, boolean>;
  // `User.getWithRoles` returns it and RLS role-subject matching reads it off
  // `context.user`, so it is part of the shape, not an extra.
  direct_teams?: { team_id: string; path: string }[];
};

export interface McpRoleFlags {
  isCommenterPlus: boolean;
  isEditorPlus: boolean;
  isCreatorPlus: boolean;
  isOwner: boolean;
}

export interface McpToolRegisterCtx {
  // Only `registerTool` — a family may register through the registry proxy or
  // the grant filter, neither of which implements anything else. Naming the
  // member makes their casts compiler-checked instead of a comment.
  server: Pick<McpServer, 'registerTool'>;
  /**
   * The base session's captured context, and the role flags derived from it.
   * Tools converted to `scope` ignore these — an account session has no
   * ambient base to put here.
   */
  context: NcContext;
  req: NcRequest;
  user: McpToolUser;
  roles: McpRoleFlags;
  scope: McpToolScope;
}

/**
 * An account session cannot know a caller's role before the call names a base,
 * so it offers every tool and lets `McpCallContextResolver` refuse per call —
 * an agent gets a reason instead of a tool that silently does not exist.
 */
export const ALL_ROLE_FLAGS: McpRoleFlags = {
  isCommenterPlus: true,
  isEditorPlus: true,
  isCreatorPlus: true,
  isOwner: true,
};

export function getRoleFlags(user: McpToolUser): McpRoleFlags {
  return {
    isCommenterPlus: hasMinimumRole(user, ProjectRoles.COMMENTER),
    isEditorPlus: hasMinimumRole(user, ProjectRoles.EDITOR),
    isCreatorPlus: hasMinimumRole(user, ProjectRoles.CREATOR),
    isOwner: hasMinimumRole(user, ProjectRoles.OWNER),
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

// The one wrapper every base-addressed tool goes through: resolve the target
// (which authorises the operation against both the caller's role and the
// credential's grant), enforce table visibility on whatever the call points
// at, then run — inside the MCP error shape, so a refusal reaches the model as
// a message rather than a broken transport.
//
// The ids arrive in the JSON-RPC body, so they never pass through the
// middleware branch that enforces visibility for REST callers, and a field or
// view id has to be walked to its table first.
export async function runBaseTool(
  ctx: Pick<McpToolRegisterCtx, 'scope'>,
  acl: McpToolAcl,
  args: {
    baseId?: string;
    tableId?: string;
    fieldId?: string;
    viewId?: string;
    hookId?: string;
    commentId?: string;
  },
  fn: (target: McpToolTarget) => Promise<unknown>,
) {
  return runTool(async () => {
    const target = await ctx.scope.resolve(acl, { baseId: args.baseId });

    if (acl.feature) {
      await ctx.scope.assertFeature(target, acl.feature);
    }

    const tableId = await resolveToolTableId(target.context, args);

    if (tableId) {
      await assertTableVisible(target.context, tableId, target.user);
    }

    return fn(target);
  });
}

// The workspace-scoped counterpart of `runBaseTool`. Nothing to walk to a
// table here — a workspace-scoped operation names no table.
export async function runWorkspaceTool(
  ctx: Pick<McpToolRegisterCtx, 'scope'>,
  acl: McpToolAcl,
  args: { workspaceId?: string },
  fn: (target: McpToolTarget) => Promise<unknown>,
) {
  return runTool(async () => {
    const target = await ctx.scope.resolve(acl, {
      workspaceId: args.workspaceId,
    });

    if (acl.feature) {
      await ctx.scope.assertFeature(target, acl.feature);
    }

    return fn(target);
  });
}

// `runTool` for a tool that already holds its target and accepts a `tableId`.
export async function runTableTool(
  ctx: Pick<McpToolRegisterCtx, 'context' | 'user'>,
  tableId: string,
  fn: () => Promise<unknown>,
) {
  return runTool(async () => {
    await assertTableVisible(ctx.context, tableId, ctx.user);
    return fn();
  });
}

// Wraps a tool handler with the standard NocoDB MCP result shape and error
// handling so every tool returns a consistent text payload. `compact` drops the
// pretty-printing for large payloads (e.g. generated JSON Schemas) that would
// otherwise blow past client result-size limits.
export async function runTool(
  fn: () => Promise<unknown>,
  opts?: { compact?: boolean },
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const result = await fn();
    return {
      content: [
        {
          type: 'text',
          // A tool whose payload is already prose (an attachment digest, say)
          // returns the string itself rather than a quoted JSON scalar.
          text:
            typeof result === 'string'
              ? result
              : JSON.stringify(result ?? null, null, opts?.compact ? 0 : 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Uniform receipt for a destructive tool.
 *
 * The delete-class tools used to answer in eight different shapes — `true`,
 * `{}`, `null`, `{ success: true }`, `{ children: [] }` — and the least
 * informative of them sat on the most destructive operations: `deleteTable`
 * took a table with all its views, fields and rows and replied `{}`, while
 * `deleteDocument` gave a full accounting for removing one page. Every
 * destructive tool now states what went, and passes `collateral` for whatever
 * else went with it.
 */
export function deletionReceipt(
  resource: string,
  id: string,
  collateral?: Record<string, unknown>,
) {
  return { deleted: true, resource, id, ...(collateral ?? {}) };
}
