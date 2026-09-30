import type { NcContext, UserType } from 'nocodb-sdk';
import { Column, Comment, Hook, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';

/**
 * MCP tools receive `tableId` in the JSON-RPC body, so they never pass through
 * the `ncTableId` branch of extract-ids middleware that enforces table
 * visibility for REST callers. Without this, a base member with an MCP token
 * can read a table their role hides.
 *
 * Raises the same not-found the AI tools raise (`ai/tools/helpers.ts`) so a
 * hidden table is indistinguishable from a missing one.
 */
export async function assertTableVisible(
  context: NcContext,
  tableId: string,
  user: UserType | undefined,
): Promise<void> {
  if (!(await hasTableVisibilityAccess(context, tableId, user as any))) {
    NcError.get(context).genericNotFound('Table', tableId);
  }
}

/**
 * The table a tool call is really about.
 *
 * Half the tools address their target through a child id — a field, a view, a
 * webhook, a comment — and the table they belong to is what visibility is
 * defined on. REST resolves this through the middleware's `ncTableId`
 * extraction; over MCP the id arrives in the JSON-RPC body, so the parent has
 * to be walked here. Returns undefined when nothing was given, or when the id
 * does not resolve in this base — the caller's own not-found then covers it.
 */
export async function resolveToolTableId(
  context: NcContext,
  ids: {
    tableId?: string;
    fieldId?: string;
    viewId?: string;
    hookId?: string;
    commentId?: string;
  },
): Promise<string | undefined> {
  if (ids.tableId) return ids.tableId;

  if (ids.fieldId) {
    const column = await Column.get(context, { colId: ids.fieldId });
    return column?.fk_model_id;
  }

  if (ids.viewId) {
    const view = await View.get(context, ids.viewId);
    return view?.fk_model_id;
  }

  if (ids.hookId) {
    const hook = await Hook.get(context, ids.hookId);
    return hook?.fk_model_id;
  }

  if (ids.commentId) {
    const comment = await Comment.get(context, ids.commentId);
    return comment?.fk_model_id;
  }

  return undefined;
}
