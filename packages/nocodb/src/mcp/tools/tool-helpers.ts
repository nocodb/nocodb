import { isLinksOrLTAR, ProjectRoles } from 'nocodb-sdk';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type {
  McpToolAcl,
  McpToolScope,
  McpToolTarget,
} from '~/mcp/tools/tool-scope';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getColumnByIdOrName } from '~/helpers/dataHelpers';
import { hasMinimumRole } from '~/utils/roleHelper';
import { assertTableVisible, resolveToolTableId } from '~/mcp/tool-guards';
import { serializeMcpError } from '~/mcp/mcp-error';
import { collectV3Warnings } from '~/utils/api-v3-warnings';

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

/**
 * Operations where one tool call can stand in for many REST requests.
 * `runBaseTool` makes `units` mandatory for these. This is an allowlist: a new
 * bulk or fan-out op must be added here, or its tool compiles unpriced.
 *
 * The check reads the op's LITERAL type, so it only fires when the ACL is
 * passed as an inline object literal — which every call site does. Hoisting it
 * to a variable annotated `McpToolAcl` widens `op` to `string`, the conditional
 * stops matching, and `units` silently becomes optional again. Keep the ACL
 * inline at the call site.
 */
export const FAN_OUT_OPS = [
  'dataInsert',
  'dataUpdate',
  'dataDelete',
  'nestedDataLink',
  'nestedDataUnlink',
  'dataExport',
  'dataUpsert',
  'exportExcel',
] as const;

export type FanOutOp = (typeof FAN_OUT_OPS)[number];

/** What `runTool` hands back — the MCP content envelope every tool returns. */
export type McpToolResult = Awaited<ReturnType<typeof runTool>>;

interface McpToolIds {
  baseId?: string;
  tableId?: string;
  fieldId?: string;
  viewId?: string;
  hookId?: string;
  commentId?: string;
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
export async function runBaseTool<Op extends string>(
  ctx: Pick<McpToolRegisterCtx, 'scope'>,
  // `Op` is constrained to `string`, so it infers the op's literal type rather
  // than widening — which is what lets the conditional below see 'dataInsert'.
  acl: McpToolAcl & { op: Op },
  // Overloads would not do this: a fan-out call missing `units` simply falls
  // through to the permissive signature instead of erroring. One signature with
  // a conditional arg type has nothing to fall back to.
  args: McpToolIds &
    (Op extends FanOutOp ? { units: number } : { units?: number }),
  fn: (target: McpToolTarget) => Promise<unknown>,
): Promise<McpToolResult> {
  return runTool(async () => {
    const target = await ctx.scope.resolve(acl, {
      baseId: args.baseId,
      units: (args as { units?: number }).units,
    });

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
  args: { workspaceId?: string; units?: number },
  fn: (target: McpToolTarget) => Promise<unknown>,
) {
  return runTool(async () => {
    const target = await ctx.scope.resolve(acl, {
      workspaceId: args.workspaceId,
      units: args.units,
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
    // A write that returns 200 plus the full object encodes "applied",
    // "dropped" and "stored but inert" identically. Anything the services
    // flagged is surfaced alongside the payload so the caller does not have
    // to diff a re-read to find out which one happened.
    const [result, warnings] = await collectV3Warnings(fn);

    // spreading an array here would turn it into an object of numeric keys
    const payload =
      warnings.length &&
      result &&
      typeof result === 'object' &&
      !Array.isArray(result)
        ? { ...(result as Record<string, unknown>), warnings }
        : result;

    return {
      content: [
        {
          type: 'text',
          // A tool whose payload is already prose (an attachment digest, say)
          // returns the string itself rather than a quoted JSON scalar.
          text:
            typeof payload === 'string'
              ? payload
              : JSON.stringify(payload ?? null, null, opts?.compact ? 0 : 2),
        },
      ],
    };
  } catch (error) {
    return serializeMcpError(error);
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

/**
 * Resolve a link (LTAR) field from an id or a title.
 *
 * `nestedLink` resolves the column by id only, but every record tool speaks
 * field titles — so accept either and hand it the id.
 *
 * A non-link field is rejected here rather than deeper in
 * `dataTableService.getColumn`, whose `Column is not LTAR` gives an agent
 * nothing to retry with. Naming the table's actual link fields does.
 */
export async function resolveLinkField(
  linkContext: NcContext,
  tableId: string,
  fieldId: string,
) {
  const model = await Model.get(linkContext, tableId);
  if (!model) NcError.get(linkContext).tableNotFound(tableId);
  const column = await getColumnByIdOrName(linkContext, fieldId, model);

  if (!isLinksOrLTAR(column)) {
    // `system` drops the junction table's own link columns, which are not
    // fields a caller can name.
    const linkFields = (await model.getColumns())
      .filter((c) => isLinksOrLTAR(c) && !c.system)
      .map((c) => c.title)
      .filter(Boolean);

    NcError.get(linkContext).badRequest(
      `Field "${fieldId}" is not a link field (it is ${column.uidt}). ` +
        (linkFields.length
          ? `Link fields on "${model.title}" are: ${linkFields.join(', ')}.`
          : `Table "${model.title}" has no link fields, so its records cannot be linked.`),
    );
  }

  return column;
}
