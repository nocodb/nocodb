import { AsyncLocalStorage } from 'node:async_hooks';
import type { NcRequest } from 'nocodb-sdk';

/**
 * Every `req` field the duplicate service stamps mid-call. `ncSourceId` is the
 * one that observably leaks: `audit.ts` falls back to it for `source_id`, and
 * unlike `base_id` the context rarely carries its own, so a `duplicateField`
 * earlier in a batch mis-attributes every later call's audits.
 */
const SCOPED_FIELDS = ['ncParentAuditId', 'ncBaseId', 'ncSourceId'] as const;

type ScopedField = (typeof SCOPED_FIELDS)[number];

const scope = new AsyncLocalStorage<Partial<Record<ScopedField, string>>>();

/**
 * Give the audit-stamping `req` fields a per-`tools/call` value.
 *
 * One Express `req` serves every message in a JSON-RPC batch, and the
 * transport dispatches them in a loop it never awaits, so tool handlers run
 * concurrently over that one object. These are write targets, not just
 * reads: `afterBulkInsert` mints a `DATA_BULK_INSERT` parent only while
 * it is unset, and `duplicateModel` stamps it outright. So one call's value
 * suppresses the next call's own parent audit and re-parents its rows under a
 * foreign operation — twenty batched `createRecords` produced one parent with
 * twenty children, and a leading `duplicateTable` attributed all of them to
 * "Table duplicated".
 *
 * Handlers close over `req` at registration time, so the fields have to
 * become call-scoped in place; handing each call a copy would not reach them.
 */
export function scopeAuditFieldsPerCall(req: NcRequest): void {
  for (const field of SCOPED_FIELDS) {
    let shared = req[field] as string | undefined;

    Object.defineProperty(req, field, {
      get: () => {
        const store = scope.getStore();
        return store && field in store ? store[field] : shared;
      },
      set: (value: string | undefined) => {
        const store = scope.getStore();
        if (store) store[field] = value;
        else shared = value;
      },
      // Job payloads are built with JSON.stringify(req), so the accessor has
      // to serialize like the plain field it replaces.
      enumerable: true,
      configurable: true,
    });
  }
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
