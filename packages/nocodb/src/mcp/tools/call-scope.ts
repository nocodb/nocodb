import { AsyncLocalStorage } from 'node:async_hooks';
import type { NcRequest } from 'nocodb-sdk';

const scope = new AsyncLocalStorage<{ ncParentAuditId?: string }>();

/**
 * Give `req.ncParentAuditId` a per-`tools/call` value.
 *
 * One Express `req` serves every message in a JSON-RPC batch, and the
 * transport dispatches them in a loop it never awaits, so tool handlers run
 * concurrently over that one object. `ncParentAuditId` is a write target, not
 * just a read: `afterBulkInsert` mints a `DATA_BULK_INSERT` parent only while
 * it is unset, and `duplicateModel` stamps it outright. So one call's value
 * suppresses the next call's own parent audit and re-parents its rows under a
 * foreign operation — twenty batched `createRecords` produced one parent with
 * twenty children, and a leading `duplicateTable` attributed all of them to
 * "Table duplicated".
 *
 * Handlers close over `req` at registration time, so the field has to become
 * call-scoped in place; handing each call a copy would not reach them.
 */
export function scopeParentAuditIdPerCall(req: NcRequest): void {
  let shared = req.ncParentAuditId;

  Object.defineProperty(req, 'ncParentAuditId', {
    get: () => {
      const store = scope.getStore();
      return store && 'ncParentAuditId' in store
        ? store.ncParentAuditId
        : shared;
    },
    set: (value: string | undefined) => {
      const store = scope.getStore();
      if (store) store.ncParentAuditId = value;
      else shared = value;
    },
    // Job payloads are built with JSON.stringify(req), so the accessor has to
    // serialize like the plain field it replaces.
    enumerable: true,
    configurable: true,
  });
}

/** Run one tool handler in its own scope. Outside a scope nothing changes. */
export function withCallScope<T extends (...args: any[]) => any>(
  handler: T,
): T {
  return ((...args: Parameters<T>) =>
    scope.run({}, () => handler(...args))) as T;
}

/**
 * Wrap a real `McpServer` so tools registered straight onto it are call-scoped.
 * Only the CE-standalone path needs this — EE wraps inside `McpToolRegistry`.
 */
export function callScopedRegistrar<
  T extends {
    registerTool: (name: string, config: any, handler: any) => unknown;
  },
>(server: T): T {
  return {
    registerTool: (name: string, config: any, handler: any) =>
      server.registerTool(name, config, withCallScope(handler)),
  } as unknown as T;
}
